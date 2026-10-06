import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
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
import {
  ROUNDS_PER_PLAYER,
  TURN_SECONDS,
} from "@/data/categoryBlitzCategories";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

import { buildTurns, type Turn, tallyScores } from "./logic";

const GAME_ID = "category-blitz";
type Phase = "setup" | "pass" | "countdown" | "playing" | "turnEnd" | "done";

/**
 * Category Blitz — name as many things in the category as you can in 20 s.
 * The player says them out loud, the others judge, the phone just counts taps.
 * No word list, so it works in every UI language.
 */
export default function CategoryBlitzGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [counts, setCounts] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  // Wall-clock deadline (CLAUDE.md timer rule) + a ref mirror for the timer tick.
  const deadlineRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
    }
    tickRef.current = null;
  };
  useEffect(() => clearTick, [clearTick]);

  const turn = turns[turnIndex];
  const current = players[turn?.player ?? 0];
  const totals = tallyScores(turns, counts, players.length || 1);

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    clearTick();
    const built = buildTurns(matchPlayers.length);
    setPlayers(matchPlayers);
    setTurns(built);
    setCounts(new Array(built.length).fill(0));
    setTurnIndex(0);
    setTimeLeft(TURN_SECONDS);
    setProgress(undefined);
    setPhase("pass");
  };

  const beginTurn = () => {
    deadlineRef.current = Date.now() + TURN_SECONDS * 1000;
    setTimeLeft(TURN_SECONDS);
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }
    const tick = () => {
      const deadline = deadlineRef.current;
      if (!deadline) {
        return;
      }
      const remainingMs = deadline - Date.now();
      setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs <= 0) {
        clearTick();
        deadlineRef.current = null;
        haptic.heavy();
        setPhase("turnEnd");
      }
    };
    tick();
    tickRef.current = setInterval(tick, 200);
    return clearTick;
  }, [phase, haptic, clearTick]);

  const scorePoint = () => {
    if (phase !== "playing") {
      return;
    }
    haptic.tap();
    setCounts((prev) => {
      const next = [...prev];
      next[turnIndex] += 1;
      return next;
    });
  };

  const undoPoint = () => {
    if (phase !== "playing" || (counts[turnIndex] ?? 0) === 0) {
      return;
    }
    haptic.error();
    setCounts((prev) => {
      const next = [...prev];
      next[turnIndex] = Math.max(0, next[turnIndex] - 1);
      return next;
    });
  };

  const nextTurn = () => {
    haptic.tap();
    const next = turnIndex + 1;
    if (next >= turns.length) {
      const finalTotals = tallyScores(turns, counts, players.length);
      setProgress(
        recordMatch(
          GAME_ID,
          finalTotals.map((score) => ({ score }))
        )
      );
      setPhase("done");
      return;
    }
    setTurnIndex(next);
    setPhase("pass");
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={2}
        onStart={startMatch}
        subtitle={t("cbzIntro", { seconds: TURN_SECONDS })}
        title={t("gameCategoryBlitzName")}
      />
    );
  }

  const turnScore = counts[turnIndex] ?? 0;
  const timerColor =
    timeLeft <= 5 ? theme.danger : timeLeft <= 10 ? theme.warning : theme.text;

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        <TurnBanner
          compact
          player={current}
          right={
            <Text style={[styles.roundChip, { color: theme.mutedText }]}>
              {t("mpRoundOf", {
                round: (turn?.round ?? 0) + 1,
                total: ROUNDS_PER_PLAYER,
              })}
            </Text>
          }
        />
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      <PlayerScoreStrip
        activeIndex={phase === "playing" ? turn?.player : undefined}
        players={players}
        scores={totals}
      />

      <RNView
        style={[
          styles.categoryCard,
          {
            backgroundColor: theme.card,
            borderColor: current?.color ?? theme.border,
          },
        ]}
      >
        <Text style={[styles.categoryLabel, { color: theme.mutedText }]}>
          {t("cbzNameAsMany")}
        </Text>
        <Text style={[styles.categoryText, { color: theme.text }]}>
          {turn ? t(turn.category) : ""}
        </Text>
      </RNView>

      {phase === "playing" ? (
        <>
          <Text style={[styles.timer, { color: timerColor }]}>{timeLeft}s</Text>
          <Pressable
            accessibilityLabel={t("cbzCountIt")}
            accessibilityRole="button"
            onPress={scorePoint}
            style={[styles.scoreBtn, { backgroundColor: current.color }]}
          >
            <Animated.Text
              entering={ZoomIn.duration(140)}
              key={turnScore}
              style={styles.scoreValue}
            >
              {turnScore}
            </Animated.Text>
            <Text style={styles.scoreHint}>{t("cbzCountIt")}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t("cbzUndo")}
            accessibilityRole="button"
            disabled={turnScore === 0}
            onPress={undoPoint}
            style={[
              styles.undoBtn,
              { borderColor: theme.border, opacity: turnScore === 0 ? 0.4 : 1 },
            ]}
          >
            <Ionicons
              color={theme.mutedText}
              name="arrow-undo-outline"
              size={16}
            />
            <Text style={[styles.undoText, { color: theme.mutedText }]}>
              {t("cbzUndo")}
            </Text>
          </Pressable>
        </>
      ) : null}

      {phase === "turnEnd" ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.turnEnd}>
          <Text style={[styles.turnEndScore, { color: current.color }]}>
            +{turnScore}
          </Text>
          <Text style={[styles.turnEndText, { color: theme.mutedText }]}>
            {t("cbzTimeUp", { player: current.name })}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={nextTurn}
            style={[styles.nextBtn, { backgroundColor: theme.tint }]}
          >
            <Text style={[styles.nextText, { color: theme.onTint }]}>
              {turnIndex + 1 >= turns.length
                ? t("hmSeeResult")
                : t("hmNextRound")}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {current ? (
        <PassDeviceOverlay
          hint={t("cbzHandoff", { seconds: TURN_SECONDS })}
          onReady={() => setPhase("countdown")}
          toPlayer={current}
          visible={phase === "pass"}
        />
      ) : null}
      {phase === "countdown" ? <GameCountdown onComplete={beginTurn} /> : null}

      {phase === "done" ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={t("cbzAnswers")}
          standings={players.map((p, i) => ({ player: p, score: totals[i] }))}
          winnerIndex={getSoleWinnerIndex(totals.map((score) => ({ score })))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    alignItems: "center",
    borderRadius: Radius.panel,
    borderWidth: 2,
    gap: Spacing.xs,
    padding: Spacing.xl,
  },
  categoryLabel: { ...TextStyle.statLabel },
  categoryText: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    lineHeight: 30,
    textAlign: "center",
  },
  nextBtn: {
    borderRadius: Radius.button,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.md + 2,
  },
  nextText: { ...TextStyle.buttonSecondary },
  root: {
    alignItems: "stretch",
    flex: 1,
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  roundChip: { ...TextStyle.chipLabel },
  scoreBtn: {
    alignItems: "center",
    borderRadius: Radius.modal,
    flex: 1,
    gap: Spacing.xs,
    justifyContent: "center",
  },
  scoreHint: {
    color: "#0b1620",
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  scoreValue: {
    color: "#0b1620",
    fontSize: 96,
    fontWeight: FontWeight.black,
    lineHeight: 104,
  },
  timer: { ...TextStyle.statValueLarge, textAlign: "center" },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  turnEnd: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
    justifyContent: "center",
  },
  turnEndScore: { fontSize: FontSize["5xl"], fontWeight: FontWeight.black },
  turnEndText: { ...TextStyle.hint, textAlign: "center" },
  undoBtn: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  undoText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
