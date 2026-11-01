import { useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import {
  canMove,
  cellAt,
  generateMaze,
  KIDS_MAZE_HINT_MS,
  KIDS_MAZE_ROUNDS,
  KIDS_MAZE_SIZES,
  type KidsMaze,
  mazeGoal,
  mazeStart,
  nextHintCell,
  stepToward,
} from "@/utils/kidsMaze";

const STARS_HEIGHT = 56;
const MAX_BOARD = 520;
const WALL = 6;
/** The animal sits on the goal this long before the next maze. */
const WON_MS = 900;
/** Animal → what it is looking for (one pair per maze). */
const PAIRS = [
  ["🐶", "🦴"],
  ["🐰", "🥕"],
  ["🐵", "🍌"],
  ["🐭", "🧀"],
] as const;

const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

interface MazeCellProps {
  cellPx: number;
  glow: string | null;
  index: number;
  isExit: boolean;
  label: string;
  maze: KidsMaze;
  onActivate: () => void;
  picture: string | null;
  pop: boolean;
  wallColor: string;
}

/**
 * One square: draws its own right / bottom wall, centred on the grid line.
 * Squares ignore touches (the board tracks the finger); screen readers get
 * the animal, the treat and the open squares next to the animal (activate
 * = move there).
 */
function MazeCell({
  cellPx,
  glow,
  index,
  isExit,
  label,
  maze,
  onActivate,
  picture,
  pop,
  wallColor,
}: MazeCellProps) {
  const { size } = maze;
  const row = Math.floor(index / size);
  const col = index % size;
  const lastRow = row === size - 1;
  const lastCol = col === size - 1;
  const fullLabel = picture ? `${label} ${picture}` : label;
  return (
    <View
      accessibilityActions={
        isExit ? [{ label: fullLabel, name: "activate" }] : undefined
      }
      accessibilityLabel={isExit || picture ? fullLabel : undefined}
      accessibilityRole={isExit ? "button" : undefined}
      accessible={isExit || picture !== null}
      onAccessibilityAction={(ev) => {
        if (isExit && ev.nativeEvent.actionName === "activate") {
          onActivate();
        }
      }}
      style={[
        styles.cell,
        {
          backgroundColor: glow ?? "transparent",
          borderBottomColor: wallColor,
          borderBottomWidth: lastRow || maze.downOpen[index] ? 0 : WALL,
          borderRightColor: wallColor,
          borderRightWidth: lastCol || maze.rightOpen[index] ? 0 : WALL,
          height: cellPx + (lastRow ? 0 : WALL / 2),
          left: col * cellPx,
          top: row * cellPx,
          width: cellPx + (lastCol ? 0 : WALL / 2),
        },
      ]}
      testID={`kids-maze-cell-${String(index)}`}
    >
      {picture === null ? null : (
        <Text
          style={{
            fontSize: cellPx * 0.56,
            lineHeight: cellPx * 0.7,
            transform: [{ scale: pop ? 1.25 : 1 }],
            // No text selection while dragging (web ends the drag on select).
            userSelect: "none",
          }}
        >
          {picture}
        </Text>
      )}
    </View>
  );
}

/**
 * Maze, kids variant: drag the animal (or tap the next square) through a
 * small maze to its treat. 4×4, 5×5, then 6×6; walls just stop the animal.
 * After 6 s without progress the next square glows softly. No timer, no
 * losing; three mazes, then the celebration. Records nothing.
 */
export default function KidsMazeGame({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [seed, setSeed] = useState(newSeed);
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState(0);
  const [won, setWon] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const posRef = useRef(0);
  const wonRef = useRef<boolean>(false);
  const origin = useRef({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = round >= KIDS_MAZE_ROUNDS;
  const size = KIDS_MAZE_SIZES[Math.min(round, KIDS_MAZE_ROUNDS - 1)];
  const [maze, setMaze] = useState<KidsMaze>(() =>
    generateMaze(KIDS_MAZE_SIZES[0], seed)
  );
  const [animal, treat] = PAIRS[(seed + round) % PAIRS.length];
  const goal = mazeGoal(maze);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  // Soft hint: after a quiet spell, glow the next square toward the treat.
  useEffect(() => {
    setHint(null);
    if (done || won) {
      return;
    }
    const id = setTimeout(
      () => setHint(nextHintCell(maze, pos)),
      KIDS_MAZE_HINT_MS
    );
    return () => clearTimeout(id);
  }, [done, maze, pos, won]);

  const startRound = (next: number, nextSeed: number) => {
    const m = generateMaze(KIDS_MAZE_SIZES[next], nextSeed + next);
    posRef.current = mazeStart(m);
    wonRef.current = false;
    setMaze(m);
    setPos(posRef.current);
    setWon(false);
  };

  const moveTo = (target: number) => {
    if (wonRef.current) {
      return;
    }
    const next = stepToward(maze, posRef.current, target);
    if (next === posRef.current) {
      return;
    }
    posRef.current = next;
    setPos(next);
    if (next !== goal) {
      haptic.tap();
      return;
    }
    haptic.success();
    wonRef.current = true;
    setWon(true);
    timer.current = setTimeout(() => {
      const nextRound = round + 1;
      setRound(nextRound);
      if (nextRound < KIDS_MAZE_ROUNDS) {
        startRound(nextRound, seed);
      }
    }, WON_MS);
  };

  const handleAgain = () => {
    const s = newSeed();
    setSeed(s);
    setRound(0);
    startRound(0, s);
  };

  if (done) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const board = Math.floor(
    Math.max(
      200,
      Math.min(width - 8, height - STARS_HEIGHT - 32, MAX_BOARD) - WALL * 2
    )
  );
  const cell = Math.floor(board / size);
  const inner = cell * size;

  const fingerAt = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    moveTo(
      cellAt(size, cell, pageX - origin.current.x, pageY - origin.current.y)
    );
  };
  const handleGrant = (e: GestureResponderEvent) => {
    const { locationX, locationY, pageX, pageY } = e.nativeEvent;
    origin.current = { x: pageX - locationX, y: pageY - locationY };
    fingerAt(e);
  };

  const exits = new Set(
    [pos - size, pos + 1, pos + size, pos - 1].filter((n) =>
      canMove(maze, pos, n)
    )
  );

  return (
    <View style={styles.root}>
      <KidsStars done={round + (won ? 1 : 0)} total={KIDS_MAZE_ROUNDS} />
      <View
        style={[
          styles.frame,
          { backgroundColor: theme.kidsTile3, borderColor: theme.kidsOnTile },
        ]}
      >
        <View
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleGrant}
          onResponderMove={fingerAt}
          onResponderRelease={fingerAt}
          onStartShouldSetResponder={() => true}
          style={{ height: inner, width: inner }}
          testID={`kids-maze-${String(size)}-${String(maze.seed)}`}
        >
          {Array.from({ length: size * size }, (_, i) => {
            let picture: string | null = null;
            if (i === pos) {
              picture = animal;
            } else if (i === goal) {
              picture = treat;
            }
            return (
              <MazeCell
                cellPx={cell}
                glow={hint === i ? theme.kidsTile2 : null}
                index={i}
                isExit={exits.has(i)}
                key={`cell-${String(maze.seed)}-${String(i)}`}
                label={t("kidsA11yCell", { n: i + 1 })}
                maze={maze}
                onActivate={() => moveTo(i)}
                picture={picture}
                pop={i === pos && won}
                wallColor={theme.kidsOnTile}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    position: "absolute",
  },
  frame: { borderRadius: 18, borderWidth: WALL, overflow: "hidden" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
});
