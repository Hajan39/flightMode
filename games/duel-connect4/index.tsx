import { useEffect, useMemo, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { baseScheme } from "@/components/colorSchemes";
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
import { TextStyle } from "@/constants/Typography";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "duel-connect4";
const ROWS = 6;
const COLS = 7;
const BOARD_PAD = 16;
const GAP = 4;

type Player = 0 | 1;
type Cell = -1 | Player;
type Board = Cell[][];
type RoundWinner = Player | "draw" | null;
type Phase = "setup" | "playing" | "done";

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(-1) as Cell[]);
}

function dropPiece(board: Board, col: number, player: Player): Board | null {
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (board[r][col] === -1) {
      const next = board.map((row) => [...row]) as Board;
      next[r][col] = player;
      return next;
    }
  }
  return null;
}

/** Winner + the cells of every 4-line, computed once per board change. */
function evaluate(board: Board): {
  winner: RoundWinner;
  winCells: Set<string>;
} {
  const winCells = new Set<string>();
  let winner: RoundWinner = null;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const p = board[r][c];
      if (p === -1) {
        continue;
      }
      for (const [dr, dc] of DIRECTIONS) {
        const line: string[] = [`${r},${c}`];
        for (let i = 1; i < 4; i += 1) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
            break;
          }
          if (board[nr][nc] !== p) {
            break;
          }
          line.push(`${nr},${nc}`);
        }
        if (line.length >= 4) {
          winner = p;
          for (const key of line) {
            winCells.add(key);
          }
        }
      }
    }
  }
  if (winner === null && board[0].every((c) => c !== -1)) {
    winner = "draw";
  }
  return { winCells, winner };
}

