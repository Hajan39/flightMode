import { useEffect, useRef, useState } from "react";
import { FlatList, View as RNView, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

type Runway = "A" | "B" | "C";

interface Flight {
  callsign: string;
  expiresAt: number;
  fuel: number;
  id: number;
  maxFuel: number;
  runway: Runway;
}

const RUNWAYS: Runway[] = ["A", "B", "C"];
const MAX_MISSES = 3;
const MAX_LEVEL = 6;

const RUNWAY_COLORS: Record<Runway, string> = {
  A: "#3b82f6",
  B: "#f59e0b",
  C: "#10b981",
};

function randomRunway(): Runway {
  return RUNWAYS[Math.floor(Math.random() * RUNWAYS.length)];
}

function createCallsign(id: number) {
  const prefixes = ["FM", "SKY", "JET", "AT", "AIR"];
  const prefix = prefixes[id % prefixes.length];
  return `${prefix}-${100 + (id % 900)}`;
}

function getLevel(landed: number) {
  return Math.min(MAX_LEVEL, Math.floor(landed / 5) + 1);
}

function getSpawnInterval(level: number) {
  return Math.max(1100, 4200 - (level - 1) * 500);
}

function getMaxQueueSize(level: number) {
  return Math.min(10, 5 + Math.floor(level / 2));
}

function getStartingFuel(level: number, id: number) {
  const baseFuel = Math.max(3, 7 - Math.floor((level - 1) / 2));
  return baseFuel + (id % 3);
}

function FuelBar({
  fuel,
  maxFuel,
  theme,
}: {
  fuel: number;
  maxFuel: number;
  theme: (typeof Colors)[keyof typeof Colors];
}) {
  const ratio = Math.max(0, fuel / maxFuel);
  const width = useSharedValue(ratio);

  useEffect(() => {
    width.value = withTiming(ratio, { duration: 600 });
  }, [ratio, width]);

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor:
      ratio > 0.5
        ? theme.successBorder
        : ratio > 0.25
          ? theme.warning
          : theme.danger,
    width: `${width.value * 100}%`,
  }));

  return (
    <View darkColor="#1f2937" lightColor="#e5e7eb" style={styles.fuelTrack}>
      <Animated.View style={[styles.fuelBar, barStyle]} />
    </View>
  );
}

