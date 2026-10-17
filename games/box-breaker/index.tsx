import { useRouter } from "expo-router";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  View as RNView,
  StyleSheet,
} from "react-native";

import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { deviceToScreenTilt } from "@/games/tilt-balance/logic";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  BALL_R,
  BRICK_GAP,
  BRICK_H,
  BRICK_TOP,
  BRICK_W,
  type BreakerState,
  type BrickKind,
  COLS,
  FIELD_H,
  FIELD_W,
  launch,
  movePaddle,
  newGame,
  PADDLE_H,
  PADDLE_Y,
  type PowerKind,
  paddleWidth,
  step,
} from "./logic";

const GAME_ID = "box-breaker";
const FRAME_MS = 16;
/** Paddle speed at full tilt, in field widths per second. */
const TILT_SPEED = 2.2;
const TILT_DEADZONE = 0.04;

type Phase = "menu" | "playing" | "over";
type Control = "touch" | "tilt";

/** Box colours: normal boxes by how many hits they started with. */
const HP_COLORS = ["transparent", "#38BDF8", "#F59E0B", "#A855F7"];
const KIND_COLORS: Record<Exclude<BrickKind, "normal">, string> = {
  bomb: "#334155",
  mystery: "#22C55E",
  steel: "#64748B",
};
const FIRE_COLOR = "#F97316";
const POWER_EMOJI: Record<PowerKind, string> = {
  fire: "🔥",
  life: "❤️",
  multi: "⚪",
  wide: "↔️",
};
const FLASH_MS = 110;
const DEBRIS_MS = 650;
const SHAKE_MS = 260;
const TRAIL = 6;

const boxColor = (kind: BrickKind, maxHp: number) =>
  kind === "normal" ? HP_COLORS[Math.min(3, maxHp)] : KIND_COLORS[kind];

