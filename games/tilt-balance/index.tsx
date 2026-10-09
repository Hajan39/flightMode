import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GameResult from "@/components/GameResult";
import {
  MatchResult,
  PassDeviceOverlay,
  PlayerScoreStrip,
  PlayerSetup,
  TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";
import {
  applyGust,
  type BallState,
  deviceToScreenTilt,
  distanceFromCenter,
  gustIntervalMs,
  gustStrength,
  isOutOfBounds,
  ringRadius,
  START_STATE,
  scoreTurn,
  step,
} from "./logic";

const GAME_ID = "tilt-balance";
const SENSOR_INTERVAL_MS = 16;
type Phase =
  | "setup"
  | "pass"
  | "countdown"
  | "playing"
  | "turnEnd"
  | "done"
  | "unsupported";

/**
 * Turbulence Test — hold the phone flat and keep the ball inside the ring by
 * tilting. The ring shrinks and random gusts hit you the longer you survive.
 * Pass-and-play for 1–6; the only game in the app driven by the accelerometer.
 */
export default function TiltBalanceGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const updateProgress = useGameStore((s) => s.updateProgress);
  const { width } = useGameDimensions();
  const plateSize = Math.min(width - Spacing.lg * 2, 340);
  const plateRadius = plateSize / 2;

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [turnIndex, setTurnIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [ball, setBall] = useState<BallState>(START_STATE);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [inRing, setInRing] = useState(true);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  // Sensor + loop state lives in refs: the physics runs at 60 Hz and must not
  // re-create the subscription on every frame.
  const tiltRef = useRef({ x: 0, y: 0 });
  const ballRef = useRef<BallState>(START_STATE);
  const lastFrameRef = useRef(0);
  const startedAtRef = useRef(0);
  const nextGustRef = useRef(0);
  const streakStartRef = useRef<number | null>(null);
  const bestStreakRef = useRef(0);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const rotationSubRef = useRef<{ remove: () => void } | null>(null);
  // Display rotation (Surface degrees); tablets may be held any way round.
  const rotationRef = useRef(0);

  const solo = players.length === 1;
  const current = players[turnIndex] ?? players[0];

  const stopLoop = () => {
    if (frameRef.current) {
      clearInterval(frameRef.current);
    }
    frameRef.current = null;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    rotationSubRef.current?.remove();
    rotationSubRef.current = null;
  };

  useEffect(() => stopLoop, [stopLoop]);

  // Motion is unavailable on web and some simulators — fail soft, never crash.
  useEffect(() => {
    let cancelled = false;
    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!(cancelled || available)) {
          setPhase("unsupported");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase("unsupported");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    stopLoop();
    setPlayers(matchPlayers);
    setScores(new Array(matchPlayers.length).fill(0));
    setTurnIndex(0);
    setProgress(undefined);
    setPhase(matchPlayers.length === 1 ? "countdown" : "pass");
  };

  const beginTurn = () => {
    ballRef.current = START_STATE;
    setBall(START_STATE);
    setElapsedMs(0);
    setInRing(true);
    bestStreakRef.current = 0;
    streakStartRef.current = null;
    startedAtRef.current = Date.now();
    lastFrameRef.current = Date.now();
    nextGustRef.current = Date.now() + gustIntervalMs(0);

    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    // DeviceMotion is only used for its `orientation` (display rotation) so
    // the accelerometer's device-fixed axes can be mapped to screen axes.
    DeviceMotion.setUpdateInterval(500);
    rotationSubRef.current = DeviceMotion.addListener(({ orientation }) => {
      rotationRef.current = orientation;
    });
    subscriptionRef.current = Accelerometer.addListener(({ x, y }) => {
      // Phone flat, screen up: +x tilts right, -y tilts "down" the screen.
      const screen = deviceToScreenTilt(x, y, rotationRef.current);
      tiltRef.current = {
        x: Math.max(-1, Math.min(1, screen.x)),
        y: Math.max(-1, Math.min(1, screen.y)),
      };
    });

    frameRef.current = setInterval(tick, SENSOR_INTERVAL_MS);
    setPhase("playing");
  };

  const tick = () => {
    const now = Date.now();
    const dtMs = now - lastFrameRef.current;
    lastFrameRef.current = now;
    const elapsed = now - startedAtRef.current;

    let next = step(
      ballRef.current,
      tiltRef.current.x,
      tiltRef.current.y,
      dtMs
    );
    if (now >= nextGustRef.current) {
      next = applyGust(next, gustStrength(elapsed));
      nextGustRef.current = now + gustIntervalMs(elapsed);
      haptic.tap();
    }
    ballRef.current = next;

    const inside = distanceFromCenter(next) <= ringRadius(elapsed);
    if (inside && streakStartRef.current === null) {
      streakStartRef.current = now;
    } else if (!inside && streakStartRef.current !== null) {
      bestStreakRef.current = Math.max(
        bestStreakRef.current,
        now - streakStartRef.current
      );
      streakStartRef.current = null;
    }

    setBall(next);
    setElapsedMs(elapsed);
    setInRing(inside);

    if (isOutOfBounds(next)) {
      endTurn(elapsed);
    }
  };

  const endTurn = (survivedMs: number) => {
    stopLoop();
    haptic.error();
    if (streakStartRef.current !== null) {
      bestStreakRef.current = Math.max(
        bestStreakRef.current,
        Date.now() - streakStartRef.current
      );
      streakStartRef.current = null;
    }
    const turnScore = scoreTurn(survivedMs, bestStreakRef.current);
    setScores((prev) => {
      const nextScores = [...prev];
      nextScores[turnIndex] = turnScore;
      return nextScores;
    });
    setPhase("turnEnd");
  };

  const nextTurn = () => {
    haptic.tap();
    const next = turnIndex + 1;
    if (next >= players.length) {
      if (solo) {
        setProgress(updateProgress(GAME_ID, scores[0], { won: scores[0] > 0 }));
      } else {
        setProgress(
          recordMatch(
            GAME_ID,
            scores.map((score) => ({ score }))
          )
        );
      }
      setPhase("done");
      return;
    }
    setTurnIndex(next);
    setPhase("pass");
  };

  if (phase === "unsupported") {
    return (
      <View style={styles.centered}>
        <Ionicons
          color={theme.mutedText}
          name="phone-portrait-outline"
          size={40}
        />
        <Text style={[styles.unsupported, { color: theme.mutedText }]}>
          {t("tbNoSensor")}
        </Text>
      </View>
    );
  }

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={1}
        onStart={startMatch}
        subtitle={t("tbIntro")}
        title={t("gameTiltBalanceName")}
      />
    );
  }

  const radius = ringRadius(elapsedMs);
  const seconds = (elapsedMs / 1000).toFixed(1);
  const ballColor = inRing ? (current?.color ?? theme.tint) : theme.danger;

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        {current ? (
          <TurnBanner
            compact
            label={solo ? t("tbKeepItSteady") : undefined}
            player={current}
            right={
              <Text
                style={[
                  styles.timer,
                  { color: inRing ? theme.tint : theme.danger },
                ]}
              >
                {seconds}s
              </Text>
            }
          />
        ) : null}
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      {solo ? null : (
        <PlayerScoreStrip
          activeIndex={phase === "playing" ? turnIndex : undefined}
          players={players}
          scores={scores}
        />
      )}

      <RNView style={styles.plateArea}>
        <RNView
          style={[
            styles.plate,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: plateRadius,
              height: plateSize,
              width: plateSize,
            },
          ]}
        >
          {/* Target ring — shrinks as the turn goes on. */}
          <RNView
            style={[
              styles.ring,
              {
                borderColor: inRing ? theme.successBorder : theme.danger,
                borderRadius: (plateSize * radius) / 2,
                height: plateSize * radius,
                width: plateSize * radius,
              },
            ]}
          />
          <RNView
            style={[
              styles.ball,
              {
                backgroundColor: ballColor,
                transform: [
                  { translateX: ball.x * plateRadius },
                  { translateY: ball.y * plateRadius },
                ],
              },
            ]}
          />
        </RNView>
        <Text style={[styles.hint, { color: theme.mutedText }]}>
          {phase === "playing" ? t("tbHint") : t("tbHoldFlat")}
        </Text>
      </RNView>

      {phase === "turnEnd" ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.turnEnd}>
          <Text
            style={[styles.turnScore, { color: current?.color ?? theme.tint }]}
          >
            {scores[turnIndex]}
          </Text>
          <Text style={[styles.turnText, { color: theme.mutedText }]}>
            {t("tbSurvived", { seconds })}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={nextTurn}
            style={[styles.nextBtn, { backgroundColor: theme.tint }]}
          >
            <Text style={[styles.nextText, { color: theme.onTint }]}>
              {turnIndex + 1 >= players.length
                ? t("hmSeeResult")
                : t("hmNextRound")}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {current ? (
        <PassDeviceOverlay
          hint={t("tbHoldFlat")}
          onReady={() => setPhase("countdown")}
          toPlayer={current}
          visible={phase === "pass"}
        />
      ) : null}
      {phase === "countdown" ? <GameCountdown onComplete={beginTurn} /> : null}

      {phase === "done" && solo ? (
        <GameResult
          best={progress?.best}
          isNewBest={progress?.isNewBest}
          last={progress?.previousBest}
          onPlayAgain={() => startMatch(players)}
          score={scores[0]}
          streak={progress?.currentStreak}
          title={t("gameTiltBalanceName")}
        />
      ) : null}
      {phase === "done" && !solo ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={t("tbPoints")}
          standings={players.map((p, i) => ({ player: p, score: scores[i] }))}
          winnerIndex={getSoleWinnerIndex(scores.map((score) => ({ score })))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: { borderRadius: 17, height: 34, width: 34 },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
    padding: Spacing["2xl"],
  },
  hint: {
    ...TextStyle.hint,
    paddingHorizontal: Spacing.lg,
    textAlign: "center",
  },
  nextBtn: {
    borderRadius: Radius.button,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.md + 2,
  },
  nextText: { ...TextStyle.buttonSecondary },
  plate: {
    alignItems: "center",
    borderWidth: 2,
    justifyContent: "center",
  },
  plateArea: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.lg,
    justifyContent: "center",
  },
  ring: { borderStyle: "dashed", borderWidth: 2, position: "absolute" },
  root: {
    flex: 1,
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  timer: { fontSize: FontSize.base, fontWeight: FontWeight.black },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  turnEnd: { alignItems: "center", gap: Spacing.xs },
  turnScore: { fontSize: FontSize["4xl"], fontWeight: FontWeight.black },
  turnText: { ...TextStyle.hint },
  unsupported: { ...TextStyle.hint, lineHeight: 20, textAlign: "center" },
});
