import { useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import {
  A11yOverlayContent,
  A11yOverlayScope,
} from "@/components/A11yOverlayScope";
import GameControls from "@/components/GameControls";
import {
  MatchResult,
  PassDeviceOverlay,
  PlayerScoreStrip,
  PlayerSetup,
  TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { OnPlayerColor } from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useAnimatedPress } from "@/hooks/useAnimatedPress";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

import { calcBullsCows, codeBreakerRounds, firstGuesser } from "./logic";

const GAME_ID = "cross-code-breaker";
const CODE_LEN = 4;
const MAX_GUESSES = 10;

type Phase = "setup" | "handoff" | "playing" | "roundEnd" | "done";
interface GuessEntry {
  bulls: number;
  cows: number;
  digits: number[];
}

function generateSecret(): number[] {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, CODE_LEN);
}

const SLOT_KEYS = ["s0", "s1", "s2", "s3"] as const;
const PEG_KEYS = ["p0", "p1", "p2", "p3"] as const;

export default function CrossCodeBreakerGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t, tn } = useTranslation();
  const haptic = useHaptic();
  const submitPress = useAnimatedPress(0.93);

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [secret, setSecret] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [histories, setHistories] = useState<GuessEntry[][]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [roundWinner, setRoundWinner] = useState<number | null>(null);
  const [guessInput, setGuessInput] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<{
    bulls: number;
    cows: number;
  } | null>(null);
  const [pendingNext, setPendingNext] = useState<number | null>(null);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  const current =
    players[Math.min(currentPlayer, Math.max(0, players.length - 1))];
  const pColor = current?.color ?? theme.tint;
  // A multiple of the player count, so everyone guesses first equally often.
  const totalRounds = codeBreakerRounds(players.length);

  /** `roundNumber` is 1-based; the first guesser rotates every round. */
  const startNewRound = (count: number, roundNumber: number) => {
    setSecret(generateSecret());
    setHistories(Array.from({ length: count }, () => []));
    setCurrentPlayer(firstGuesser(roundNumber, count));
    setRoundWinner(null);
    setGuessInput([]);
    setLastResult(null);
    setPendingNext(null);
    setPhase("handoff");
  };

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    setPlayers(matchPlayers);
    setScores(new Array(matchPlayers.length).fill(0));
    setRound(1);
    setProgress(undefined);
    startNewRound(matchPlayers.length, 1);
  };

  const addDigit = (d: number) => {
    if (guessInput.length >= CODE_LEN) {
      return;
    }
    if (guessInput.includes(d)) {
      haptic.error();
      return;
    }
    setGuessInput((prev) => [...prev, d]);
    haptic.tap();
  };

  const submitGuess = () => {
    if (guessInput.length !== CODE_LEN) {
      return;
    }
    const result = calcBullsCows(secret, guessInput);
    const newHistories = histories.map((h, i) =>
      i === currentPlayer ? [...h, { digits: [...guessInput], ...result }] : h
    );
    setHistories(newHistories);
    setLastResult(result);

    if (result.bulls === CODE_LEN) {
      haptic.success();
      setRoundWinner(currentPlayer);
      const guessCount = newHistories[currentPlayer].length;
      setScores((prev) =>
        prev.map((s, i) =>
          i === currentPlayer
            ? s + Math.max(10, (MAX_GUESSES - guessCount + 1) * 10)
            : s
        )
      );
      return;
    }

    haptic.tap();
    const allMaxed = newHistories.every((h) => h.length >= MAX_GUESSES);
    if (allMaxed) {
      setPendingNext(null);
      return;
    }
    let next = (currentPlayer + 1) % players.length;
    while (newHistories[next].length >= MAX_GUESSES) {
      next = (next + 1) % players.length;
    }
    setPendingNext(next);
  };

  const continueToNextPlayer = () => {
    if (pendingNext === null) {
      return;
    }
    haptic.tap();
    setCurrentPlayer(pendingNext);
    setGuessInput([]);
    setLastResult(null);
    setPendingNext(null);
    setPhase("handoff");
  };

  const confirmRoundEnd = () => {
    haptic.tap();
    setLastResult(null);
    setPhase("roundEnd");
  };

  const nextRound = () => {
    haptic.tap();
    if (round >= totalRounds) {
      setProgress(
        recordMatch(
          GAME_ID,
          scores.map((score) => ({ score }))
        )
      );
      setPhase("done");
      return;
    }
    setRound(round + 1);
    startNewRound(players.length, round + 1);
  };

  // `digits` may be a partial guess: slots past its length are undefined.
  const renderCode = (digits: readonly number[], highlight: string) => (
    <RNView style={styles.codeRow}>
      {SLOT_KEYS.map((key, i) => {
        const digit = digits.at(i);
        const empty = digit === undefined;
        return (
          <RNView
            key={key}
            style={[
              styles.codeSlot,
              {
                backgroundColor: empty ? theme.card : highlight,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.codeDigit,
                { color: empty ? theme.mutedText : OnPlayerColor },
              ]}
            >
              {empty ? "—" : String(digit)}
            </Text>
          </RNView>
        );
      })}
    </RNView>
  );

  const renderPegs = (bulls: number, cows: number, animate = false) => {
    const pegs: ("bull" | "cow" | "miss")[] = [];
    for (let i = 0; i < bulls; i += 1) {
      pegs.push("bull");
    }
    for (let i = 0; i < cows; i += 1) {
      pegs.push("cow");
    }
    while (pegs.length < CODE_LEN) {
      pegs.push("miss");
    }
    return (
      <RNView style={styles.pegRow}>
        {pegs.map((p, i) => {
          let pegColor = theme.border;
          if (p === "bull") {
            pegColor = theme.successBorder;
          } else if (p === "cow") {
            pegColor = theme.warning;
          }
          return (
            <Animated.View
              entering={
                animate ? ZoomIn.delay(i * 40).duration(150) : undefined
              }
              key={PEG_KEYS[i]}
              style={[styles.peg, { backgroundColor: pegColor }]}
            />
          );
        })}
      </RNView>
    );
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={2}
        onStart={startMatch}
        subtitle={t("cbSecretHint")}
        title={t("gameCrossCodeBreakerName")}
      />
    );
  }

  const myHistory = histories[currentPlayer] ?? [];

  let bannerLabel = `${current.name} · ${myHistory.length}/${MAX_GUESSES}`;
  if (phase === "roundEnd") {
    bannerLabel =
      roundWinner === null
        ? t("cbNobodyCracked")
        : t("mpWinsRound", { player: players[roundWinner].name });
  }

  return (
    <A11yOverlayScope>
      <View style={styles.screen}>
        <A11yOverlayContent style={styles.container}>
          <RNView style={styles.topRow}>
            <TurnBanner
              compact
              label={bannerLabel}
              player={current}
              right={
                <Text style={[styles.roundChip, { color: theme.mutedText }]}>
                  {t("mpRoundOf", { round, total: totalRounds })}
                </Text>
              }
            />
            <GameControls onReset={() => startMatch(players)} />
          </RNView>

          <PlayerScoreStrip
            activeIndex={phase === "playing" ? currentPlayer : undefined}
            detail={(i) => `${histories[i]?.length ?? 0}/${MAX_GUESSES}`}
            players={players}
            scores={scores}
          />

          {phase === "roundEnd" ? (
            <RNView style={styles.roundEnd}>
              <Text style={[styles.secretLabel, { color: theme.mutedText }]}>
                {t("cbSecretWas")}
              </Text>
              {renderCode(
                secret,
                roundWinner === null ? theme.tint : players[roundWinner].color
              )}
              <Pressable
                accessibilityLabel={
                  round >= totalRounds ? t("hmSeeResult") : t("hmNextRound")
                }
                accessibilityRole="button"
                onPress={nextRound}
                style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onTint }]}>
                  {round >= totalRounds ? t("hmSeeResult") : t("hmNextRound")}
                </Text>
              </Pressable>
            </RNView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              style={styles.scrollArea}
            >
              {renderCode(guessInput, pColor)}

              <RNView style={styles.numpad}>
                {[
                  [1, 2, 3, 4, 5],
                  [6, 7, 8, 9, 0],
                ].map((row) => (
                  <RNView key={`row-${row[0]}`} style={styles.numRow}>
                    {row.map((d) => (
                      <Pressable
                        accessibilityLabel={String(d)}
                        accessibilityRole="button"
                        disabled={lastResult !== null}
                        key={d}
                        onPress={() => addDigit(d)}
                        style={[
                          styles.numKey,
                          {
                            backgroundColor: guessInput.includes(d)
                              ? `${pColor}33`
                              : theme.card,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text style={styles.numKeyText}>{d}</Text>
                      </Pressable>
                    ))}
                  </RNView>
                ))}
                <Pressable
                  accessibilityLabel={t("a11yBackspace")}
                  accessibilityRole="button"
                  disabled={lastResult !== null}
                  onPress={() => {
                    haptic.tap();
                    setGuessInput((p) => p.slice(0, -1));
                  }}
                  style={[
                    styles.deleteKey,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.numKeyText, { color: theme.danger }]}>
                    ⌫
                  </Text>
                </Pressable>
              </RNView>

              {guessInput.length === CODE_LEN && !lastResult ? (
                <Animated.View
                  entering={ZoomIn.duration(200)}
                  style={submitPress.animatedStyle}
                >
                  <Pressable
                    accessibilityLabel={t("cbCheck")}
                    accessibilityRole="button"
                    onPress={submitGuess}
                    onPressIn={submitPress.onPressIn}
                    onPressOut={submitPress.onPressOut}
                    style={[styles.primaryBtn, { backgroundColor: pColor }]}
                  >
                    <Text style={styles.primaryBtnText}>{t("cbCheck")}</Text>
                  </Pressable>
                </Animated.View>
              ) : null}

              {lastResult ? (
                <Animated.View
                  entering={ZoomIn.duration(200)}
                  style={styles.resultBox}
                >
                  {renderPegs(lastResult.bulls, lastResult.cows, true)}
                  <Text
                    style={[styles.resultSubtext, { color: theme.mutedText }]}
                  >
                    {lastResult.bulls}🎯 {lastResult.cows}🐄
                  </Text>
                  {roundWinner === null ? null : (
                    <Text
                      style={[styles.cracked, { color: theme.successBorder }]}
                    >
                      {t("cbYouCracked")}
                    </Text>
                  )}
                  {pendingNext !== null && roundWinner === null ? (
                    <Pressable
                      accessibilityLabel={t("passPhone")}
                      accessibilityRole="button"
                      onPress={continueToNextPlayer}
                      style={[styles.primaryBtn, { backgroundColor: pColor }]}
                    >
                      <Text style={styles.primaryBtnText}>
                        {t("passPhone")}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityLabel={t("hmSeeResult")}
                      accessibilityRole="button"
                      onPress={confirmRoundEnd}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: theme.tint },
                      ]}
                    >
                      <Text
                        style={[styles.primaryBtnText, { color: theme.onTint }]}
                      >
                        {t("hmSeeResult")}
                      </Text>
                    </Pressable>
                  )}
                </Animated.View>
              ) : null}

              {myHistory.length > 0 ? (
                <RNView style={styles.historySection}>
                  <Text
                    style={[styles.historyTitle, { color: theme.mutedText }]}
                  >
                    {t("cbMyGuesses")}
                  </Text>
                  {myHistory.map((entry, idx) => (
                    <Animated.View
                      entering={FadeInDown.duration(200)}
                      key={`${entry.digits.join("")}-${idx}`}
                      style={[
                        styles.historyRow,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.historyIdx, { color: theme.mutedText }]}
                      >
                        {idx + 1}.
                      </Text>
                      <Text style={styles.historyDigits}>
                        {entry.digits.join(" ")}
                      </Text>
                      {renderPegs(entry.bulls, entry.cows)}
                    </Animated.View>
                  ))}
                </RNView>
              ) : null}
            </ScrollView>
          )}
        </A11yOverlayContent>
        <PassDeviceOverlay
          hint={`${t("cbHandoffHint")} · ${t("cbGuessesUsed")}: ${myHistory.length}/${MAX_GUESSES}`}
          onReady={() => {
            setPhase("playing");
            setGuessInput([]);
            setLastResult(null);
          }}
          secret
          toPlayer={current}
          visible={phase === "handoff"}
        />

        {phase === "done" ? (
          <MatchResult
            onChangePlayers={() => setPhase("setup")}
            onRematch={() => startMatch(players)}
            progress={progress}
            scoreLabel={(n) => tn("mpPoints", n)}
            standings={players.map((p, i) => ({ player: p, score: scores[i] }))}
            winnerIndex={getSoleWinnerIndex(scores.map((score) => ({ score })))}
          />
        ) : null}
      </View>
    </A11yOverlayScope>
  );
}

