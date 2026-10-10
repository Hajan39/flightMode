import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { FontSize, FontWeight } from "@/constants/Typography";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  buildPuzzle,
  buildSecretPuzzle,
  lineBetween,
  type Placement,
  type Puzzle,
  readCells,
} from "./logic";
import { SEARCH_WORDS, SECRETS } from "./words";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASSIC_SIZE = 8;
const BIG_SIZE = 10;
const WORD_COUNT = 6;
const GAP = 3;

/** Aviation / travel words per language (fallback en) — all 5 letters so they tile an 8×8 grid nicely. */
const WORD_POOLS: Record<string, string[]> = {
  cs: [
    "PILOT",
    "RADAR",
    "MRAKY",
    "TRASA",
    "BRÁNA",
    "KUFRY",
    "VÍZUM",
    "MOTOR",
    "LETEC",
    "VĚTER",
    "BOUŘE",
    "DRÁHA",
  ],
  de: [
    "PILOT",
    "RADAR",
    "WOLKE",
    "ROUTE",
    "PISTE",
    "REISE",
    "KARTE",
    "MOTOR",
    "STURM",
    "SONNE",
    "VISUM",
    "MEILE",
  ],
  en: [
    "PILOT",
    "CABIN",
    "CARGO",
    "RADAR",
    "TOWER",
    "ROUTE",
    "CLOUD",
    "GATES",
    "WINGS",
    "PLANE",
    "BOARD",
    "MILES",
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "menu" | "playing" | "paused" | "over";
/** classic: 8×8, six words. big: 10×10 osmisměrka whose leftover letters spell a hidden message. */
type Mode = "classic" | "big";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (component-side, uses Math.random). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a fresh puzzle whose placements all resolve to real words. */
function makePuzzle(
  language: string,
  mode: Mode
): { puzzle: Puzzle; secret: string | null } {
  if (mode === "big") {
    const lang = language === "cs" || language === "de" ? language : "en";
    const secrets = SECRETS[lang];
    const built = buildSecretPuzzle(
      SEARCH_WORDS[lang],
      BIG_SIZE,
      secrets.map((x) => x.letters),
      Math.random
    );
    if (built) {
      const secret = secrets.find((x) => x.letters === built.secret);
      return { puzzle: built, secret: secret?.text ?? built.secret };
    }
  }
  const pool = WORD_POOLS[language] ?? WORD_POOLS.en;
  const size = mode === "big" ? BIG_SIZE : CLASSIC_SIZE;
  // Retry until we get WORD_COUNT successful placements (rare to need >1 pass).
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const puzzle = buildPuzzle(
      shuffle(pool).slice(0, WORD_COUNT),
      size,
      Math.random
    );
    if (puzzle.placements.length === WORD_COUNT) {
      return { puzzle, secret: null };
    }
  }
  // Fallback: accept whatever placed (still a valid, readable puzzle).
  return {
    puzzle: buildPuzzle(shuffle(pool).slice(0, WORD_COUNT), size, Math.random),
    secret: null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WordSearchGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t, language } = useTranslation();
  const { width, height } = useGameDimensions();
  const haptic = useHaptic();

  const storedBest = useGameStore(
    (s) => s.progress["word-search"]?.highScore ?? 0
  );
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [mode, setMode] = useState<Mode>("classic");
  const [puzzle, setPuzzle] = useState<Puzzle>(
    () => makePuzzle(language, "classic").puzzle
  );
  const [secret, setSecret] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  /** Cells under the finger while dragging a selection. */
  const [dragLine, setDragLine] = useState<number[] | null>(null);
  const gridSize = puzzle.size;
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<number>>(new Set());
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  // ── Refs ──
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedRef = useRef<number>(0); // seconds banked across pauses
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solvedRef = useRef<boolean>(false); // guards single updateProgress call
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Timer ──
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const live =
        accumulatedRef.current + (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(Math.floor(live));
    }, 500);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Fresh game ──
  const startGame = (nextMode: Mode) => {
    stopTimer();
    solvedRef.current = false;
    accumulatedRef.current = 0;
    const next = makePuzzle(language, nextMode);
    setMode(nextMode);
    setPuzzle(next.puzzle);
    setSecret(next.secret);
    setDragLine(null);
    setFoundWords([]);
    setFoundCells(new Set());
    setSelectedStart(null);
    setElapsedSeconds(0);
    setFinalScore(null);
    setProgressInfo(null);
    setPhase("playing");
    startTimer();
  };
  const resetGame = () => startGame(mode);

  // ── Pause / resume ──
  const handlePause = useCallback(() => {
    if (phase !== "playing") {
      return;
    }
    accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    stopTimer();
    setPhase("paused");
  }, [phase, stopTimer]);

  const handleResume = useCallback(() => {
    if (phase !== "paused") {
      return;
    }
    setPhase("playing");
    startTimer();
  }, [phase, startTimer]);

  // ── Shake feedback on a bad selection ──
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        duration: 50,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        duration: 50,
        toValue: -1,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        duration: 50,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        duration: 50,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  // ── Win handling (single updateProgress) ──
  const finishGame = useCallback(
    (elapsed: number) => {
      if (solvedRef.current) {
        return;
      }
      solvedRef.current = true;
      stopTimer();
      haptic.success();
      const score =
        mode === "big"
          ? Math.max(400, 4000 - elapsed * 8)
          : Math.max(200, 2000 - elapsed * 10);
      const info = updateProgress("word-search", score, { won: true });
      setProgressInfo(info);
      setFinalScore(score);
      setPhase("over");
    },
    [haptic, stopTimer, updateProgress, mode]
  );

  // ── Cell tap ──
  const handleCellTap = (index: number) => {
    if (phase !== "playing") {
      return;
    }

    // First tap selects the start cell.
    if (selectedStart === null) {
      haptic.tap();
      setSelectedStart(index);
      return;
    }

    // Tapping the same cell cancels the selection.
    if (selectedStart === index) {
      haptic.tap();
      setSelectedStart(null);
      return;
    }

    setSelectedStart(null);
    checkLine(lineBetween(selectedStart, index, gridSize));
  };

  /** Accepts a straight line of cells if it spells a word not yet found. */
  const checkLine = (line: number[] | null) => {
    if (!line) {
      haptic.error();
      triggerShake();
      return;
    }

    const forward = readCells(puzzle.grid, line);
    const backward = forward.split("").reverse().join("");

    const match = puzzle.placements.find(
      (p: Placement) =>
        !foundWords.includes(p.word) &&
        (p.word === forward || p.word === backward)
    );

    if (!match) {
      haptic.error();
      triggerShake();
      return;
    }

    // Found a new word.
    haptic.success();
    const nextFound = [...foundWords, match.word];
    const nextCells = new Set(foundCells);
    for (const c of match.cells) {
      nextCells.add(c);
    }
    setFoundWords(nextFound);
    setFoundCells(nextCells);

    if (nextFound.length >= puzzle.placements.length) {
      const elapsed =
        accumulatedRef.current + (Date.now() - startTimeRef.current) / 1000;
      finishGame(Math.floor(elapsed));
    }
  };

  // ── Drag across letters ──
  const boardRef = useRef<RNView>(null);
  const boardOrigin = useRef({ x: 0, y: 0 });
  const dragStart = useRef<number | null>(null);
  const cellFromTouch = (e: GestureResponderEvent): number | null => {
    const pitch = cellSize + GAP;
    const col = Math.floor(
      (e.nativeEvent.pageX - boardOrigin.current.x) / pitch
    );
    const row = Math.floor(
      (e.nativeEvent.pageY - boardOrigin.current.y) / pitch
    );
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
      return null;
    }
    return row * gridSize + col;
  };
  const onDragGrant = (e: GestureResponderEvent) => {
    dragStart.current = cellFromTouch(e);
    setDragLine(dragStart.current === null ? null : [dragStart.current]);
  };
  const onDragMove = (e: GestureResponderEvent) => {
    const end = cellFromTouch(e);
    if (dragStart.current === null || end === null) {
      return;
    }
    setDragLine(lineBetween(dragStart.current, end, gridSize));
  };
  const onDragRelease = (e: GestureResponderEvent) => {
    const start = dragStart.current;
    const end = cellFromTouch(e);
    dragStart.current = null;
    setDragLine(null);
    if (start === null || end === null) {
      return;
    }
    if (start === end) {
      handleCellTap(start);
      return;
    }
    setSelectedStart(null);
    checkLine(lineBetween(start, end, gridSize));
  };

  // ── Layout ──
  const boardEdge = Math.min(width, height) * 0.9;
  const cellSize = Math.floor((boardEdge - GAP * (gridSize - 1)) / gridSize);

  const shakeTranslate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-8, 8],
  });

  // ── Render a single cell ──
  const renderCell = (index: number) => {
    const letter = puzzle.grid[index];
    const isFound = foundCells.has(index);
    const isSelected =
      selectedStart === index || (dragLine?.includes(index) ?? false);

    let bg = theme.elevated;
    let color = theme.text;
    if (isFound) {
      bg = theme.tint;
      color = theme.onTint;
    } else if (isSelected) {
      bg = theme.warning;
      color = theme.onTint;
    }

    return (
      <RNView
        key={index}
        style={[
          styles.cell,
          {
            backgroundColor: bg,
            borderColor: isSelected ? theme.warning : theme.border,
            borderRadius: Radius.sm,
            height: cellSize,
            width: cellSize,
          },
        ]}
      >
        <Text
          style={[
            styles.cellLetter,
            { color, fontSize: Math.round(cellSize * 0.5) },
          ]}
        >
          {letter}
        </Text>
      </RNView>
    );
  };

  const rows: number[][] = [];
  for (let r = 0; r < gridSize; r += 1) {
    rows.push(Array.from({ length: gridSize }, (_, c) => r * gridSize + c));
  }

  if (phase === "menu") {
    return (
      <View style={[styles.root, styles.menu]}>
        <Text style={styles.menuTitle}>{t("gameWordSearchName")}</Text>
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("wsChooseMode")}
        </Text>
        {(["classic", "big"] as const).map((m) => (
          <Pressable
            accessibilityRole="button"
            key={m}
            onPress={() => startGame(m)}
            style={[
              styles.modeBtn,
              m === "classic"
                ? { backgroundColor: theme.tint }
                : { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.modeTitle,
                { color: m === "classic" ? theme.onTint : theme.text },
              ]}
            >
              {m === "classic" ? t("wsModeClassic") : t("wsModeBig")}
            </Text>
            <Text
              style={[
                styles.modeDesc,
                { color: m === "classic" ? theme.onTint : theme.mutedText },
              ]}
            >
              {m === "classic" ? t("wsModeClassicDesc") : t("wsModeBigDesc")}
            </Text>
          </Pressable>
        ))}
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("wsHowTo")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header: stats + controls */}
      <RNView style={styles.header}>
        <RNView style={styles.statsRow}>
          <RNView style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("wsFound")}
            </Text>
            <Text style={[styles.statValue, { color: theme.tint }]}>
              {foundWords.length}/{puzzle.placements.length}
            </Text>
          </RNView>
          <RNView
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <RNView style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("msTime")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {elapsedSeconds}s
            </Text>
          </RNView>
        </RNView>

        <GameControls
          isPaused={phase === "paused"}
          onPause={phase === "playing" ? handlePause : undefined}
          onReset={resetGame}
        />
      </RNView>

      {/* Board */}
      <RNView style={styles.boardWrapper}>
        <Animated.View
          onLayout={() =>
            boardRef.current?.measureInWindow((x, y) => {
              boardOrigin.current = { x, y };
            })
          }
          onResponderGrant={onDragGrant}
          onResponderMove={onDragMove}
          onResponderRelease={onDragRelease}
          onResponderTerminationRequest={() => false}
          onStartShouldSetResponder={() => phase === "playing"}
          ref={boardRef}
          style={[
            styles.board,
            { gap: GAP, transform: [{ translateX: shakeTranslate }] },
          ]}
        >
          {rows.map((row, rIdx) => (
            <RNView key={rIdx} style={[styles.boardRow, { gap: GAP }]}>
              {row.map((index) => renderCell(index))}
            </RNView>
          ))}
        </Animated.View>
      </RNView>

      {/* Word list */}
      <RNView style={styles.wordSection}>
        <Text style={[styles.wordSectionLabel, { color: theme.mutedText }]}>
          {t("wsWords")}
        </Text>
        <RNView style={styles.wordList}>
          {puzzle.placements.map((p: Placement) => {
            const found = foundWords.includes(p.word);
            return (
              <RNView
                key={p.word}
                style={[
                  styles.wordChip,
                  {
                    backgroundColor: found ? theme.tint : theme.card,
                    borderColor: found ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.wordChipText,
                    {
                      color: found ? theme.onTint : theme.text,
                      textDecorationLine: found ? "line-through" : "none",
                    },
                  ]}
                >
                  {p.word}
                </Text>
              </RNView>
            );
          })}
        </RNView>
      </RNView>

      {/* Result overlay */}
      {phase === "over" && finalScore !== null && (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={resetGame}
          score={finalScore}
          streak={progressInfo?.currentStreak}
          subtitle={secret ? t("wsSecretReveal", { secret }) : undefined}
          title={t("youWin")}
        />
      )}

      {/* Pause overlay */}
      <GamePauseOverlay
        onQuit={() => {
          stopTimer();
          setPhase("menu");
        }}
        onRestart={resetGame}
        onResume={handleResume}
        visible={phase === "paused"}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  board: {
    flexDirection: "column",
  },
  boardRow: {
    flexDirection: "row",
  },
  // ── Board ──
  boardWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  cellLetter: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
  },
  // ── Header ──
  header: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  menu: { justifyContent: "center" },
  menuHint: { fontSize: 14, textAlign: "center" },
  menuTitle: { fontSize: 26, fontWeight: "900", textAlign: "center" },
  modeBtn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderColor: "transparent",
    borderRadius: Radius.button,
    borderWidth: 1,
    gap: 4,
    paddingVertical: Spacing.lg,
  },
  modeDesc: { fontSize: 14, textAlign: "center" },
  modeTitle: { fontSize: 18, fontWeight: "800" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statBlock: {
    alignItems: "center",
    gap: 1,
    minWidth: 56,
  },
  statDivider: {
    height: 36,
    width: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  wordChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  wordChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  wordList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  // ── Word list ──
  wordSection: {
    alignItems: "center",
    alignSelf: "stretch",
    gap: Spacing.sm,
  },
  wordSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
