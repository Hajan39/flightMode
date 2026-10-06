import { useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import {
  MatchResult,
  OptionChips,
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
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";
import { type Difficulty, pickWord } from "./words";

const GAME_ID = "duel-hangman";
const MAX_WRONG = 6;
const TOTAL_ROUNDS = 8;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const KEY_ROWS = [
  ALPHABET.slice(0, 9),
  ALPHABET.slice(9, 18),
  ALPHABET.slice(18, 26),
];

const DIFF_LABELS: Record<Difficulty, TranslationKey> = {
  easy: "hmDiffEasy",
  hard: "hmDiffHard",
  medium: "hmDiffMedium",
};
const DIFF_HINTS: Record<Difficulty, TranslationKey> = {
  easy: "hmDiffEasyHint",
  hard: "hmDiffHardHint",
  medium: "hmDiffMediumHint",
};
const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

function getRoundDifficulty(base: Difficulty, round: number): Difficulty {
  const baseIndex = DIFFICULTY_ORDER.indexOf(base);
  const ramp = Math.floor((round - 1) / 3);
  return DIFFICULTY_ORDER[
    Math.min(DIFFICULTY_ORDER.length - 1, baseIndex + ramp)
  ];
}

/* Hangman figure parts */
const PARTS: ((color: string) => React.ReactNode)[] = [
  (c) => (
    <RNView
      key="head"
      style={{
        borderColor: c,
        borderRadius: 12,
        borderWidth: 2.5,
        height: 24,
        left: 44,
        position: "absolute",
        top: 30,
        width: 24,
      }}
    />
  ),
  (c) => (
    <RNView
      key="body"
      style={{
        backgroundColor: c,
        height: 30,
        left: 55,
        position: "absolute",
        top: 54,
        width: 2.5,
      }}
    />
  ),
  (c) => (
    <RNView
      key="larm"
      style={{
        backgroundColor: c,
        height: 2.5,
        left: 40,
        position: "absolute",
        top: 60,
        transform: [{ rotate: "30deg" }],
        width: 16,
      }}
    />
  ),
  (c) => (
    <RNView
      key="rarm"
      style={{
        backgroundColor: c,
        height: 2.5,
        left: 57,
        position: "absolute",
        top: 60,
        transform: [{ rotate: "-30deg" }],
        width: 16,
      }}
    />
  ),
  (c) => (
    <RNView
      key="lleg"
      style={{
        backgroundColor: c,
        height: 2.5,
        left: 42,
        position: "absolute",
        top: 82,
        transform: [{ rotate: "-30deg" }],
        width: 16,
      }}
    />
  ),
  (c) => (
    <RNView
      key="rleg"
      style={{
        backgroundColor: c,
        height: 2.5,
        left: 54,
        position: "absolute",
        top: 82,
        transform: [{ rotate: "30deg" }],
        width: 16,
      }}
    />
  ),
];

type Phase = "setup" | "handoff" | "playing" | "result";

export default function DuelHangmanGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const { t, language } = useTranslation();
  const haptic = useHaptic();
  const { width } = useWindowDimensions();

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [phase, setPhase] = useState<Phase>("setup");
  const [word, setWord] = useState("");
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [guesser, setGuesser] = useState(0);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  const solo = players.length === 1;
  const wrongCount = word
    ? [...guessed].filter((l) => !word.includes(l)).length
    : 0;
  const isWon = word ? word.split("").every((l) => guessed.has(l)) : false;
  const isLost = wrongCount >= MAX_WRONG;
  const gameOver = isWon || isLost;
  const current = players[Math.min(guesser, Math.max(0, players.length - 1))];
  const guesserColor = current?.color ?? theme.tint;
  let slotBorderColor = guesserColor;
  if (gameOver) {
    slotBorderColor = isWon ? theme.successBorder : theme.danger;
  }
  const hiddenLetterColor = gameOver ? theme.danger : "transparent";
  const wordLetters = word.split("").map((letter, index) => ({
    id: `${letter}-${index + 1}-${word.length}`,
    letter,
  }));

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    setPlayers(matchPlayers);
    setScores(new Array(matchPlayers.length).fill(0));
    setRound(1);
    setGuesser(0);
    setGuessed(new Set());
    setWord("");
    setProgress(undefined);
    // Solo: nothing to hide, skip the hand-off.
    if (matchPlayers.length === 1) {
      const diff = getRoundDifficulty(difficulty, 1);
      setWord(pickWord(language, diff));
      setPhase("playing");
    } else {
      setPhase("handoff");
    }
  };

  const startRound = () => {
    const diff = getRoundDifficulty(difficulty, round);
    setWord(pickWord(language, diff));
    setGuessed(new Set());
    setPhase("playing");
  };

  const handleGuess = (letter: string) => {
    if (gameOver || guessed.has(letter)) {
      return;
    }
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);

    if (word.includes(letter)) {
      haptic.success();
    } else {
      haptic.error();
    }

    const won = word.split("").every((l) => next.has(l));
    const lost = [...next].filter((l) => !word.includes(l)).length >= MAX_WRONG;

    if (won) {
      setScores((prev) => prev.map((s, i) => (i === guesser ? s + 10 : s)));
    } else if (lost && !solo) {
      // Everyone else scores when the guesser fails.
      setScores((prev) => prev.map((s, i) => (i === guesser ? s : s + 5)));
    }
  };

  const nextRound = () => {
    haptic.tap();
    if (round >= TOTAL_ROUNDS) {
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
      setPhase("result");
      return;
    }
    const nextRoundNo = round + 1;
    setRound(nextRoundNo);
    setGuesser((g) => (g + 1) % players.length);
    setGuessed(new Set());
    if (solo) {
      setWord(pickWord(language, getRoundDifficulty(difficulty, nextRoundNo)));
      setPhase("playing");
    } else {
      setPhase("handoff");
    }
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={1}
        onStart={startMatch}
        title={t("gameDuelHangmanName")}
      >
        <OptionChips
          label={t("hmPickDifficulty")}
          onChange={setDifficulty}
          options={DIFFICULTY_ORDER.map((d) => ({
            hint: t(DIFF_HINTS[d]),
            label: t(DIFF_LABELS[d]),
            value: d,
          }))}
          value={difficulty}
        />
      </PlayerSetup>
    );
  }

  const figureColor = theme.text;
  const screenW = Math.min(width, 520) - Spacing.lg * 2;
  const gap = word.length > 10 ? 4 : 8;
  const slotW = word.length
    ? Math.min(32, (screenW - (word.length - 1) * gap) / word.length)
    : 32;
  const fontSize = slotW > 24 ? 24 : Math.max(14, slotW - 4);

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        {current ? (
          <TurnBanner
            compact
            label={
              solo ? undefined : t("hmGuesserNamed", { player: current.name })
            }
            player={current}
            right={
              <Text style={[styles.roundChip, { color: theme.mutedText }]}>
                {t("mpRoundOf", { round, total: TOTAL_ROUNDS })}
              </Text>
            }
          />
        ) : null}
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      {solo ? (
        <Text style={[styles.soloScore, { color: theme.tint }]}>
          {scores[0] ?? 0} {t("mpPoints")}
        </Text>
      ) : (
        <PlayerScoreStrip
          activeIndex={guesser}
          players={players}
          scores={scores}
        />
      )}

      <RNView style={styles.gallowsBox}>
        <RNView style={[styles.gallowBase, { backgroundColor: figureColor }]} />
        <RNView style={[styles.gallowPole, { backgroundColor: figureColor }]} />
        <RNView style={[styles.gallowTop, { backgroundColor: figureColor }]} />
        <RNView style={[styles.gallowRope, { backgroundColor: figureColor }]} />
        {PARTS.slice(0, wrongCount).map((fn) => fn(figureColor))}
      </RNView>

      <ScrollView
        contentContainerStyle={styles.wordScrollContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.wordScroll}
      >
        <RNView style={styles.wordRow}>
          {wordLetters.map(({ id, letter }) => (
            <RNView
              key={id}
              style={[
                styles.letterSlot,
                {
                  borderBottomColor: slotBorderColor,
                  marginHorizontal: gap / 2,
                  width: slotW,
                },
              ]}
            >
              <Text
                style={[
                  styles.letterChar,
                  {
                    color: guessed.has(letter) ? theme.text : hiddenLetterColor,
                    fontSize,
                  },
                ]}
              >
                {guessed.has(letter) || gameOver ? letter : "_"}
              </Text>
            </RNView>
          ))}
        </RNView>
      </ScrollView>

      <Text style={[styles.wrongHint, { color: theme.mutedText }]}>
        {t("hmWrongCount", { count: wrongCount, max: MAX_WRONG })}
      </Text>

      {gameOver ? (
        <RNView style={styles.gameOverRow}>
          <Text
            style={[
              styles.gameOverText,
              { color: isWon ? theme.successBorder : theme.danger },
            ]}
          >
            {isWon ? t("hmCorrect") : t("hmFailed", { word })}
          </Text>
          <Pressable
            accessibilityLabel={
              round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")
            }
            accessibilityRole="button"
            onPress={nextRound}
            style={[styles.btn, { backgroundColor: theme.tint }]}
          >
            <Text style={[styles.btnText, { color: theme.onTint }]}>
              {round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
            </Text>
          </Pressable>
        </RNView>
      ) : (
        <RNView style={styles.keyboard}>
          {KEY_ROWS.map((row) => (
            <RNView key={`kr-${row.join("")}`} style={styles.keyRow}>
              {row.map((letter) => {
                const used = guessed.has(letter);
                const correct = used && word.includes(letter);
                const wrong = used && !word.includes(letter);
                let keyBackground = theme.elevated;
                if (correct) {
                  keyBackground = theme.successBorder;
                } else if (wrong) {
                  keyBackground = theme.danger;
                }
                return (
                  <Pressable
                    accessibilityLabel={letter}
                    accessibilityRole="button"
                    disabled={used}
                    hitSlop={{ bottom: 3, left: 2, right: 2, top: 3 }}
                    key={letter}
                    onPress={() => handleGuess(letter)}
                    style={[
                      styles.key,
                      {
                        backgroundColor: keyBackground,
                        opacity: used ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        { color: used ? "#fff" : theme.text },
                      ]}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                );
              })}
            </RNView>
          ))}
        </RNView>
      )}

      {current ? (
        <PassDeviceOverlay
          hint={t("hmPassToGuesserHint")}
          onReady={startRound}
          secret
          toPlayer={current}
          visible={phase === "handoff"}
        />
      ) : null}

      {phase === "result" && solo ? (
        <GameResult
          best={progress?.best}
          isNewBest={progress?.isNewBest}
          last={progress?.previousBest}
          onPlayAgain={() => startMatch(players)}
          score={scores[0]}
          streak={progress?.currentStreak}
          title={t("gameDuelHangmanName")}
        />
      ) : null}
      {phase === "result" && !solo ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={t("mpPoints")}
          standings={players.map((p, i) => ({ player: p, score: scores[i] }))}
          winnerIndex={getSoleWinnerIndex(scores.map((score) => ({ score })))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.button,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
  },
  btnText: { ...TextStyle.buttonSecondary },
  gallowBase: {
    borderRadius: 1.5,
    bottom: 0,
    height: 3,
    left: 10,
    position: "absolute",
    width: 60,
  },
  gallowPole: {
    borderRadius: 1.5,
    bottom: 0,
    height: 110,
    left: 25,
    position: "absolute",
    width: 3,
  },
  gallowRope: {
    borderRadius: 1,
    height: 27,
    left: 55,
    position: "absolute",
    top: 3,
    width: 2.5,
  },
  gallowsBox: {
    alignSelf: "center",
    height: 120,
    marginTop: Spacing.xs,
    position: "relative",
    width: 112,
  },
  gallowTop: {
    borderRadius: 1.5,
    height: 3,
    left: 25,
    position: "absolute",
    top: 0,
    width: 33,
  },
  gameOverRow: { alignItems: "center", gap: Spacing.md, marginTop: Spacing.sm },
  gameOverText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: "center",
  },
  key: {
    alignItems: "center",
    borderRadius: Radius.sm + 2,
    height: 44,
    justifyContent: "center",
    width: 34,
  },
  keyboard: { gap: 6, marginTop: Spacing.xs, width: "100%" },
  keyRow: { flexDirection: "row", gap: 4, justifyContent: "center" },
  keyText: { fontSize: FontSize.md - 1, fontWeight: FontWeight.bold },
  letterChar: { fontWeight: FontWeight.black },
  letterSlot: {
    alignItems: "center",
    borderBottomWidth: 3,
    height: 40,
    justifyContent: "flex-end",
  },
  root: {
    alignItems: "stretch",
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  roundChip: { ...TextStyle.chipLabel },
  soloScore: { ...TextStyle.statValueMedium, textAlign: "center" },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  wordRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
  },
  wordScroll: { flexGrow: 0, maxWidth: "100%" },
  wordScrollContent: { flexGrow: 1, justifyContent: "center" },
  wrongHint: { ...TextStyle.hint, textAlign: "center" },
});
