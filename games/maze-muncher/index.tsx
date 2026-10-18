import { useRouter } from "expo-router";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Platform,
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
import { gravityTilt } from "@/games/tilt-balance/logic";
import { useHaptic } from "@/hooks/useHaptic";
import { swipeDirection } from "@/hooks/useSwipe";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  COLS,
  type Dir,
  type Ghost,
  MAZE,
  type MazeState,
  newGame,
  position,
  ROWS,
  steer,
  step,
} from "./logic";

const GAME_ID = "maze-muncher";
const FRAME_MS = 16;
const READY_MS = 1600;
/** Tilt past this (≈ 15°) on the dominant axis steers. */
const TILT_THRESHOLD = 0.26;

type Phase = "menu" | "playing" | "over";
type Control = "swipe" | "tilt";

const WALL = "#3B82F6";
const PLAYER = "#FACC15";
const GHOST_COLORS = ["#EF4444", "#F472B6", "#22D3EE", "#FB923C"];
const FRIGHTENED = "#1D4ED8";
const FRIGHT_FLASH = "#E2E8F0";
const ROTATION: Record<Dir, string> = {
  down: "90deg",
  left: "180deg",
  right: "0deg",
  up: "270deg",
};

const isWall = (x: number, y: number) =>
  x < 0 || x >= COLS || y < 0 || y >= ROWS || MAZE[y][x] === "#";

/** A wall cell is drawn only when it borders open space, so thick blocks become outlines. */
const OUTLINE = MAZE.map((row, y) =>
  [...row].map((_, x) => {
    if (!isWall(x, y)) {
      return false;
    }
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!isWall(x + dx, y + dy)) {
          return true;
        }
      }
    }
    return false;
  })
);

/** Static maze walls drawn as thin pipes; re-renders only when the cell size changes. */
function Walls({ cell }: { cell: number }) {
  const t = Math.max(2, Math.round(cell * 0.3));
  const off = (cell - t) / 2;
  const parts: React.ReactNode[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!OUTLINE[y][x]) {
        continue;
      }
      const left = x * cell + off;
      const top = y * cell + off;
      parts.push(
        <RNView
          key={`c${String(x)}-${String(y)}`}
          style={[styles.wall, { height: t, left, top, width: t }]}
        />
      );
      if (x + 1 < COLS && OUTLINE[y][x + 1]) {
        parts.push(
          <RNView
            key={`h${String(x)}-${String(y)}`}
            style={[styles.wall, { height: t, left, top, width: cell + t }]}
          />
        );
      }
      if (y + 1 < ROWS && OUTLINE[y + 1][x]) {
        parts.push(
          <RNView
            key={`v${String(x)}-${String(y)}`}
            style={[styles.wall, { height: cell + t, left, top, width: t }]}
          />
        );
      }
    }
  }
  return <>{parts}</>;
}

/** Dots and power dots; re-renders only when one is eaten (new Set identity). */
function Dots({
  cell,
  color,
  dots,
  powers,
}: {
  cell: number;
  color: string;
  dots: Set<number>;
  powers: Set<number>;
}) {
  const dot = Math.max(3, Math.round(cell * 0.2));
  const big = Math.round(cell * 0.55);
  const view = (i: number, size: number) => (
    <RNView
      key={`d${String(i)}`}
      style={[
        styles.dot,
        {
          backgroundColor: color,
          borderRadius: size / 2,
          height: size,
          left: (i % COLS) * cell + (cell - size) / 2,
          top: Math.floor(i / COLS) * cell + (cell - size) / 2,
          width: size,
        },
      ]}
    />
  );
  return (
    <>
      {[...dots].map((i) => view(i, dot))}
      {[...powers].map((i) => view(i, big))}
    </>
  );
}

