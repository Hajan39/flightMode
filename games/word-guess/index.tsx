import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View as RNView } from "react-native";
import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

// ---------------------------------------------------------------------------
// Word pool
// ---------------------------------------------------------------------------

const AVIATION_WORDS = [
  "PILOT", "PLANE", "RADAR", "CABIN", "TOWER", "CARGO", "FLAPS", "CLOUD",
  "GATES", "ROUTE", "DELTA", "PITCH", "CLEAR", "CLIMB", "GLIDE", "HOVER",
  "ORBIT", "SKIES", "VAPOR", "GAUGE", "CHUTE", "SONIC", "BOOST", "WINDS",
  "FRONT", "NIGHT", "SKIDS", "TAXIS", "PYLON", "BRACE", "VISOR", "QUEUE",
  "TRAIL", "FUMES", "BRAKE", "SPEED", "LIGHT", "LAPSE", "STORM", "GROUN",
];

const COMMON_WORDS = [
  "RAISE", "HOUSE", "LIGHT", "PLACE", "STAND", "THINK", "FOUND", "GREAT",
  "OFTEN", "ABOVE", "EVERY", "THOSE", "STILL", "SINCE", "THREE", "WHILE",
  "MIGHT", "AFTER", "WATER", "ABOUT", "AGAIN", "WORLD", "NIGHT", "PHONE",
  "BLACK", "WHITE", "YOUNG", "SMALL", "HEART", "MUSIC", "DRIVE", "WRITE",
  "PAPER", "SHARE", "CHAIR", "SMILE", "FIELD", "DREAM", "BREAK",
  "CLOCK", "FLOOR", "POINT", "POWER", "BREAD", "EARTH", "GLASS", "GRADE",
  "GRACE", "PEACE", "PRIZE", "QUEEN", "SPACE", "SPARK", "STAGE", "STAKE",
  "STARE", "STORY", "STYLE", "SUITE", "SWEAR", "SWEET", "SWORD", "SWORE",
  "TABLE", "TASTE", "TEACH", "TEARS", "TEETH", "THANK", "THEME", "THICK",
  "THING", "THORN", "THOSE", "THROW", "TIGHT", "TIRED", "TODAY", "TOKEN",
  "TAKEN", "TOUGH", "TOWEL", "TRACK", "TRADE", "TRAIN", "TREAT", "TREND",
  "TRIBE", "TRICK", "TRIED", "BRING", "BUILD", "BUILT", "BURST", "BUYER",
  "CARGO", "CARRY", "CAUSE", "CEASE", "CEDAR", "CHALK", "CHAOS",
  "CHECK", "CHESS", "CHIEF", "CHILD", "CLAIM", "CLASS", "CLEAN", "CLERK",
];

const WORD_POOL = [...new Set([...AVIATION_WORDS, ...COMMON_WORDS])].filter(
  (w) => w.length === 5,
);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

type LetterState = "correct" | "present" | "absent" | "empty" | "pending";

function checkGuess(guess: string, target: string): LetterState[] {
  const states: LetterState[] = Array(5).fill("absent");
  const targetChars = target.split("");

  // Pass 1: greens
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      states[i] = "correct";
      targetChars[i] = ""; // consumed
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < 5; i++) {
    if (states[i] === "correct") continue;
    const idx = targetChars.indexOf(guess[i]);
    if (idx !== -1) {
      states[i] = "present";
      targetChars[idx] = ""; // consume
    }
  }

  return states;
}

const PRIORITY: Record<LetterState, number> = {
  correct: 3,
  present: 2,
  absent: 1,
  empty: 0,
  pending: 0,
};

