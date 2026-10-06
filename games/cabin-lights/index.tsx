import { useState } from "react";
import {
  Pressable,
  View as RNView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const ROUND_BASE_SCORE = 100;
const EFFICIENCY_BONUS_PER_MOVE = 10;

// ── Round config ──────────────────────────────────────────────────────────────
interface RoundConfig {
  scrambleTaps: number;
  size: number;
}

function getRoundConfig(round: number): RoundConfig {
  if (round <= 2) {
    return { scrambleTaps: 2 + round, size: 3 }; // 3, 4
  }
  if (round <= 4) {
    return { scrambleTaps: 3 + round, size: 4 }; // 6, 7
  }
  return { scrambleTaps: 9, size: 5 };
}

// ── Board logic ───────────────────────────────────────────────────────────────
// Board is a flat boolean array; true = light ON. Tap toggles the cell and its
// orthogonal neighbors. Scrambling by applying random taps to an all-off board
// guarantees the puzzle is solvable (taps are self-inverse and commutative).
function toggleAt(board: boolean[], size: number, index: number): boolean[] {
  const next = [...board];
  const row = Math.floor(index / size);
  const col = index % size;

  const flip = (r: number, c: number) => {
    if (r < 0 || r >= size || c < 0 || c >= size) {
      return;
    }
    const i = r * size + c;
    next[i] = !next[i];
  };

  flip(row, col);
  flip(row - 1, col);
  flip(row + 1, col);
  flip(row, col - 1);
  flip(row, col + 1);

  return next;
}

function generateBoard(config: RoundConfig): boolean[] {
  const total = config.size * config.size;

  // Apply distinct random taps; repeating a tap would cancel it out and
  // could produce an already-solved board.
  const tapPool = Array.from({ length: total }, (_, i) => i);
  for (let i = tapPool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tapPool[i], tapPool[j]] = [tapPool[j], tapPool[i]];
  }

  let board = Array.from({ length: total }, () => false);
  for (const tap of tapPool.slice(0, config.scrambleTaps)) {
    board = toggleAt(board, config.size, tap);
  }
  return board;
}

function roundScore(scrambleTaps: number, moves: number): number {
  const bonus =
    Math.max(0, scrambleTaps * 2 - moves) * EFFICIENCY_BONUS_PER_MOVE;
  return ROUND_BASE_SCORE + bonus;
}

// ── Phase ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "playing" | "roundDone";

