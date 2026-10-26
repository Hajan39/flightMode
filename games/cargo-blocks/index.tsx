import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  Pressable,
  View as RNView,
  StyleSheet,
} from "react-native";
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import {
  A11yOverlayContent,
  A11yOverlayScope,
} from "@/components/A11yOverlayScope";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  anyFits,
  BOARD_SIZE,
  canPlace,
  clearedCells,
  findClears,
  type GameState,
  idx,
  newGame,
  type Piece,
  place,
  placementCovering,
  playMove,
} from "./logic";

const GAME_ID = "cargo-blocks";

/** Luggage-tag colors, saturated enough to read on light and dark surfaces. */
const TAG_COLORS = [
  "#e5484d", // red
  "#f5a623", // amber
  "#2bb3a0", // teal
  "#3d8bfd", // blue
  "#9b6bf2", // violet
  "#4caf50", // green
];

const BOARD_PAD = 6;
/** Vertical room reserved for the header, stats bar, popup row and tray. */
const RESERVED_HEIGHT = 380;
const TRAY_SCALE = 0.5;
const FLASH_MS = 420;
const POP_MS = 950;
/** A tray touch that moves less than this is a tap (select), not a drag. */
const TAP_SLOP = 8;

interface Point {
  x: number;
  y: number;
}
interface Target {
  col: number;
  row: number;
}
interface Flash {
  cells: { color: number; i: number }[];
  id: number;
}
interface Pop {
  gained: number;
  id: number;
  lines: number;
  streak: number;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function Block({
  color,
  size,
  ghost,
}: {
  color: number;
  ghost?: boolean;
  size: number;
}) {
  const inset = Math.max(1, size * 0.05);
  return (
    <RNView
      style={[
        styles.block,
        {
          backgroundColor: TAG_COLORS[color - 1],
          borderBottomWidth: Math.max(2, size * 0.12),
          borderRadius: size * 0.2,
          borderTopWidth: Math.max(1, size * 0.05),
          height: size - inset * 2,
          margin: inset,
          opacity: ghost ? 0.4 : 1,
          width: size - inset * 2,
        },
      ]}
    />
  );
}

function PieceView({ piece, cell }: { cell: number; piece: Piece }) {
  return (
    <RNView
      style={{
        height: piece.shape.height * cell,
        width: piece.shape.width * cell,
      }}
    >
      {piece.shape.cells.map(([r, c]) => (
        <RNView
          key={`${r}-${c}`}
          style={[styles.abs, { left: c * cell, top: r * cell }]}
        >
          <Block color={piece.color} size={cell} />
        </RNView>
      ))}
    </RNView>
  );
}

/** A cleared cell bursting out: scales up while fading. */
function FlashCell({
  color,
  cell,
  i,
}: {
  cell: number;
  color: number;
  i: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: FLASH_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 + progress.value * 0.4 }],
  }));
  const row = Math.floor(i / BOARD_SIZE);
  const col = i % BOARD_SIZE;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        { left: BOARD_PAD + col * cell, top: BOARD_PAD + row * cell },
        style,
      ]}
    >
      <Block color={color} size={cell} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export default function CargoBlocksGame() {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width, height } = useGameDimensions();

  const storedBest = useGameStore((s) => s.progress[GAME_ID]?.highScore ?? 0);
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [game, setGame] = useState<GameState>(() => newGame(Math.random));
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [hover, setHover] = useState<Target | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);
  const [over, setOver] = useState(false);
  /** Tap-to-place: the tray piece picked with a tap (or screen-reader double-tap). */
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Sizing: fit the board to the column width and to the height left over.
  const boardSize = Math.max(
    200,
    Math.min(width - Spacing.lg * 2, height - RESERVED_HEIGHT)
  );
  const cell = (boardSize - BOARD_PAD * 2) / BOARD_SIZE;
  const slotWidth = boardSize / 3;
  const trayCell = Math.min(cell * TRAY_SCALE, (slotWidth - Spacing.sm) / 5);
  const trayHeight = trayCell * 5 + Spacing.md;
  /** The dragged piece floats this far above the finger so it stays visible. */
  const lift = cell * 1.2;

  // Window-space origins (touches arrive as pageX/pageY).
  const rootRef = useRef<RNView>(null);
  const boardRef = useRef<RNView>(null);
  const rootOrigin = useRef<Point>({ x: 0, y: 0 });
  const boardOrigin = useRef<Point>({ x: 0, y: 0 });
  const measure = () => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOrigin.current = { x, y };
    });
    boardRef.current?.measureInWindow((x, y) => {
      boardOrigin.current = { x, y };
    });
  };

  const hoverRef = useRef<Target | null>(null);
  const touchStartRef = useRef<Point | null>(null);
  const movedRef = useRef<boolean>(false);
  const endedRef = useRef<boolean>(false);
  const overTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popId = useRef(0);

  const floatX = useSharedValue(0);
  const floatY = useSharedValue(0);
  const floatScale = useSharedValue(1);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: floatX.value },
      { translateY: floatY.value },
      { scale: floatScale.value },
    ],
  }));

  useEffect(() => {
    if (!flash) {
      return;
    }
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!pop) {
      return;
    }
    const timer = setTimeout(() => setPop(null), POP_MS);
    return () => clearTimeout(timer);
  }, [pop]);

  useEffect(
    () => () => {
      if (overTimer.current) {
        clearTimeout(overTimer.current);
      }
    },
    []
  );

  const restart = () => {
    if (overTimer.current) {
      clearTimeout(overTimer.current);
      overTimer.current = null;
    }
    endedRef.current = false;
    hoverRef.current = null;
    setGame(newGame(Math.random));
    setDragSlot(null);
    setHover(null);
    setFlash(null);
    setPop(null);
    setPaused(false);
    setResult(null);
    setOver(false);
    setSelectedSlot(null);
  };

  const endGame = (finalScore: number) => {
    if (endedRef.current) {
      return;
    }
    endedRef.current = true;
    haptic.error();
    setResult(updateProgress(GAME_ID, finalScore));
    setOver(true);
  };

  // --- Drag -----------------------------------------------------------------

  const moveDrag = (piece: Piece, e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const w = piece.shape.width * cell;
    const h = piece.shape.height * cell;
    const left = pageX - w / 2;
    const top = pageY - lift - h;
    floatX.value = left - rootOrigin.current.x;
    floatY.value = top - rootOrigin.current.y;

    const col = Math.round((left - boardOrigin.current.x - BOARD_PAD) / cell);
    const row = Math.round((top - boardOrigin.current.y - BOARD_PAD) / cell);
    const next = canPlace(game.board, piece.shape, row, col)
      ? { col, row }
      : null;
    const prev = hoverRef.current;
    if (next?.row !== prev?.row || next?.col !== prev?.col) {
      hoverRef.current = next;
      setHover(next);
    }
  };

  const slotResponder = (slot: number) => {
    const piece = game.tray[slot];
    const active = Boolean(piece) && !paused && !over && !endedRef.current;
    return {
      onResponderGrant: (e: GestureResponderEvent) => {
        if (!piece) {
          return;
        }
        touchStartRef.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        };
        movedRef.current = false;
        measure();
        haptic.tap();
        setDragSlot(slot);
        floatScale.value = TRAY_SCALE;
        floatScale.value = withTiming(1, { duration: 120 });
        moveDrag(piece, e);
      },
      onResponderMove: (e: GestureResponderEvent) => {
        const start = touchStartRef.current;
        if (
          start &&
          Math.hypot(
            e.nativeEvent.pageX - start.x,
            e.nativeEvent.pageY - start.y
          ) > TAP_SLOP
        ) {
          movedRef.current = true;
        }
        if (piece) {
          moveDrag(piece, e);
        }
      },
      onResponderRelease: () => {
        if (movedRef.current) {
          drop(slot);
          return;
        }
        // A tap selects the piece; the next tap on the hold places it.
        drop(null);
        selectPiece(slot);
      },
      onResponderTerminate: () => drop(null),
      onResponderTerminationRequest: () => false,
      onStartShouldSetResponder: () => active,
    };
  };

  const drop = (slot: number | null) => {
    const target = hoverRef.current;
    hoverRef.current = null;
    setHover(null);
    setDragSlot(null);
    const piece = slot === null ? null : game.tray[slot];
    if (slot === null || !(piece && target)) {
      return;
    }
    commitMove(slot, piece, target);
  };

  const canAct = () => !(paused || over || endedRef.current);

  const selectPiece = (slot: number) => {
    if (!(game.tray[slot] && canAct())) {
      return;
    }
    haptic.tap();
    setSelectedSlot((current) => (current === slot ? null : slot));
  };

  /** Tap on the hold with a piece selected: place it so it covers that cell. */
  const placeSelectedAt = (row: number, col: number) => {
    const piece = selectedSlot === null ? null : game.tray[selectedSlot];
    if (selectedSlot === null || !piece || !canAct()) {
      return;
    }
    const target = placementCovering(game.board, piece.shape, row, col);
    if (!target) {
      haptic.error();
      return;
    }
    commitMove(selectedSlot, piece, target);
  };

  const commitMove = (slot: number, piece: Piece, target: Target) => {
    setSelectedSlot(null);
    const res = playMove(game, slot, target.row, target.col, Math.random);
    if (!res) {
      return;
    }
    setGame(res.state);

    if (res.lines > 0) {
      const placed = place(game.board, piece, target.row, target.col);
      popId.current += 1;
      setFlash({
        cells: res.cleared.map((i) => ({ color: placed[i], i })),
        id: popId.current,
      });
      setPop({
        gained: res.gained,
        id: popId.current,
        lines: res.lines,
        streak: res.state.streak,
      });
      if (res.lines > 1) {
        haptic.heavy();
      } else {
        haptic.success();
      }
    } else {
      haptic.tap();
    }

    if (res.over) {
      const finalScore = res.state.score;
      overTimer.current = setTimeout(
        () => endGame(finalScore),
        res.lines > 0 ? 700 : 400
      );
    }
  };

  // --- Preview --------------------------------------------------------------

  const dragPiece = dragSlot === null ? null : game.tray[dragSlot];
  const ghost = new Set<number>();
  let willClear = new Set<number>();
  if (dragPiece && hover) {
    for (const [r, c] of dragPiece.shape.cells) {
      ghost.add(idx(hover.row + r, hover.col + c));
    }
    const placed = place(game.board, dragPiece, hover.row, hover.col);
    willClear = new Set(clearedCells(findClears(placed)));
  }

  const renderCell = (value: number, i: number) => {
    let content: ReactNode = null;
    if (dragPiece && willClear.has(i)) {
      content = <Block color={dragPiece.color} size={cell} />;
    } else if (dragPiece && ghost.has(i)) {
      content = <Block color={dragPiece.color} ghost size={cell} />;
    } else if (value !== 0) {
      content = <Block color={value} size={cell} />;
    }
    const row = Math.floor(i / BOARD_SIZE);
    const col = i % BOARD_SIZE;
    const placing = selectedSlot !== null;
    return (
      <Pressable
        accessibilityHint={placing ? placeHint : undefined}
        accessibilityLabel={`${t("a11yRowCol", { col: col + 1, row: row + 1 })}, ${
          value === 0 ? t("cbA11yEmpty") : t("cbA11yFilled")
        }`}
        accessibilityRole={placing ? "button" : "text"}
        disabled={!placing}
        key={i}
        onPress={() => placeSelectedAt(row, col)}
        style={[
          styles.abs,
          {
            height: cell,
            left: BOARD_PAD + col * cell,
            top: BOARD_PAD + row * cell,
            width: cell,
          },
        ]}
      >
        <RNView
          style={[
            styles.slot,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              borderRadius: cell * 0.2,
              margin: Math.max(1, cell * 0.05),
            },
          ]}
        />
        {content ? <RNView style={styles.abs}>{content}</RNView> : null}
      </Pressable>
    );
  };
  const placeHint = t("cbA11yPlaceHint");
  const selectHint = t("cbA11ySelectHint");

  return (
    <A11yOverlayScope>
      <RNView
        onLayout={measure}
        ref={rootRef}
        style={[styles.screen, { backgroundColor: theme.background }]}
      >
        <A11yOverlayContent style={styles.container}>
          <RNView style={[styles.topBar, { width: boardSize }]}>
            <RNView style={styles.statsRow}>
              <RNView
                style={[
                  styles.statBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                  {t("cbScore")}
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {game.score}
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.statBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                  {t("cbBest")}
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {Math.max(storedBest, game.score)}
                </Text>
              </RNView>
            </RNView>
            <GameControls
              isPaused={paused}
              onPause={() => setPaused((p) => !p)}
              onReset={restart}
            />
          </RNView>

          <RNView style={styles.popRow}>
            {pop ? (
              <Animated.View
                entering={ZoomIn.duration(180)}
                exiting={FadeOut.duration(200)}
                key={pop.id}
                style={styles.popInner}
              >
                <Text style={[styles.popScore, { color: theme.tint }]}>
                  +{pop.gained}
                </Text>
                {pop.lines > 1 ? (
                  <Text style={[styles.popTag, { color: theme.warning }]}>
                    {t("cbCombo", { count: pop.lines })}
                  </Text>
                ) : null}
                {pop.streak > 1 ? (
                  <Text style={[styles.popTag, { color: theme.mutedText }]}>
                    {t("cbStreak", { count: pop.streak })}
                  </Text>
                ) : null}
              </Animated.View>
            ) : (
              <Text style={[styles.hint, { color: theme.mutedText }]}>
                {t("cbHint")}
              </Text>
            )}
          </RNView>

          <RNView
            onLayout={measure}
            ref={boardRef}
            style={[
              styles.board,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                height: boardSize,
                width: boardSize,
              },
            ]}
          >
            {game.board.map(renderCell)}
            {flash?.cells.map((f) => (
              <FlashCell
                cell={cell}
                color={f.color}
                i={f.i}
                key={`${flash.id}-${f.i}`}
              />
            ))}
          </RNView>

          <RNView
            style={[styles.tray, { height: trayHeight, width: boardSize }]}
          >
            {game.tray.map((piece, slot) => {
              const fits = piece ? anyFits(game.board, piece.shape) : false;
              let opacity = fits ? 1 : 0.35;
              if (dragSlot === slot) {
                opacity = 0;
              }
              const isSelected = selectedSlot === slot;
              const labelParts = [t("cbPieceLabel", { index: slot + 1 })];
              if (piece) {
                labelParts.push(
                  t("cbA11yPieceSize", {
                    cells: piece.shape.cells.length,
                    height: piece.shape.height,
                    width: piece.shape.width,
                  })
                );
                if (!fits) {
                  labelParts.push(t("cbA11yNoFit"));
                }
              }
              return (
                <RNView
                  accessibilityActions={
                    piece ? [{ name: "activate" }] : undefined
                  }
                  accessibilityHint={piece ? selectHint : undefined}
                  accessibilityLabel={labelParts.join(", ")}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !piece,
                    selected: isSelected,
                  }}
                  accessible
                  key={slot}
                  onAccessibilityAction={(e: AccessibilityActionEvent) => {
                    if (e.nativeEvent.actionName === "activate") {
                      selectPiece(slot);
                    }
                  }}
                  style={[
                    styles.traySlot,
                    {
                      opacity,
                      width: slotWidth,
                    },
                    isSelected
                      ? [styles.traySlotSelected, { borderColor: theme.tint }]
                      : null,
                  ]}
                  {...slotResponder(slot)}
                >
                  {piece ? <PieceView cell={trayCell} piece={piece} /> : null}
                </RNView>
              );
            })}
          </RNView>
        </A11yOverlayContent>

        {dragPiece ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.float,
              {
                height: dragPiece.shape.height * cell,
                width: dragPiece.shape.width * cell,
              },
              floatStyle,
            ]}
          >
            <PieceView cell={cell} piece={dragPiece} />
          </Animated.View>
        ) : null}

        <GamePauseOverlay
          onRestart={restart}
          onResume={() => setPaused(false)}
          visible={paused}
        />

        {over && result ? (
          <GameResult
            best={result.best}
            isNewBest={result.isNewBest}
            last={result.last === game.score ? undefined : result.last}
            onPlayAgain={restart}
            score={game.score}
            streak={result.currentStreak > 0 ? result.currentStreak : undefined}
            title={t("cbHoldFull")}
          />
        ) : null}
      </RNView>
    </A11yOverlayScope>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  block: {
    borderBottomColor: "rgba(0,0,0,0.25)",
    borderTopColor: "rgba(255,255,255,0.35)",
  },
  board: {
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  float: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  hint: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  popInner: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  popRow: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
  },
  popScore: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
  },
  popTag: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extrabold,
  },
  screen: { flex: 1 },
  slot: {
    borderWidth: 1,
    flex: 1,
    opacity: 0.6,
  },
  statBox: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statLabel: {
    ...TextStyle.statLabel,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tray: {
    flexDirection: "row",
  },
  traySlot: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
  },
  traySlotSelected: { borderRadius: Radius.card, borderWidth: 2 },
});