function GhostView({
  cell,
  color,
  ghost,
}: {
  cell: number;
  color: string;
  ghost: Ghost;
}) {
  const size = cell * 0.9;
  const p = position(ghost);
  const look = ghost.dir
    ? { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] }[ghost.dir]
    : [0, 0];
  const eye = size * 0.3;
  const pupil = eye * 0.5;
  // Frightened ghosts show no eyes.
  const eyes = (ghost.mode === "frightened" ? [] : [0.22, 0.52]).map((fx) => (
    <RNView
      key={fx}
      style={[
        styles.eye,
        {
          borderRadius: eye / 2,
          height: eye,
          left: size * fx,
          top: size * 0.25,
          width: eye,
        },
      ]}
    >
      <RNView
        style={[
          styles.pupil,
          {
            borderRadius: pupil / 2,
            height: pupil,
            left: (eye - pupil) / 2 + look[0] * pupil * 0.45,
            top: (eye - pupil) / 2 + look[1] * pupil * 0.45,
            width: pupil,
          },
        ]}
      />
    </RNView>
  ));
  return (
    <RNView
      style={[
        styles.ghost,
        {
          backgroundColor: ghost.mode === "eyes" ? "transparent" : color,
          borderTopLeftRadius: size / 2,
          borderTopRightRadius: size / 2,
          height: size,
          left: p.x * cell + (cell - size) / 2,
          top: p.y * cell + (cell - size) / 2,
          width: size,
        },
      ]}
    >
      {eyes}
    </RNView>
  );
}

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
 * Maze Muncher — eat every dot, dodge the ghosts, turn the tables with a
 * power dot. Swipe anywhere to steer, or tilt the phone.
 */