export default function CabinLightsGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore(
    (s) => s.progress["cabin-lights"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width } = useWindowDimensions();

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [board, setBoard] = useState<boolean[]>([]);
  const [size, setSize] = useState(3);
  const [scrambleTaps, setScrambleTaps] = useState(0);
  const [moves, setMoves] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  // ── Round flow ────────────────────────────────────────────────────────────
  const startRound = (roundNum: number) => {
    const config = getRoundConfig(roundNum);
    setRound(roundNum);
    setSize(config.size);
    setScrambleTaps(config.scrambleTaps);
    setBoard(generateBoard(config));
    setMoves(0);
    setPhase("playing");
  };

  const startGame = () => {
    setTotalScore(0);
    setFinalScore(null);
    setProgressInfo(null);
    startRound(1);
  };

  const restart = () => {
    setPhase("idle");
    setRound(0);
    setBoard([]);
    setMoves(0);
    setTotalScore(0);
    setFinalScore(null);
    setProgressInfo(null);
  };

  const handleCellTap = (index: number) => {
    if (phase !== "playing") {
      return;
    }

    haptic.tap();
    const nextBoard = toggleAt(board, size, index);
    const nextMoves = moves + 1;
    setBoard(nextBoard);
    setMoves(nextMoves);

    const solved = nextBoard.every((light) => !light);
    if (!solved) {
      return;
    }

    const earned = roundScore(scrambleTaps, nextMoves);
    const nextTotal = totalScore + earned;
    setTotalScore(nextTotal);

    if (round >= TOTAL_ROUNDS) {
      haptic.success();
      const info = updateProgress("cabin-lights", nextTotal);
      setProgressInfo(info);
      setFinalScore(nextTotal);
      setPhase("idle");
    } else {
      haptic.success();
      setPhase("roundDone");
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  const GRID_PADDING = 20;
  const CELL_GAP = 8;
  const maxGridWidth = Math.min(width - GRID_PADDING * 2, 360);
  const cellSize = Math.floor((maxGridWidth - CELL_GAP * (size - 1)) / size);

  const litCount = board.filter(Boolean).length;
  const isIdle = phase === "idle";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <RNView style={styles.headerRow}>
        <RNView style={[styles.pill, { backgroundColor: theme.card }]}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("cabinLightsScore")}
          </Text>
          <Text style={[styles.statValue, { color: theme.tint }]}>
            {totalScore}
          </Text>
        </RNView>
        <RNView
          style={[
            styles.pill,
            styles.pillGrow,
            { backgroundColor: theme.card },
          ]}
        >
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("cabinLightsRound")}
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {round > 0 ? `${round}/${TOTAL_ROUNDS}` : `—/${TOTAL_ROUNDS}`}
          </Text>
        </RNView>
        <RNView style={[styles.pill, { backgroundColor: theme.card }]}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("cabinLightsMoves")}
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{moves}</Text>
        </RNView>
        <GameControls onReset={phase === "idle" ? undefined : restart} />
      </RNView>

      {/* ── Board / idle prompt ── */}
      {isIdle && finalScore === null ? (
        <Pressable
          accessibilityLabel={t("gameTapToStart")}
          accessibilityRole="button"
          onPress={startGame}
          style={[
            styles.idleArea,
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          <Text style={styles.idleEmoji}>💡</Text>
          <Text style={[styles.idleTitle, { color: theme.text }]}>
            {t("gameTapToStart")}
          </Text>
          <Text style={[styles.idleHint, { color: theme.mutedText }]}>
            {t("cabinLightsHint")}
          </Text>
        </Pressable>
      ) : (
        <RNView style={styles.boardWrapper}>
          <RNView style={[styles.grid, { gap: CELL_GAP }]}>
            {Array.from({ length: size }, (_, row) => (
              <RNView key={row} style={[styles.gridRow, { gap: CELL_GAP }]}>
                {Array.from({ length: size }, (_unused, col) => {
                  const index = row * size + col;
                  const isOn = board[index];
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isOn }}
                      key={index}
                      onPress={() => handleCellTap(index)}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: isOn
                            ? theme.warning
                            : theme.elevated,
                          borderColor: isOn ? theme.warning : theme.border,
                          height: cellSize,
                          width: cellSize,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellEmoji,
                          { fontSize: Math.min(30, cellSize * 0.42) },
                          !isOn && styles.cellEmojiOff,
                        ]}
                      >
                        💡
                      </Text>
                    </Pressable>
                  );
                })}
              </RNView>
            ))}
          </RNView>

          {phase === "playing" && (
            <Text style={[styles.hintText, { color: theme.mutedText }]}>
              {t("cabinLightsRemaining", { count: litCount })}
            </Text>
          )}

          {phase === "roundDone" && (
            <Pressable
              accessibilityLabel={t("cabinLightsNextRound")}
              accessibilityRole="button"
              onPress={() => startRound(round + 1)}
              style={[
                styles.nextButton,
                {
                  backgroundColor: theme.successSurface,
                  borderColor: theme.successBorder,
                },
              ]}
            >
              <Text style={[styles.nextButtonTitle, { color: theme.text }]}>
                {t("cabinLightsRoundClear")}
              </Text>
              <Text style={[styles.nextButtonHint, { color: theme.mutedText }]}>
                {t("cabinLightsNextRound")}
              </Text>
            </Pressable>
          )}
        </RNView>
      )}

      {/* ── Game result overlay ── */}
      {finalScore !== null && (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={finalScore}
          streak={progressInfo?.currentStreak}
          title={t("gameCabinLightsName")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Board ── */
  boardWrapper: {
    alignItems: "center",
    flex: 1,
    gap: 20,
    justifyContent: "center",
  },
  cell: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  cellEmoji: {
    textAlign: "center",
  },
  cellEmojiOff: {
    opacity: 0.25,
  },
  grid: {
    alignItems: "center",
  },
  gridRow: {
    flexDirection: "row",
  },
  /* ── Header ── */
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  hintText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  /* ── Idle ── */
  idleArea: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1.5,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    minHeight: 220,
  },
  idleEmoji: {
    fontSize: 44,
  },
  idleHint: {
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 24,
    textAlign: "center",
  },
  idleTitle: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  /* ── Round-clear button ── */
  nextButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 4,
    minWidth: 220,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  nextButtonHint: {
    fontSize: 13,
    fontWeight: "600",
  },
  nextButtonTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  pill: {
    alignItems: "baseline",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillGrow: { flex: 1 },
  root: { flex: 1, gap: 12, padding: 20 },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: { fontSize: 16, fontWeight: "900" },
});