function mergeKeyboard(
  existing: Record<string, LetterState>,
  newStates: LetterState[],
  letters: string[],
): Record<string, LetterState> {
  const next = { ...existing };
  letters.forEach((letter, i) => {
    const cur = next[letter];
    const inc = newStates[i];
    if (!cur || PRIORITY[inc] > PRIORITY[cur]) {
      next[letter] = inc;
    }
  });
  return next;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

const PRESENT_COLOR = "#c9a227";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "playing" | "over";

type GuessRow = {
  letters: string[];
  states: LetterState[];
  submitted: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WordGuessGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  const storedBest = useGameStore((s) => s.progress["word-guess"]?.highScore ?? 0);
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("idle");
  const [targetWord, setTargetWord] = useState("");
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [currentInput, setCurrentInput] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [keyboardState, setKeyboardState] = useState<Record<string, LetterState>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);

  // Derived sizing
  const cellSize = Math.floor((screenWidth - 80) / 5);
  const keyWidth = Math.floor((screenWidth - 24) / 10);

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  const startGame = useCallback(() => {
    const word = WORD_POOL[getDayOfYear() % WORD_POOL.length];
    setTargetWord(word);
    setGuesses(
      Array(6)
        .fill(null)
        .map(() => ({ letters: [], states: [], submitted: false })),
    );
    setCurrentAttempt(0);
    setCurrentInput([]);
    setKeyboardState({});
    setErrorMessage(null);
    setWon(false);
    setResult(null);
    setPhase("playing");
  }, []);

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    (input: string[], attempt: number, guessList: GuessRow[], kbState: Record<string, LetterState>) => {
      if (input.length < 5) {
        setErrorMessage(t("wgTypeAWord"));
        setTimeout(() => setErrorMessage(null), 1500);
        haptic.error();
        return;
      }

      const word = input.join("");
      const states = checkGuess(word, targetWord);

      const newGuesses = guessList.map((row, i) =>
        i === attempt
          ? { letters: [...input], states, submitted: true }
          : row,
      );
      setGuesses(newGuesses);

      const newKeyboard = mergeKeyboard(kbState, states, input);
      setKeyboardState(newKeyboard);
      setCurrentInput([]);

      const isWin = states.every((s) => s === "correct");

      if (isWin) {
        haptic.success();
        const score = 1000 - attempt * 150;
        const info = updateProgress("word-guess", score);
        setResult(info);
        setWon(true);
        setTimeout(() => setPhase("over"), 800);
      } else if (attempt >= 5) {
        haptic.error();
        const info = updateProgress("word-guess", 0, { won: false });
        setResult(info);
        setWon(false);
        setTimeout(() => setPhase("over"), 800);
      } else {
        haptic.tap();
        setCurrentAttempt((a) => a + 1);
      }
    },
    [targetWord, haptic, t, updateProgress],
  );

  const handleKey = useCallback(
    (key: string) => {
      if (phase !== "playing") return;

      if (key === "⌫") {
        setCurrentInput((prev) => prev.slice(0, -1));
        return;
      }

      if (key === "ENTER") {
        // Capture current state snapshot and pass to handleSubmit
        setCurrentInput((prevInput) => {
          setGuesses((prevGuesses) => {
            setKeyboardState((prevKb) => {
              handleSubmit(prevInput, currentAttempt, prevGuesses, prevKb);
              return prevKb;
            });
            return prevGuesses;
          });
          return prevInput;
        });
        return;
      }

      if (currentInput.length < 5) {
        haptic.tap();
        setCurrentInput((prev) => [...prev, key]);
      }
    },
    [phase, currentInput.length, currentAttempt, haptic, handleSubmit],
  );

  // ---------------------------------------------------------------------------
  // Cell color helpers
  // ---------------------------------------------------------------------------

  function getCellBg(state: LetterState, isCurrentRow: boolean): string {
    if (isCurrentRow) return theme.card;
    switch (state) {
      case "correct": return theme.tint;
      case "present": return PRESENT_COLOR;
      case "absent": return theme.surface;
      default: return theme.card;
    }
  }

  function getCellTextColor(state: LetterState, isCurrentRow: boolean): string {
    if (isCurrentRow) return theme.text;
    switch (state) {
      case "correct": return "#ffffff";
      case "present": return "#ffffff";
      case "absent": return theme.mutedText;
      default: return theme.text;
    }
  }

  function getCellBorderColor(state: LetterState, hasLetter: boolean, isCurrentRow: boolean): string {
    if (isCurrentRow && hasLetter) return theme.tint;
    return theme.border;
  }

  function getKeyBg(key: string): string {
    const state = keyboardState[key];
    switch (state) {
      case "correct": return theme.tint;
      case "present": return PRESENT_COLOR;
      case "absent": return theme.elevated;
      default: return theme.card;
    }
  }

  function getKeyTextColor(key: string): string {
    const state = keyboardState[key];
    switch (state) {
      case "correct": return "#ffffff";
      case "present": return "#ffffff";
      case "absent": return theme.mutedText;
      default: return theme.text;
    }
  }

  // ---------------------------------------------------------------------------
  // Idle screen
  // ---------------------------------------------------------------------------

  if (phase === "idle") {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <RNView style={styles.idleContent}>
          <Text style={[styles.idleTitle, { color: theme.text }]}>
            {t("gameWordGuessName")}
          </Text>
          <Text style={[styles.idleDesc, { color: theme.mutedText }]}>
            {t("gameWordGuessDescription")}
          </Text>
          <Pressable
            style={[styles.startBtn, { backgroundColor: theme.tint }]}
            onPress={startGame}
          >
            <Text style={styles.startBtnText}>{t("gameTapToStart")}</Text>
          </Pressable>
        </RNView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Playing / Over screen
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Controls row — reset button only, no pause for word game */}
      <RNView style={styles.controlsRow}>
        <GameControls onReset={startGame} hidePause />
      </RNView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Guess grid */}
        <RNView style={styles.grid}>
          {guesses.map((row, rowIdx) => {
            const isCurrentRow = rowIdx === currentAttempt && !row.submitted;
            return (
              <RNView key={rowIdx} style={styles.row}>
                {Array(5)
                  .fill(null)
                  .map((_, colIdx) => {
                    const letter = row.submitted
                      ? row.letters[colIdx]
                      : isCurrentRow
                        ? currentInput[colIdx]
                        : undefined;
                    const state: LetterState = row.submitted
                      ? row.states[colIdx]
                      : "empty";
                    const hasLetter = letter !== undefined;
                    const bgColor = getCellBg(state, isCurrentRow);
                    const textColor = getCellTextColor(state, isCurrentRow);
                    const borderColor = getCellBorderColor(state, hasLetter, isCurrentRow);

                    return (
                      <RNView
                        key={colIdx}
                        style={[
                          styles.cell,
                          {
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: bgColor,
                            borderColor: borderColor,
                            borderRadius: Radius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            {
                              color: textColor,
                              fontSize: Math.floor(cellSize * 0.45),
                            },
                          ]}
                        >
                          {letter ?? ""}
                        </Text>
                      </RNView>
                    );
                  })}
              </RNView>
            );
          })}
        </RNView>

        {/* Error / status message row — always occupies space to avoid layout shift */}
        <RNView style={styles.messageRow}>
          {errorMessage ? (
            <Text style={[styles.errorText, { color: theme.mutedText }]}>
              {errorMessage}
            </Text>
          ) : null}
        </RNView>

        {/* QWERTY keyboard */}
        <RNView style={styles.keyboard}>
          {KEYBOARD_ROWS.map((kbRow, kbRowIdx) => (
            <RNView key={kbRowIdx} style={styles.keyboardRow}>
              {kbRow.map((key) => {
                const isWide = key === "ENTER" || key === "⌫";
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.key,
                      {
                        width: isWide ? Math.floor(keyWidth * 1.5) : keyWidth,
                        backgroundColor: getKeyBg(key),
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => handleKey(key)}
                    accessibilityLabel={key}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        {
                          color: getKeyTextColor(key),
                          fontSize: isWide ? FontSize.xs : FontSize.sm,
                        },
                      ]}
                    >
                      {key}
                    </Text>
                  </Pressable>
                );
              })}
            </RNView>
          ))}
        </RNView>
      </ScrollView>

      {/* Result overlay */}
      {phase === "over" && result ? (
        <GameResult
          title={t("gameWordGuessName")}
          subtitle={
            won
              ? `${currentAttempt + 1}/6`
              : t("wgCorrectWord", { word: targetWord })
          }
          score={won ? 1000 - currentAttempt * 150 : 0}
          best={result.best ?? storedBest}
          last={
            result.last !== undefined &&
            result.last !== (won ? 1000 - currentAttempt * 150 : 0)
              ? result.last
              : undefined
          }
          streak={
            result.currentStreak && result.currentStreak > 0
              ? result.currentStreak
              : undefined
          }
          isNewBest={result.isNewBest}
          onPlayAgain={startGame}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  controlsRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    alignItems: "flex-end",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  // Idle
  idleContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing["4xl"],
  },
  idleTitle: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    textAlign: "center",
  },
  idleDesc: {
    ...TextStyle.hint,
    textAlign: "center",
    lineHeight: 20,
  },
  startBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.button,
  },
  startBtnText: {
    ...TextStyle.buttonPrimary,
    color: "#ffffff",
  },
  // Grid
  grid: {
    gap: Spacing.xs,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  cell: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontWeight: FontWeight.black,
    textAlign: "center",
    letterSpacing: 1,
  },
  // Message row
  messageRow: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  // Keyboard
  keyboard: {
    gap: Spacing.xs,
    alignSelf: "stretch",
  },
  keyboardRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  key: {
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontWeight: FontWeight.bold,
  },
});