function Disc({
  color,
  isWin,
  size,
}: {
  color: string;
  isWin: boolean;
  size: number;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = isWin
      ? withRepeat(
          withSequence(
            withTiming(1.12, { duration: 200 }),
            withTiming(1, { duration: 200 })
          ),
          3
        )
      : 1;
  }, [isWin, scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      style={[
        {
          backgroundColor: color,
          borderColor: isWin ? "#fff" : "transparent",
          borderRadius: size / 2,
          borderWidth: isWin ? 2 : 0,
          height: size,
          width: size,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function DuelConnect4Game() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width } = useGameDimensions();
  const cellSize = Math.floor(
    (Math.min(width, 520) - BOARD_PAD * 2 - 16 - GAP * (COLS - 1)) / COLS
  );

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [board, setBoard] = useState<Board>(createBoard);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(0);
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [draws, setDraws] = useState(0);
  const [matchTarget, setMatchTarget] = useState<2 | 3>(2);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  const { winner, winCells } = useMemo(() => evaluate(board), [board]);
  const roundOver = winner !== null;

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    setPlayers(matchPlayers);
    setBoard(createBoard());
    setCurrentPlayer(0);
    setWins([0, 0]);
    setDraws(0);
    setProgress(undefined);
    setPhase("playing");
  };

  const handleDrop = (col: number) => {
    if (roundOver || phase !== "playing") {
      return;
    }
    const next = dropPiece(board, col, currentPlayer);
    if (!next) {
      return;
    }
    haptic.tap();
    setBoard(next);

    const result = evaluate(next).winner;
    if (result === 0 || result === 1) {
      const nextWins: [number, number] = [...wins] as [number, number];
      nextWins[result] += 1;
      setWins(nextWins);
      if (nextWins[result] >= matchTarget) {
        haptic.heavy();
        setProgress(
          recordMatch(
            GAME_ID,
            nextWins.map((score) => ({ score }))
          )
        );
        setPhase("done");
      } else {
        haptic.success();
      }
      return;
    }
    if (result === "draw") {
      haptic.tap();
      setDraws((d) => d + 1);
      return;
    }
    setCurrentPlayer(currentPlayer === 0 ? 1 : 0);
  };

  const nextRound = () => {
    haptic.tap();
    setBoard(createBoard());
    // The player who did NOT win the last round starts.
    let starter: Player;
    if (winner === 0) {
      starter = 1;
    } else if (winner === 1) {
      starter = 0;
    } else {
      starter = currentPlayer === 0 ? 1 : 0;
    }
    setCurrentPlayer(starter);
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        fixedCount={2}
        onStart={startMatch}
        title={t("gameDuelConnect4Name")}
      >
        <OptionChips
          label={t("mpMatchSettings")}
          onChange={setMatchTarget}
          options={[
            { label: t("c4BestOf3"), value: 2 },
            { label: t("c4BestOf5"), value: 3 },
          ]}
          value={matchTarget}
        />
      </PlayerSetup>
    );
  }

  const current = players[currentPlayer];
  let statusLabel: string | undefined;
  if (winner === "draw") {
    statusLabel = t("mpRoundDraw");
  } else if (winner !== null) {
    statusLabel = t("mpWinsRound", { player: players[winner].name });
  }
  const boardBg = baseScheme(colorScheme) === "dark" ? "#1a237e" : "#283593";
  const holeBg = baseScheme(colorScheme) === "dark" ? "#0d1236" : "#e8eaf6";

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        <TurnBanner
          compact
          label={statusLabel}
          player={
            winner !== null && winner !== "draw" ? players[winner] : current
          }
        />
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      <PlayerScoreStrip
        activeIndex={roundOver ? undefined : currentPlayer}
        detail={() => t("tttDrawCount", { count: draws })}
        players={players}
        scores={wins}
      />

      <RNView style={[styles.board, { backgroundColor: boardBg }]}>
        <RNView style={styles.colButtons}>
          {Array.from({ length: COLS }).map((_, c) => (
            <Pressable
              accessibilityLabel={t("a11yDropInColumn", { col: c + 1 })}
              accessibilityRole="button"
              hitSlop={{ bottom: 14, left: 0, right: 0, top: 14 }}
              key={`col-${c}`}
              onPress={() => handleDrop(c)}
              style={[styles.colBtn, { width: cellSize }]}
            >
              {roundOver ? null : (
                <RNView
                  style={[styles.dropArrow, { borderTopColor: current.color }]}
                />
              )}
            </Pressable>
          ))}
        </RNView>

        {board.map((row, r) => (
          <RNView key={`r-${r}`} style={styles.row}>
            {row.map((cell, c) => (
              <Pressable
                accessibilityLabel={t("a11yDropInColumn", { col: c + 1 })}
                key={`${r}-${c}`}
                onPress={() => handleDrop(c)}
                style={[
                  styles.cell,
                  {
                    backgroundColor: holeBg,
                    borderRadius: cellSize / 2,
                    height: cellSize,
                    width: cellSize,
                  },
                ]}
              >
                {cell === -1 ? null : (
                  <Disc
                    color={players[cell].color}
                    isWin={winCells.has(`${r},${c}`)}
                    size={cellSize}
                  />
                )}
              </Pressable>
            ))}
          </RNView>
        ))}
      </RNView>

      {roundOver && phase === "playing" ? (
        <Pressable
          accessibilityLabel={t("c4NextRound")}
          accessibilityRole="button"
          onPress={nextRound}
          style={[styles.btn, { backgroundColor: theme.tint }]}
        >
          <Text style={[styles.btnText, { color: theme.onTint }]}>
            {t("c4NextRound")}
          </Text>
        </Pressable>
      ) : null}

      {phase === "done" ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={t("mpWinsLabel")}
          standings={players.map((p, i) => ({ player: p, score: wins[i] }))}
          subtitle={t("tttDrawCount", { count: draws })}
          winnerIndex={getSoleWinnerIndex(wins.map((score) => ({ score })))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { alignSelf: "center", borderRadius: Radius.card, padding: 8 },
  btn: {
    alignSelf: "center",
    borderRadius: Radius.button,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
  },
  btnText: { ...TextStyle.buttonSecondary },
  cell: { alignItems: "center", justifyContent: "center" },
  colBtn: { alignItems: "center", height: 18, justifyContent: "center" },
  colButtons: { flexDirection: "row", gap: GAP, marginBottom: 4 },
  dropArrow: {
    borderLeftColor: "transparent",
    borderLeftWidth: 6,
    borderRightColor: "transparent",
    borderRightWidth: 6,
    borderTopWidth: 8,
    height: 0,
    width: 0,
  },
  root: {
    alignItems: "stretch",
    flex: 1,
    gap: Spacing.md,
    padding: BOARD_PAD,
    paddingTop: Spacing.sm,
  },
  row: { flexDirection: "row", gap: GAP, marginBottom: GAP },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
});