function FlightCard({
  item,
  onAssign,
  theme,
  t,
}: {
  item: Flight;
  onAssign: (id: number, runway: Runway) => void;
  theme: (typeof Colors)[keyof typeof Colors];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const fuelRatio = item.fuel / item.maxFuel;
  const isCritical = fuelRatio <= 0.35;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutLeft.duration(250)}
      layout={LinearTransition.duration(200)}
    >
      <View
        style={[
          styles.flightCard,
          {
            backgroundColor: theme.elevated,
            borderColor: isCritical ? theme.danger : theme.border,
          },
        ]}
      >
        {/* Left accent bar colored by target runway */}
        <View
          style={[
            styles.runwayAccent,
            { backgroundColor: RUNWAY_COLORS[item.runway] },
          ]}
        />

        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.cardInner}
        >
          {/* Top row: callsign + fuel label */}
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.flightTop}
          >
            <Text style={styles.callsign}>{item.callsign}</Text>
            <Text
              style={[
                styles.fuelText,
                { color: isCritical ? theme.danger : theme.mutedText },
              ]}
            >
              {t("atcFuel", { fuel: item.fuel })}
            </Text>
          </View>

          {/* Fuel bar */}
          <FuelBar fuel={item.fuel} maxFuel={item.maxFuel} theme={theme} />

          {/* Target runway label */}
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.targetRow}
          >
            <View
              darkColor="transparent"
              lightColor="transparent"
              style={[
                styles.targetBadge,
                { backgroundColor: `${RUNWAY_COLORS[item.runway]}22` },
              ]}
            >
              <View
                style={[
                  styles.targetDot,
                  { backgroundColor: RUNWAY_COLORS[item.runway] },
                ]}
              />
              <Text
                style={[
                  styles.targetRunway,
                  { color: RUNWAY_COLORS[item.runway] },
                ]}
              >
                {t("atcTargetRunway", { rwy: item.runway })}
              </Text>
            </View>
          </View>

          {/* Runway assignment buttons */}
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.runwayRow}
          >
            {RUNWAYS.map((runway) => {
              const isTarget = runway === item.runway;
              return (
                <AnimatedPressable
                  accessibilityLabel={t("atcRwy", { rwy: runway })}
                  accessibilityRole="button"
                  key={runway}
                  onPress={() => onAssign(item.id, runway)}
                  scaleTo={0.93}
                  style={[
                    styles.runwayChip,
                    {
                      backgroundColor: isTarget
                        ? `${RUNWAY_COLORS[runway]}22`
                        : theme.card,
                      borderColor: RUNWAY_COLORS[runway],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.runwayChipText,
                      { color: RUNWAY_COLORS[runway] },
                    ]}
                  >
                    {t("atcRwy", { rwy: runway })}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function AirTrafficControlGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore(
    (s) => s.progress["air-traffic-control"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [score, setScore] = useState(0);
  const [landed, setLanded] = useState(0);
  const [misses, setMisses] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );
  const flightIdRef = useRef(1);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const missesRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const level = getLevel(landed);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    missesRef.current = misses;
  }, [misses]);

  /* --- subtle feedback animations (discrete events only) --- */
  const scoreScale = useSharedValue(1);
  const heartsShake = useSharedValue(0);

  useEffect(() => {
    if (score === 0) {
      return;
    }
    scoreScale.value = withSequence(
      withTiming(1.18, { duration: 100 }),
      withTiming(1, { duration: 140 })
    );
  }, [score, scoreScale]);

  useEffect(() => {
    if (misses === 0) {
      return;
    }
    heartsShake.value = withSequence(
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(-3, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  }, [misses, heartsShake]);

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));
  const heartsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: heartsShake.value }],
  }));

  const spawnInterval = getSpawnInterval(level);
  const maxQueueSize = getMaxQueueSize(level);

  useEffect(() => {
    if (gameOver || paused) {
      return;
    }

    const timer = setInterval(() => {
      setFlights((prev) => {
        if (prev.length >= maxQueueSize) {
          return prev;
        }
        const id = flightIdRef.current;
        flightIdRef.current += 1;
        const startFuel = getStartingFuel(level, id);
        const now = Date.now();
        return [
          ...prev,
          {
            callsign: createCallsign(id),
            expiresAt: now + startFuel * 1000,
            fuel: startFuel,
            id,
            maxFuel: startFuel,
            runway: randomRunway(),
          },
        ];
      });
    }, spawnInterval);

    return () => clearInterval(timer);
  }, [gameOver, spawnInterval, maxQueueSize, level, paused]);

  useEffect(() => {
    if (gameOver || paused) {
      return;
    }

    const timer = setInterval(() => {
      setFlights((prev) => {
        const now = Date.now();
        let lostThisTick = 0;
        const nextFlights: Flight[] = [];
        let changed = false;

        for (const flight of prev) {
          const nextFuel = Math.max(
            0,
            Math.ceil((flight.expiresAt - now) / 1000)
          );
          if (nextFuel <= 0) {
            lostThisTick += 1;
            changed = true;
          } else {
            if (nextFuel !== flight.fuel) {
              changed = true;
            }
            nextFlights.push(
              nextFuel === flight.fuel ? flight : { ...flight, fuel: nextFuel }
            );
          }
        }

        if (lostThisTick > 0) {
          setMisses((currentMisses) => {
            const nextMisses = currentMisses + lostThisTick;
            if (nextMisses >= MAX_MISSES && !gameOverRef.current) {
              gameOverRef.current = true;
              setGameOver(true);
              setProgressInfo(
                updateProgress("air-traffic-control", scoreRef.current)
              );
            }
            return nextMisses;
          });
        }

        return changed ? nextFlights : prev;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [gameOver, updateProgress, paused]);

  const pause = () => {
    pauseStartedAtRef.current = Date.now();
    setPaused(true);
  };

  const resume = () => {
    const pauseStartedAt = pauseStartedAtRef.current;
    pauseStartedAtRef.current = null;
    if (pauseStartedAt) {
      const pausedMs = Date.now() - pauseStartedAt;
      setFlights((prev) =>
        prev.map((flight) => ({
          ...flight,
          expiresAt: flight.expiresAt + pausedMs,
        }))
      );
    }
    setPaused(false);
  };

  const restart = () => {
    flightIdRef.current = 1;
    gameOverRef.current = false;
    setFlights([]);
    setScore(0);
    setLanded(0);
    setMisses(0);
    setGameOver(false);
    setPaused(false);
    pauseStartedAtRef.current = null;
    setProgressInfo(null);
  };

  const assignRunway = (flightId: number, runway: Runway) => {
    if (gameOver) {
      return;
    }

    let resolved = false;
    let points = 0;
    let wrong = false;

    setFlights((prev) =>
      prev.filter((flight) => {
        if (flight.id !== flightId) {
          return true;
        }
        resolved = true;
        if (flight.runway === runway) {
          const currentFuel = Math.max(
            0,
            Math.ceil((flight.expiresAt - Date.now()) / 1000)
          );
          points = 18 + currentFuel * 3 + level * 2;
        } else {
          wrong = true;
        }
        return false;
      })
    );

    if (!resolved) {
      return;
    }

    if (wrong) {
      haptic.error();
      setMisses((currentMisses) => {
        const nextMisses = currentMisses + 1;
        if (nextMisses >= MAX_MISSES && !gameOverRef.current) {
          gameOverRef.current = true;
          setGameOver(true);
          setProgressInfo(
            updateProgress("air-traffic-control", scoreRef.current)
          );
        }
        return nextMisses;
      });
      return;
    }

    setScore((prev) => prev + points);
    haptic.success();
    setLanded((prev) => prev + 1);
  };

  const pressureLabel =
    level <= 2
      ? t("atcLightTraffic")
      : level <= 4
        ? t("atcBusyAirspace")
        : t("atcPeakTraffic");

  const missHearts = Array.from({ length: MAX_MISSES }, (_, i) =>
    i < misses ? "💥" : "✈️"
  );

  return (
    <View style={styles.root}>
      {/* Top: best + controls */}
      <RNView style={styles.topRow}>
        <RNView style={[styles.bestPill, { backgroundColor: theme.card }]}>
          <Text style={[styles.bestLabel, { color: theme.mutedText }]}>
            {t("gameBest")}
          </Text>
          <Text style={[styles.bestValue, { color: theme.tint }]}>
            {storedBest}
          </Text>
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={gameOver ? undefined : pause}
          onReset={restart}
        />
      </RNView>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("atcLanded")}
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {landed}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("atcScore")}
          </Text>
          <Animated.View style={scoreStyle}>
            <Text style={[styles.statValue, { color: theme.tint }]}>
              {score}
            </Text>
          </Animated.View>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("atcMisses")}
          </Text>
          <Animated.View style={heartsStyle}>
            <Text style={styles.heartRow}>{missHearts.join(" ")}</Text>
          </Animated.View>
        </View>
      </View>

      {/* Header card */}
      <View
        style={[
          styles.headerCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.headerRow}
        >
          <Text style={[styles.headerEyebrow, { color: theme.mutedText }]}>
            {`${pressureLabel} · L${level}`}
          </Text>
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.runwayLegend}
          >
            {RUNWAYS.map((rwy) => (
              <View
                darkColor="transparent"
                key={rwy}
                lightColor="transparent"
                style={styles.legendItem}
              >
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: RUNWAY_COLORS[rwy] },
                  ]}
                />
                <Text style={[styles.legendText, { color: theme.mutedText }]}>
                  {rwy}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("atcAssignHint")}
        </Text>
      </View>

      {/* Flight queue */}
      <FlatList
        contentContainerStyle={styles.queue}
        data={flights}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>
              {t("atcQueueEmpty")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FlightCard
            item={item}
            onAssign={assignRunway}
            t={t as never}
            theme={theme}
          />
        )}
      />

      {gameOver && (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={score}
          streak={progressInfo?.currentStreak}
          subtitle={t("atcGameOverSubtitle", { landed, score })}
          title={t("atcGameOver")}
        />
      )}

      <GamePauseOverlay
        onRestart={restart}
        onResume={resume}
        visible={paused}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bestLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bestPill: {
    alignItems: "baseline",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bestValue: { fontSize: 16, fontWeight: "900" },
  callsign: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  cardInner: {
    flex: 1,
    gap: 10,
    padding: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  flightCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    overflow: "hidden",
  },
  flightTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fuelBar: {
    borderRadius: 3,
    height: 6,
  },
  fuelText: { fontSize: 12, fontWeight: "700" },
  fuelTrack: {
    borderRadius: 3,
    height: 6,
    overflow: "hidden",
  },
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  heartRow: { fontSize: 18, letterSpacing: 2 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  legendText: { fontSize: 11, fontWeight: "700" },
  queue: { gap: 10, paddingBottom: 8 },
  root: { flex: 1, gap: 14, padding: 20 },
  runwayAccent: {
    width: 5,
  },
  runwayChip: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    paddingVertical: 10,
  },
  runwayChipText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  runwayLegend: { flexDirection: "row", gap: 10 },
  runwayRow: { flexDirection: "row", gap: 8 },
  statBlock: { alignItems: "center", flex: 1, gap: 2, paddingVertical: 4 },
  statDivider: { height: 52, width: 1 },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  statValue: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  targetBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  targetDot: { borderRadius: 4, height: 7, width: 7 },
  targetRow: { flexDirection: "row" },
  targetRunway: { fontSize: 12, fontWeight: "700" },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
