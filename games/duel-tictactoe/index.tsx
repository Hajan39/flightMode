import { useEffect, useState } from "react";
import {
  Pressable,
  type TextStyle as RNTextStyle,
  View as RNView,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import {
  MatchResult,
  OptionChips,
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

const GAME_ID = "duel-tictactoe";
const BOARD_GAP = 10;
const BOARD_PADDING = 20;
const CLASSIC_BOARD_SIZE = 3;
const GROWING_START_SIZE = 5;
const GROWING_MAX_SIZE = 30;
const CLASSIC_WIN_LENGTH = 3;
const GROWING_WIN_LENGTH = 5;

type Player = 0 | 1;
type Mark = "X" | "O";
type RoundWinner = Player | "draw" | null;
type BoardMode = "classic" | "growing";
type Board = Record<string, Player>;
interface Bounds {
  maxCol: number;
  maxRow: number;
  minCol: number;
  minRow: number;
}
type Phase = "setup" | "playing" | "done";

const MARKS: Record<Player, Mark> = { 0: "X", 1: "O" };

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

function createInitialBounds(mode: BoardMode): Bounds {
  const size = mode === "classic" ? CLASSIC_BOARD_SIZE : GROWING_START_SIZE;
  return { maxCol: size - 1, maxRow: size - 1, minCol: 0, minRow: 0 };
}

function keyOf(row: number, col: number) {
  return `${row}:${col}`;
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function getBoundsSize(bounds: Bounds) {
  return {
    cols: bounds.maxCol - bounds.minCol + 1,
    rows: bounds.maxRow - bounds.minRow + 1,
  };
}

function getWinningLine(
  board: Board,
  row: number,
  col: number,
  player: Player,
  winLength: number
): string[] | null {
  for (const [rowDir, colDir] of DIRECTIONS) {
    const line: string[] = [keyOf(row, col)];
    for (const sign of [-1, 1] as const) {
      let nextRow = row + rowDir * sign;
      let nextCol = col + colDir * sign;
      const segment: string[] = [];
      while (board[keyOf(nextRow, nextCol)] === player) {
        segment.push(keyOf(nextRow, nextCol));
        nextRow += rowDir * sign;
        nextCol += colDir * sign;
      }
      if (sign === -1) {
        line.unshift(...segment);
      } else {
        line.push(...segment);
      }
    }
    if (line.length >= winLength) {
      return line;
    }
  }
  return null;
}

function expandBounds(
  bounds: Bounds,
  row: number,
  col: number,
  mode: BoardMode
): Bounds {
  if (mode === "classic") {
    return bounds;
  }
  const next = { ...bounds };
  const { rows, cols } = getBoundsSize(bounds);
  if (row === bounds.minRow && rows < GROWING_MAX_SIZE) {
    next.minRow -= 1;
  }
  if (row === bounds.maxRow && rows < GROWING_MAX_SIZE) {
    next.maxRow += 1;
  }
  if (col === bounds.minCol && cols < GROWING_MAX_SIZE) {
    next.minCol -= 1;
  }
  if (col === bounds.maxCol && cols < GROWING_MAX_SIZE) {
    next.maxCol += 1;
  }
  return next;
}

function isBoardFull(board: Board, bounds: Bounds, mode: BoardMode) {
  const { rows, cols } = getBoundsSize(bounds);
  if (mode === "classic") {
    return Object.keys(board).length >= rows * cols;
  }
  return (
    rows === GROWING_MAX_SIZE &&
    cols === GROWING_MAX_SIZE &&
    Object.keys(board).length >= rows * cols
  );
}

function CellMark({
  value,
  isWin,
  style,
}: {
  value: Mark;
  isWin: boolean;
  style: StyleProp<RNTextStyle>;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = isWin
      ? withRepeat(
          withSequence(
            withTiming(1.15, { duration: 180 }),
            withTiming(1, { duration: 180 })
          ),
          3
        )
      : 1;
  }, [isWin, scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.Text
      entering={ZoomIn.duration(160)}
      style={[style, animatedStyle]}
    >
      {value}
    </Animated.Text>
  );
}

export default function DuelTicTacToeGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width } = useWindowDimensions();

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [boardMode, setBoardMode] = useState<BoardMode>("classic");
  const [targetWins, setTargetWins] = useState<2 | 3>(2);
  const [board, setBoard] = useState<Board>({});
  const [bounds, setBounds] = useState<Bounds>(() =>
    createInitialBounds("classic")
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>(0);
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [draws, setDraws] = useState(0);
  const [roundWinner, setRoundWinner] = useState<RoundWinner>(null);
  const [winningLine, setWinningLine] = useState<string[]>([]);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  const { rows, cols } = getBoundsSize(bounds);
  const boardWidth = Math.min(width, 520) - BOARD_PADDING * 2;
  const cellSize =
    boardMode === "classic"
      ? Math.min(
          92,
          Math.floor(
            (boardWidth - BOARD_GAP * (CLASSIC_BOARD_SIZE - 1)) /
              CLASSIC_BOARD_SIZE
          )
        )
      : Math.min(
          56,
          Math.floor(
            (boardWidth - BOARD_GAP * (GROWING_START_SIZE - 1)) /
              GROWING_START_SIZE
          )
        );
  const winLength =
    boardMode === "classic" ? CLASSIC_WIN_LENGTH : GROWING_WIN_LENGTH;

  const resetBoard = (mode = boardMode) => {
    setBoard({});
    setBounds(createInitialBounds(mode));
    setRoundWinner(null);
    setWinningLine([]);
  };

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    setPlayers(matchPlayers);
    setWins([0, 0]);
    setDraws(0);
    setCurrentPlayer(0);
    setProgress(undefined);
    resetBoard(boardMode);
    setPhase("playing");
  };

  const finishMatch = (finalWins: [number, number]) => {
    setProgress(
      recordMatch(
        GAME_ID,
        finalWins.map((score) => ({ score }))
      )
    );
    setPhase("done");
  };

  const handlePress = (row: number, col: number) => {
    const cellKey = keyOf(row, col);
    if (
      board[cellKey] !== undefined ||
      roundWinner !== null ||
      phase !== "playing"
    ) {
      return;
    }
    haptic.tap();

    const next = { ...board, [cellKey]: currentPlayer };
    const nextBounds = expandBounds(bounds, row, col, boardMode);
    setBoard(next);
    setBounds(nextBounds);

    const line = getWinningLine(next, row, col, currentPlayer, winLength);
    if (line) {
      const nextWins: [number, number] = [...wins] as [number, number];
      nextWins[currentPlayer] += 1;
      setWins(nextWins);
      setRoundWinner(currentPlayer);
      setWinningLine(line);
      if (nextWins[currentPlayer] >= targetWins) {
        haptic.heavy();
        finishMatch(nextWins);
      } else {
        haptic.success();
      }
      return;
    }
    if (isBoardFull(next, nextBounds, boardMode)) {
      haptic.tap();
      setRoundWinner("draw");
      setDraws((d) => d + 1);
      return;
    }
    setCurrentPlayer((prev) => (prev === 0 ? 1 : 0));
  };

  const nextRound = () => {
    haptic.tap();
    // Loser of the last round (or the other player after a draw) starts.
    setCurrentPlayer(
      roundWinner === "draw" || roundWinner === null
        ? currentPlayer === 0
          ? 1
          : 0
        : roundWinner === 0
          ? 1
          : 0
    );
    resetBoard();
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        fixedCount={2}
        onStart={startMatch}
        title={t("gameDuelTicTacToeName")}
      >
        <OptionChips
          label={t("mpMatchSettings")}
          onChange={(mode) => {
            setBoardMode(mode);
            setBounds(createInitialBounds(mode));
          }}
          options={[
            { label: t("tttModeClassic"), value: "classic" },
            {
              hint: "5 ✕ 5 → 30 ✕ 30",
              label: t("tttModeGrowing"),
              value: "growing",
            },
          ]}
          value={boardMode}
        />
        <OptionChips
          onChange={setTargetWins}
          options={[
            { label: t("tttBestOf3"), value: 2 },
            { label: t("tttBestOf5"), value: 3 },
          ]}
          value={targetWins}
        />
      </PlayerSetup>
    );
  }

  const current = players[currentPlayer];
  const roundOver = roundWinner !== null;
  const statusText =
    roundWinner === null
      ? undefined
      : roundWinner === "draw"
        ? t("mpRoundDraw")
        : t("mpWinsRound", { player: players[roundWinner].name });

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        <TurnBanner
          compact
          label={statusText}
          player={
            roundWinner !== null && roundWinner !== "draw"
              ? players[roundWinner]
              : current
          }
          right={
            <Text style={[styles.roundChip, { color: theme.mutedText }]}>
              {boardMode === "classic" ? "3×3" : `${rows}×${cols}`}
            </Text>
          }
        />
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      <PlayerScoreStrip
        activeIndex={roundOver ? undefined : currentPlayer}
        detail={(i) =>
          `${MARKS[i as Player]} · ${t("tttDrawCount", { count: draws })}`
        }
        players={players}
        scores={wins}
      />

      <ScrollView
        contentContainerStyle={styles.boardViewportContent}
        showsVerticalScrollIndicator={false}
        style={[styles.boardViewport, { borderColor: theme.border }]}
      >
        <ScrollView
          contentContainerStyle={styles.boardHScrollContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <RNView
            style={[
              styles.board,
              { width: cols * cellSize + (cols - 1) * BOARD_GAP },
            ]}
          >
            {range(bounds.minRow, bounds.maxRow).map((row) =>
              range(bounds.minCol, bounds.maxCol).map((col) => {
                const cellKey = keyOf(row, col);
                const owner = board[cellKey];
                const hasMark = owner !== undefined;
                const isWinCell = winningLine.includes(cellKey);
                const ownerColor = hasMark ? players[owner].color : undefined;
                return (
                  <Pressable
                    accessibilityLabel={hasMark ? MARKS[owner] : undefined}
                    accessibilityRole="button"
                    key={cellKey}
                    onPress={() => handlePress(row, col)}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: isWinCell
                          ? ownerColor
                          : hasMark
                            ? `${ownerColor}22`
                            : theme.elevated,
                        borderColor: hasMark ? ownerColor : theme.border,
                        height: cellSize,
                        width: cellSize,
                      },
                      isWinCell && styles.cellWin,
                    ]}
                  >
                    {hasMark ? (
                      <CellMark
                        isWin={isWinCell}
                        style={[
                          styles.cellText,
                          {
                            color: isWinCell ? "#0b1620" : ownerColor,
                            fontSize: cellSize * 0.44,
                          },
                        ]}
                        value={MARKS[owner]}
                      />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </RNView>
        </ScrollView>
      </ScrollView>

      {roundOver && phase === "playing" ? (
        <Pressable
          accessibilityLabel={t("tttNextRound")}
          accessibilityRole="button"
          onPress={nextRound}
          style={[styles.actionBtn, { backgroundColor: theme.tint }]}
        >
          <Text style={[styles.actionText, { color: theme.onTint }]}>
            {t("tttNextRound")}
          </Text>
        </Pressable>
      ) : null}

      {phase === "done" ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={t("mpWinsLabel")}
          standings={players.map((p, i) => ({
            detail: MARKS[i as Player],
            player: p,
            score: wins[i],
          }))}
          subtitle={t("tttDrawCount", { count: draws })}
          winnerIndex={getSoleWinnerIndex(wins.map((score) => ({ score })))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    paddingVertical: Spacing.lg,
  },
  actionText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.5,
  },
  board: { flexDirection: "row", flexWrap: "wrap", gap: BOARD_GAP },
  boardHScrollContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  boardViewport: {
    borderRadius: Radius.panel + 2,
    borderWidth: 1,
    maxHeight: 390,
  },
  boardViewportContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.sm + 2,
  },
  cell: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  cellText: { fontWeight: FontWeight.black },
  cellWin: { borderWidth: 3 },
  root: {
    flex: 1,
    gap: Spacing.md,
    paddingHorizontal: BOARD_PADDING,
    paddingTop: Spacing.sm,
  },
  roundChip: { ...TextStyle.chipLabel },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
});