export default function MazeMuncherGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const router = useRouter();
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("menu");
  const [control, setControl] = useState<Control>("swipe");
  const [tiltAvailable, setTiltAvailable] = useState(false);
  const [game, setGame] = useState<MazeState>(() => newGame());
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [area, setArea] = useState<{ h: number; w: number } | null>(null);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);
  const [clock, setClock] = useState(0);

  const gameRef = useRef(game);
  const lastFrameRef = useRef(0);
  const readyUntil = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationRef = useRef(0);
  const sensorSubs = useRef<{ remove: () => void }[]>([]);
  const swipeStart = useRef({ x: 0, y: 0 });

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

  useEffect(() => () => haltLoop(loopRef, sensorSubs), []);

  const getReady = () => {
    readyUntil.current = Date.now() + READY_MS;
    setReady(true);
  };

  const tick = () => {
    const now = Date.now();
    const dt = now - lastFrameRef.current;
    lastFrameRef.current = now;
    setClock(now);
    if (now < readyUntil.current) {
      return;
    }
    setReady(false);
    const { events, state } = step(gameRef.current, dt, Math.random);
    gameRef.current = state;
    setGame(state);
    if (events.atePower) {
      haptic.success();
    }
    if (events.ateGhost) {
      haptic.heavy();
    }
    if (events.cleared) {
      haptic.success();
      getReady();
    }
    if (events.over) {
      stopLoop();
      haptic.error();
      setResult(updateProgress(GAME_ID, state.score, { won: state.level > 1 }));
      setPhase("over");
    } else if (events.died) {
      haptic.error();
      getReady();
    }
  };

  const steerTo = (dir: Dir) => {
    if (gameRef.current.queued !== dir) {
      gameRef.current = steer(gameRef.current, dir);
    }
  };

  const startLoop = () => {
    stopLoop();
    lastFrameRef.current = Date.now();
    if (control === "tilt") {
      Accelerometer.setUpdateInterval(50);
      DeviceMotion.setUpdateInterval(500);
      sensorSubs.current = [
        DeviceMotion.addListener(({ orientation }) => {
          rotationRef.current = orientation;
        }),
        Accelerometer.addListener(({ x, y }) => {
          const s = gravityTilt(
            x,
            y,
            rotationRef.current,
            Platform.OS === "android"
          );
          if (Math.max(Math.abs(s.x), Math.abs(s.y)) < TILT_THRESHOLD) {
            return;
          }
          if (Math.abs(s.x) > Math.abs(s.y)) {
            steerTo(s.x > 0 ? "right" : "left");
          } else {
            steerTo(s.y > 0 ? "down" : "up");
          }
        }),
      ];
    }
    loopRef.current = setInterval(tick, FRAME_MS);
  };

  const startGame = () => {
    haptic.tap();
    const fresh = newGame();
    gameRef.current = fresh;
    setGame(fresh);
    setResult(null);
    setPaused(false);
    setPhase("playing");
    getReady();
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

  // Swipe: a new direction every ~20 px of travel, so one long drag can turn twice.
  const onSwipeGrant = (e: GestureResponderEvent) => {
    swipeStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const onSwipeMove = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const dir = swipeDirection(
      pageX - swipeStart.current.x,
      pageY - swipeStart.current.y
    );
    if (dir) {
      steerTo(dir);
      swipeStart.current = { x: pageX, y: pageY };
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
        <Text style={styles.menuTitle}>{t("gameMazeMuncherName")}</Text>
        <Text style={styles.menuEmoji}>🟡 • • • 👻</Text>
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("bbChooseControl")}
        </Text>
        {option("swipe", t("mmSwipe"), t("mmSwipeHint"))}
        {tiltAvailable ? option("tilt", t("bbTilt"), t("mmTiltHint")) : null}
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

  /* -------------------------------------------------------------- board */

  const cell = area ? Math.floor(Math.min(area.w / COLS, area.h / ROWS)) : 0;
  const pp = position(game.player);
  const playerSize = cell * 0.84;
  // Chomp: the mouth opens and closes while moving.
  const mouth = game.player.dir
    ? playerSize * (0.08 + 0.28 * Math.abs(Math.sin(clock / 70)))
    : playerSize * 0.2;
  const flash =
    game.frightMs > 0 &&
    game.frightMs < 2000 &&
    Math.floor(clock / 220) % 2 === 0;

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
    <View
      onResponderGrant={onSwipeGrant}
      onResponderMove={onSwipeMove}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={() => phase === "playing" && !paused}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
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
        pointerEvents="none"
        style={styles.boardArea}
      >
        {cell > 0 ? (
          <RNView
            style={[styles.board, { height: cell * ROWS, width: cell * COLS }]}
          >
            <Walls cell={cell} />
            <Dots
              cell={cell}
              color={theme.text}
              dots={game.dots}
              powers={game.powers}
            />
            {game.ghosts.map((g, i) => {
              let color = GHOST_COLORS[i];
              if (g.mode === "frightened") {
                color = flash ? FRIGHT_FLASH : FRIGHTENED;
              }
              return (
                <GhostView
                  cell={cell}
                  color={color}
                  ghost={g}
                  key={`g${String(i)}`}
                />
              );
            })}
            <RNView
              style={[
                styles.player,
                {
                  borderRadius: playerSize / 2,
                  height: playerSize,
                  left: pp.x * cell + (cell - playerSize) / 2,
                  top: pp.y * cell + (cell - playerSize) / 2,
                  transform: [
                    {
                      rotate:
                        ROTATION[game.player.dir ?? game.queued ?? "right"],
                    },
                  ],
                  width: playerSize,
                },
              ]}
            >
              <RNView
                style={[
                  styles.mouth,
                  {
                    borderBottomWidth: mouth,
                    borderRightWidth: playerSize / 2 + 1,
                    borderTopWidth: mouth,
                    left: playerSize / 2,
                    top: playerSize / 2 - mouth,
                  },
                ]}
              />
            </RNView>
            {ready ? (
              <RNView style={[styles.readyWrap, { top: cell * 11 }]}>
                <Text style={[styles.ready, { fontSize: cell * 0.9 }]}>
                  {t("mmReady")}
                </Text>
              </RNView>
            ) : null}
          </RNView>
        ) : null}
      </RNView>
      <Text style={[styles.hint, { color: theme.mutedText }]}>
        {control === "tilt" ? t("mmTiltHint") : t("mmSwipeHint")}
      </Text>

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
          title={t("gameMazeMuncherName")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: "#0B1220", borderRadius: 8, overflow: "hidden" },
  boardArea: { alignItems: "center", flex: 1, justifyContent: "center" },
  container: { flex: 1, gap: Spacing.sm, padding: Spacing.md },
  dot: { position: "absolute" },
  eye: { backgroundColor: "#FFFFFF", position: "absolute" },
  ghost: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    position: "absolute",
  },
  hint: { ...TextStyle.hint, textAlign: "center" },
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
  mouth: {
    borderBottomColor: "transparent",
    borderRightColor: "#0B1220",
    borderTopColor: "transparent",
    height: 0,
    position: "absolute",
    width: 0,
  },
  playBtn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.button,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  player: { backgroundColor: PLAYER, overflow: "hidden", position: "absolute" },
  playText: { ...TextStyle.buttonSecondary },
  pupil: { backgroundColor: "#1E3A8A", position: "absolute" },
  ready: { color: PLAYER, fontWeight: FontWeight.black },
  readyWrap: { alignItems: "center", left: 0, position: "absolute", right: 0 },
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
  wall: { backgroundColor: WALL, borderRadius: 3, position: "absolute" },
});