const styles = StyleSheet.create({
  codeDigit: {
    fontSize: FontSize["3xl"] - 2,
    fontWeight: FontWeight.extrabold,
  },
  codeRow: {
    flexDirection: "row",
    gap: Spacing.sm + 2,
    justifyContent: "center",
    marginVertical: Spacing.sm + 2,
  },
  codeSlot: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    height: 58,
    justifyContent: "center",
    width: 52,
  },
  container: {
    alignItems: "stretch",
    flex: 1,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  cracked: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  deleteKey: {
    alignSelf: "flex-end",
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  historyDigits: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 4,
  },
  historyIdx: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    width: 24,
  },
  historyRow: {
    alignItems: "center",
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  historySection: { alignSelf: "stretch", gap: 4, marginTop: Spacing.md },
  historyTitle: { ...TextStyle.statLabel, marginBottom: 4 },
  numKey: {
    alignItems: "center",
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 52,
  },
  numKeyText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  numpad: { alignItems: "center", gap: 6, marginVertical: Spacing.sm },
  numRow: { flexDirection: "row", gap: 6 },
  peg: { borderRadius: 7, height: 14, width: 14 },
  pegRow: { flexDirection: "row", gap: 4 },
  primaryBtn: {
    alignSelf: "center",
    borderRadius: Radius.card,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
  },
  primaryBtnText: { ...TextStyle.buttonSecondary, color: OnPlayerColor },
  resultBox: { alignItems: "center", gap: 6, marginVertical: Spacing.sm },
  resultSubtext: { ...TextStyle.hint },
  roundChip: { ...TextStyle.chipLabel },
  roundEnd: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
  },
  screen: { flex: 1 },
  scrollArea: { flex: 1 },
  scrollContent: { alignItems: "center", paddingBottom: Spacing.xl },
  secretLabel: { ...TextStyle.statLabel },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
});
