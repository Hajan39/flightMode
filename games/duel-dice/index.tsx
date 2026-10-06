import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  View as RNView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import {
  MatchResult,
  PlayerScoreStrip,
  PlayerSetup,
  TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

const ROUNDS = 10;
const GAME_ID = "duel-dice";

const FACE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const PIP_KEYS = [
  "p0",
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "p7",
  "p8",
] as const;

type Phase = "setup" | "playing" | "done";

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** Match score used for ranking: wins dominate, total pips break ties. */
function matchScore(wins: number, total: number) {
  return wins * 10 + total;
}

export default function DuelDiceGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width } = useWindowDimensions();
  const dieSize = Math.min(width * 0.52, 240);

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [round, setRound] = useState(1);
  const [activePlayer, setActivePlayer] = useState(0);
  const [totals, setTotals] = useState<number[]>([]);
  const [roundWins, setRoundWins] = useState<number[]>([]);
  const [currentRolls, setCurrentRolls] = useState<(number | null)[]>([]);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  // Mirrors of the arrays for the timeout callbacks (avoids stale closures).
  const totalsRef = useRef<number[]>([]);
  const winsRef = useRef<number[]>([]);

  const dieScale = useSharedValue(1);
  const dieRotate = useSharedValue(0);
  const dieAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dieScale.value }, { rotate: `${dieRotate.value}deg` }],
  }));

  const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (rollingIntervalRef.current) {
      clearInterval(rollingIntervalRef.current);
    }
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
    if (roundTransitionRef.current) {
      clearTimeout(roundTransitionRef.current);
    }
    rollingIntervalRef.current = null;
    settleTimeoutRef.current = null;
    roundTransitionRef.current = null;
  };

  useEffect(() => clearTimers, [clearTimers]);

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    clearTimers();
    const zeros = new Array(matchPlayers.length).fill(0) as number[];
    totalsRef.current = [...zeros];
    winsRef.current = [...zeros];
    setPlayers(matchPlayers);
    setTotals([...zeros]);
    setRoundWins([...zeros]);
    setCurrentRolls(new Array(matchPlayers.length).fill(null));
    setRound(1);
    setActivePlayer(0);
    setRollingValue(null);
    setIsRolling(false);
    setRoundResult(null);
    setProgress(undefined);
    setPhase("playing");
  };

  const finishMatch = () => {
    const standings = players.map((_, i) => ({
      score: matchScore(winsRef.current[i], totalsRef.current[i]),
    }));
    setProgress(recordMatch(GAME_ID, standings));
    setPhase("done");
  };

  const finalizeRoll = (finalRoll: number) => {
    setRollingValue(finalRoll);
    setIsRolling(false);

    dieScale.value = withSequence(
      withTiming(1.12, { duration: 90 }),
      withTiming(1, { duration: 130 })
    );
    dieRotate.value = withSequence(
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 70 }),
      withTiming(0, { duration: 70 })
    );

    const pIdx = activePlayer;
    totalsRef.current[pIdx] += finalRoll;
    setTotals([...totalsRef.current]);

    const newRolls = [...currentRolls];
    newRolls[pIdx] = finalRoll;
    setCurrentRolls(newRolls);

    if (!newRolls.every((r) => r !== null)) {
      setActivePlayer(pIdx + 1);
      return;
    }

    const rolls = newRolls as number[];
    const maxRoll = Math.max(...rolls);
    const winners = rolls
      .map((r, i) => (r === maxRoll ? i : -1))
      .filter((i) => i >= 0);

    if (winners.length === 1) {
      winsRef.current[winners[0]] += 1;
      setRoundWins([...winsRef.current]);
      setRoundResult(t("mpWinsRound", { player: players[winners[0]].name }));
      haptic.success();
    } else {
      setRoundResult(t("mpRoundDraw"));
      haptic.tap();
    }

    const nextRound = round + 1;
    roundTransitionRef.current = setTimeout(() => {
      roundTransitionRef.current = null;
      if (nextRound > ROUNDS) {
        finishMatch();
        return;
      }
      setRound(nextRound);
      setActivePlayer(0);
      setCurrentRolls(new Array(players.length).fill(null));
      setRoundResult(null);
    }, 1600);
  };

  const skipTransition = () => {
    // Let players tap through the round-result pause instead of waiting.
    if (!roundTransitionRef.current) {
      return;
    }
    clearTimeout(roundTransitionRef.current);
    roundTransitionRef.current = null;
    if (round + 1 > ROUNDS) {
      finishMatch();
      return;
    }
    setRound(round + 1);
    setActivePlayer(0);
    setCurrentRolls(new Array(players.length).fill(null));
    setRoundResult(null);
  };

  const handleRoll = () => {
    if (phase !== "playing" || isRolling) {
      return;
    }
    if (roundResult !== null) {
      skipTransition();
      return;
    }
    haptic.tap();
    setIsRolling(true);
    setRollingValue(rollDie());
    rollingIntervalRef.current = setInterval(
      () => setRollingValue(rollDie()),
      90
    );
    settleTimeoutRef.current = setTimeout(() => {
      if (rollingIntervalRef.current) {
        clearInterval(rollingIntervalRef.current);
        rollingIntervalRef.current = null;
      }
      settleTimeoutRef.current = null;
      finalizeRoll(rollDie());
    }, 1100);
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={2}
        onStart={startMatch}
        subtitle={t("mpTiebreakHint")}
        title={t("gameDuelDiceName")}
      />
    );
  }

  const visiblePips =
    rollingValue && FACE_PIPS[rollingValue] ? FACE_PIPS[rollingValue] : [];
  const canRoll = !isRolling && roundResult === null;
  const current = players[Math.min(activePlayer, players.length - 1)];
  const activeColor = current.color;

  let rollLabel = t("diceWaiting");
  if (canRoll) {
    rollLabel = `${current.name} — ${t("diceTapToRoll")}`;
  } else if (isRolling) {
    rollLabel = `${current.name}…`;
  }

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        <TurnBanner
          compact
          player={current}
          right={
            <Text style={[styles.roundChip, { color: theme.mutedText }]}>
              {t("mpRoundOf", {
                round: Math.min(round, ROUNDS),
                total: ROUNDS,
              })}
            </Text>
          }
        />
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      <PlayerScoreStrip
        activeIndex={activePlayer}
        detail={(i) =>
          `${currentRolls[i] === null ? "" : `🎲 ${currentRolls[i]} · `}${totals[i]} ${t("mpPoints")}`
        }
        players={players}
        scores={roundWins}
      />

      <RNView style={styles.dieArea}>
        <Animated.View
          accessibilityLabel={
            rollingValue ? t("a11yDieFace", { n: rollingValue }) : undefined
          }
          style={[
            styles.dieFace,
            {
              backgroundColor: theme.elevated,
              borderColor: isRolling ? activeColor : theme.border,
              borderRadius: dieSize * 0.16,
              height: dieSize,
              padding: dieSize * 0.1,
              width: dieSize,
            },
            dieAnimatedStyle,
          ]}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <RNView key={PIP_KEYS[i]} style={styles.pipCell}>
              {visiblePips.includes(i) ? (
                <RNView
                  style={[
                    styles.pip,
                    {
                      backgroundColor: isRolling ? activeColor : theme.text,
                      height: dieSize * 0.14,
                      width: dieSize * 0.14,
                    },
                  ]}
                />
              ) : null}
            </RNView>
          ))}
        </Animated.View>
        <Animated.Text
          entering={FadeIn.duration(180)}
          key={roundResult ?? `round-${round}`}
          style={[
            styles.roundLabel,
            { color: roundResult ? theme.tint : theme.mutedText },
          ]}
        >
          {roundResult ?? t("diceTapToRoll")}
        </Animated.Text>
      </RNView>

      <Pressable
        accessibilityLabel={t("diceTapToRoll")}
        accessibilityRole="button"
        onPress={handleRoll}
        style={[
          styles.rollBtn,
          {
            backgroundColor: canRoll ? activeColor : theme.card,
            borderColor: canRoll ? activeColor : theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.rollBtnText,
            { color: canRoll ? "#0b1620" : theme.mutedText },
          ]}
        >
          {rollLabel}
        </Text>
      </Pressable>

      {phase === "done" ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={t("mpWinsLabel")}
          standings={players.map((p, i) => ({
            detail: `${totals[i]} ${t("mpPoints")}`,
            player: p,
            score: roundWins[i],
            tiebreak: totals[i],
          }))}
          subtitle={t("mpTiebreakHint")}
          winnerIndex={getSoleWinnerIndex(
            players.map((_, i) => ({
              score: matchScore(roundWins[i], totals[i]),
            }))
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dieArea: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
  },
  dieFace: {
    borderWidth: 2,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pip: { borderRadius: Radius.pill },
  pipCell: {
    alignItems: "center",
    height: "33.33%",
    justifyContent: "center",
    width: "33.33%",
  },
  rollBtn: {
    alignItems: "center",
    borderRadius: Radius.panel,
    borderWidth: 1.5,
    justifyContent: "center",
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xl,
    width: "100%",
  },
  rollBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  root: {
    flex: 1,
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  roundChip: { ...TextStyle.chipLabel },
  roundLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
});