interface Debris {
  born: number;
  color: string;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

/** Purely visual effects, kept out of the simulation. */
interface Fx {
  debris: Debris[];
  /** Box index → ms until which it flashes white. */
  flash: Map<number, number>;
  shakeUntil: number;
  /** Recent positions of each ball, newest last. */
  trails: { x: number; y: number }[][];
}

const emptyFx = (): Fx => ({
  debris: [],
  flash: new Map(),
  shakeUntil: 0,
  trails: [],
});

/** Stops the frame loop and sensors; module-level so the unmount cleanup never depends on a per-render closure. */
function haltLoop(
  loop: { current: ReturnType<typeof setInterval> | null },
  subs: { current: { remove: () => void }[] }
) {
  if (loop.current) {
    clearInterval(loop.current);
  }
  loop.current = null;
  for (const sub of subs.current) {
    sub.remove();
  }
  subs.current = [];
}

/**
 * Box Breaker — bounce the ball off the paddle and clear every box.
 * Steer with a finger anywhere on the field, or by tilting the phone.
 */
export default function BoxBreakerGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const router = useRouter();
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("menu");
  const [control, setControl] = useState<Control>("touch");
  const [tiltAvailable, setTiltAvailable] = useState(false);
  const [game, setGame] = useState<BreakerState>(() => newGame());
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [area, setArea] = useState<{ h: number; w: number } | null>(null);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);

  // The simulation runs in refs at 60 Hz; React state only mirrors it for drawing.
  const gameRef = useRef(game);
  const lastFrameRef = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tiltRef = useRef(0);
  const rotationRef = useRef(0);
  const sensorSubs = useRef<{ remove: () => void }[]>([]);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fxRef = useRef<Fx>(emptyFx());

  useEffect(() => {
    let cancelled = false;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) {
          setTiltAvailable(ok);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const stopLoop = () => haltLoop(loopRef, sensorSubs);

  useEffect(
    () => () => {
      haltLoop(loopRef, sensorSubs);
      if (bannerTimer.current) {
        clearTimeout(bannerTimer.current);
      }
    },
    []
  );

  const flash = (text: string) => {
    setBanner(text);
    if (bannerTimer.current) {
      clearTimeout(bannerTimer.current);
    }
    bannerTimer.current = setTimeout(() => setBanner(null), 1400);
  };

  const finish = (final: BreakerState) => {
    stopLoop();
    haptic.error();
    setResult(updateProgress(GAME_ID, final.score, { won: final.level > 1 }));
    setPhase("over");
  };

  const tick = () => {
    const now = Date.now();
    const dt = now - lastFrameRef.current;
    lastFrameRef.current = now;
    let s = gameRef.current;
    if (control === "tilt" && Math.abs(tiltRef.current) > TILT_DEADZONE) {
      s = movePaddle(
        s,
        s.paddleX + tiltRef.current * TILT_SPEED * (dt / 1000),
        now
      );
    }
    const { events, state } = step(s, dt, now, Math.random);
    gameRef.current = state;
    updateFx(s, state, events, now, dt);
    setGame(state);
    if (events.exploded) {
      haptic.heavy();
    }

    if (events.broken > 0) {
      haptic.tap();
    }
    if (events.power) {
      haptic.success();
    }
    if (events.cleared) {
      haptic.success();
      flash(t("levelLabel", { level: state.level }));
    }
    if (events.over) {
      finish(state);
    } else if (events.lostLife) {
      haptic.heavy();
    }
  };

  const updateFx = (
    before: BreakerState,
    after: BreakerState,
    events: ReturnType<typeof step>["events"],
    at: number,
    dt: number
  ) => {
    const fx = fxRef.current;
    for (const i of events.hitAt) {
      fx.flash.set(i, at + FLASH_MS);
    }
    for (const i of events.brokenAt) {
      const color = boxColor(before.kinds[i], before.maxHp[i]);
      const cx = ((i % COLS) + 0.5) * BRICK_W;
      const cy = BRICK_TOP + (Math.floor(i / COLS) + 0.5) * BRICK_H;
      for (let k = 0; k < 5; k += 1) {
        fx.debris.push({
          born: at,
          color,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -Math.random() * 0.35,
          x: cx + (Math.random() - 0.5) * BRICK_W * 0.6,
          y: cy,
        });
      }
    }
    if (events.exploded) {
      fx.shakeUntil = at + SHAKE_MS;
    }
    const sec = dt / 1000;
    fx.debris = fx.debris
      .filter((d) => at - d.born < DEBRIS_MS)
      .map((d) => ({
        ...d,
        vy: d.vy + 1.8 * sec,
        x: d.x + d.vx * sec,
        y: d.y + d.vy * sec,
      }));
    // A new level or a lost ball starts a fresh trail.
    const reset = events.cleared || events.lostLife;
    fx.trails = after.balls.map((b, i) =>
      b.stuck || reset
        ? []
        : [...(fx.trails[i] ?? []), { x: b.x, y: b.y }].slice(-TRAIL)
    );
  };

  const startLoop = () => {
    stopLoop();
    lastFrameRef.current = Date.now();
    if (control === "tilt") {
      Accelerometer.setUpdateInterval(FRAME_MS);
      DeviceMotion.setUpdateInterval(500);
      sensorSubs.current = [
        DeviceMotion.addListener(({ orientation }) => {
          rotationRef.current = orientation;
        }),
        Accelerometer.addListener(({ x, y }) => {
          const screen = deviceToScreenTilt(x, y, rotationRef.current);
          tiltRef.current = Math.max(-1, Math.min(1, screen.x));
        }),
      ];
    }
    loopRef.current = setInterval(tick, FRAME_MS);
  };

  const startGame = () => {
    haptic.tap();
    const fresh = newGame();
    gameRef.current = fresh;
    fxRef.current = emptyFx();
    setGame(fresh);
    setResult(null);
    setPaused(false);
    setPhase("playing");
    flash(t("levelLabel", { level: 1 }));
    startLoop();
  };

  const pause = () => {
    stopLoop();
    setPaused(true);
  };

  const resume = () => {
    setPaused(false);
    startLoop();
  };

  const quitRun = () => {
    stopLoop();
    if (gameRef.current.score > 0) {
      updateProgress(GAME_ID, gameRef.current.score, {
        won: gameRef.current.level > 1,
      });
    }
  };

  /* ------------------------------------------------------------- input */

  const scale = area ? Math.min(area.w / FIELD_W, area.h / FIELD_H) : 0;

  // Children ignore touches, so locationX is always relative to the field itself.
  const fieldX = (e: GestureResponderEvent) => e.nativeEvent.locationX / scale;

  const onTouchMove = (e: GestureResponderEvent) => {
    if (control === "touch" && scale > 0) {
      gameRef.current = movePaddle(gameRef.current, fieldX(e), Date.now());
    }
  };

  const onTouchEnd = () => {
    if (gameRef.current.balls.some((b) => b.stuck)) {
      gameRef.current = launch(gameRef.current, Math.random);
    }
  };

  /* -------------------------------------------------------------- menu */

  if (phase === "menu") {
    const option = (value: Control, label: string, hint: string) => {
      const active = control === value;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          key={value}
          onPress={() => {
            haptic.tap();
            setControl(value);
          }}
          style={[
            styles.modeBtn,
            active
              ? { backgroundColor: theme.tint, borderColor: theme.tint }
              : { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text
            style={[
              styles.modeTitle,
              { color: active ? theme.onTint : theme.text },
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              styles.modeDesc,
              { color: active ? theme.onTint : theme.mutedText },
            ]}
          >
            {hint}
          </Text>
        </Pressable>
      );
    };
    return (
      <View style={[styles.menu, { backgroundColor: theme.background }]}>
        <Text style={styles.menuTitle}>{t("gameBoxBreakerName")}</Text>
        <Text style={styles.menuEmoji}>🧱 💣 ❓ ⚪ 🔥</Text>
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("bbChooseControl")}
        </Text>
        {option("touch", t("bbTouch"), t("bbTouchHint"))}
        {tiltAvailable ? option("tilt", t("bbTilt"), t("bbTiltHint")) : null}
        <Pressable
          accessibilityRole="button"
          onPress={startGame}
          style={[styles.playBtn, { backgroundColor: theme.tint }]}
        >
          <Text style={[styles.playText, { color: theme.onTint }]}>
            {t("play")}
          </Text>
        </Pressable>
      </View>
    );
  }

  /* -------------------------------------------------------------- field */

  const now = Date.now();
  const padW = paddleWidth(game, now);
  const stuck = game.balls.some((b) => b.stuck);
  const fx = fxRef.current;
  const onFire = now < game.fireUntil;
  const ballColor = onFire ? FIRE_COLOR : theme.text;
  const shake =
    now < fx.shakeUntil
      ? [
          { translateX: (Math.random() - 0.5) * 8 },
          { translateY: (Math.random() - 0.5) * 8 },
        ]
      : [];
  const px = (v: number) => v * scale;

  const stat = (label: string, value: string) => (
    <RNView
      style={[
        styles.statBox,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.mutedText }]}>
        {label}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
    </RNView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RNView style={styles.topBar}>
        <RNView style={styles.statsRow}>
          {stat(t("bbScore"), String(game.score))}
          {stat(t("bbLevel"), String(game.level))}
          {stat(t("bbLives"), `❤️ ${String(Math.max(0, game.lives))}`)}
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={() => (paused ? resume() : pause())}
          onReset={() => {
            quitRun();
            startGame();
          }}
        />
      </RNView>

      <RNView
        onLayout={(e) =>
          setArea({
            h: e.nativeEvent.layout.height,
            w: e.nativeEvent.layout.width,
          })
        }
        style={styles.fieldArea}
      >
        {scale > 0 ? (
          <RNView
            onResponderGrant={onTouchMove}
            onResponderMove={onTouchMove}
            onResponderRelease={onTouchEnd}
            onResponderTerminationRequest={() => false}
            onStartShouldSetResponder={() => phase === "playing" && !paused}
            style={[
              styles.field,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                height: px(FIELD_H),
                transform: shake,
                width: px(FIELD_W),
              },
            ]}
          >
            <RNView pointerEvents="none" style={StyleSheet.absoluteFill}>
              {game.bricks.map((hp, i) => {
                if (hp === 0) {
                  return null;
                }
                const kind = game.kinds[i];
                const max = game.maxHp[i];
                const flashing = (fx.flash.get(i) ?? 0) > now;
                let label: string | null = null;
                if (kind === "bomb") {
                  label = "💣";
                } else if (kind === "mystery") {
                  label = "?";
                }
                return (
                  <RNView
                    key={`b${String(i)}`}
                    style={[
                      styles.brick,
                      {
                        backgroundColor: flashing
                          ? "#FFFFFF"
                          : boxColor(kind, max),
                        height: px(BRICK_H - BRICK_GAP),
                        left: px((i % COLS) * BRICK_W + BRICK_GAP / 2),
                        opacity: kind === "normal" && hp < max ? 0.78 : 1,
                        top: px(
                          BRICK_TOP +
                            Math.floor(i / COLS) * BRICK_H +
                            BRICK_GAP / 2
                        ),
                        width: px(BRICK_W - BRICK_GAP),
                      },
                    ]}
                  >
                    {label ? (
                      <Text
                        style={[styles.brickLabel, { fontSize: px(0.032) }]}
                      >
                        {label}
                      </Text>
                    ) : null}
                    {kind === "steel" ? (
                      <RNView style={styles.rivets}>
                        <RNView style={styles.rivet} />
                        <RNView style={styles.rivet} />
                      </RNView>
                    ) : null}
                    {kind === "normal" && max > 1 ? (
                      <RNView style={styles.pips}>
                        {Array.from({ length: max }, (_, k) => (
                          <RNView
                            key={k}
                            style={[
                              styles.pip,
                              { opacity: k < hp ? 0.95 : 0.25 },
                            ]}
                          />
                        ))}
                      </RNView>
                    ) : null}
                  </RNView>
                );
              })}
              {fx.debris.map((d, k) => (
                <RNView
                  key={`p${String(k)}`}
                  style={[
                    styles.debris,
                    {
                      backgroundColor: d.color,
                      left: px(d.x),
                      opacity: 1 - (now - d.born) / DEBRIS_MS,
                      top: px(d.y),
                    },
                  ]}
                />
              ))}
              {game.drops.map((d, i) => (
                <Text
                  key={`d${String(i)}`}
                  style={[
                    styles.drop,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.tint,
                      fontSize: px(0.04),
                      left: px(d.x - 0.035),
                      top: px(d.y - 0.03),
                    },
                  ]}
                >
                  {POWER_EMOJI[d.kind]}
                </Text>
              ))}
              <RNView
                style={[
                  styles.paddle,
                  {
                    backgroundColor: theme.tint,
                    height: px(PADDLE_H),
                    left: px(game.paddleX - padW / 2),
                    top: px(PADDLE_Y),
                    width: px(padW),
                  },
                ]}
              />
              {fx.trails.flatMap((trail, i) =>
                trail.slice(0, -1).map((p, k) => (
                  <RNView
                    key={`t${String(i)}-${String(k)}`}
                    style={[
                      styles.ball,
                      {
                        backgroundColor: ballColor,
                        borderRadius: px(BALL_R),
                        height: px(BALL_R * 2),
                        left: px(p.x - BALL_R),
                        opacity: ((k + 1) / TRAIL) * 0.35,
                        top: px(p.y - BALL_R),
                        width: px(BALL_R * 2),
                      },
                    ]}
                  />
                ))
              )}
              {game.balls.map((b, i) => (
                <RNView
                  key={`ball${String(i)}`}
                  style={[
                    styles.ball,
                    {
                      backgroundColor: ballColor,
                      borderRadius: px(BALL_R),
                      height: px(BALL_R * 2),
                      left: px(b.x - BALL_R),
                      top: px(b.y - BALL_R),
                      width: px(BALL_R * 2),
                    },
                  ]}
                />
              ))}
            </RNView>
            {banner || stuck ? (
              <RNView pointerEvents="none" style={styles.bannerWrap}>
                {banner ? (
                  <Text style={[styles.banner, { color: theme.tint }]}>
                    {banner}
                  </Text>
                ) : null}
                {stuck ? (
                  <Text style={[styles.hint, { color: theme.mutedText }]}>
                    {control === "tilt"
                      ? t("bbTapLaunchTilt")
                      : t("bbTapLaunch")}
                  </Text>
                ) : null}
              </RNView>
            ) : null}
          </RNView>
        ) : null}
      </RNView>

      <GamePauseOverlay
        onQuit={() => {
          quitRun();
          if (router.canGoBack()) {
            router.back();
          }
        }}
        onRestart={() => {
          quitRun();
          startGame();
        }}
        onResume={resume}
        visible={paused && phase === "playing"}
      />

      {phase === "over" && result ? (
        <GameResult
          best={result.best}
          isNewBest={result.isNewBest}
          last={result.previousBest}
          onPlayAgain={() => setPhase("menu")}
          score={game.score}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          subtitle={t("levelLabel", { level: game.level })}
          title={t("gameBoxBreakerName")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: { position: "absolute" },
  banner: { fontSize: FontSize["2xl"], fontWeight: FontWeight.black },
  bannerWrap: {
    alignItems: "center",
    gap: Spacing.sm,
    left: 0,
    position: "absolute",
    right: 0,
    top: "55%",
  },
  brick: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.3)",
    borderBottomWidth: 3,
    borderRadius: 5,
    borderTopColor: "rgba(255,255,255,0.35)",
    borderTopWidth: 1,
    justifyContent: "center",
    position: "absolute",
  },
  brickLabel: { color: "#FFFFFF", fontWeight: FontWeight.black },
  container: { flex: 1, gap: Spacing.sm, padding: Spacing.md },
  debris: { borderRadius: 2, height: 6, position: "absolute", width: 6 },
  drop: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 2,
    position: "absolute",
  },
  field: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  fieldArea: { alignItems: "center", flex: 1, justifyContent: "center" },
  hint: {
    ...TextStyle.hint,
    paddingHorizontal: Spacing.lg,
    textAlign: "center",
  },
  menu: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  menuEmoji: { fontSize: FontSize.xl },
  menuHint: { ...TextStyle.hint, textAlign: "center" },
  menuTitle: { fontSize: FontSize["3xl"], fontWeight: FontWeight.black },
  modeBtn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.button,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  modeDesc: { fontSize: FontSize.sm, textAlign: "center" },
  modeTitle: { ...TextStyle.buttonSecondary },
  paddle: { borderRadius: 8, position: "absolute" },
  pip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  pips: { flexDirection: "row", gap: 3 },
  playBtn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.button,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  playText: { ...TextStyle.buttonSecondary },
  rivet: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  rivets: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    width: "100%",
  },
  statBox: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statLabel: { ...TextStyle.statLabel },
  statsRow: { flex: 1, flexDirection: "row", gap: Spacing.xs },
  statValue: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  topBar: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
});
