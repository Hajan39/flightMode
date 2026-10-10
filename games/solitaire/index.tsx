import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  Text as RNText,
  View as RNView,
  StyleSheet,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
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
import {
  applyMove,
  type Card,
  canAutoComplete,
  canPickUp,
  cardId,
  type DrawCount,
  dealPlayable,
  draw,
  finalScore,
  type GameState,
  getPile,
  isLegalMove,
  isRed,
  isWon,
  legalDestinations,
  mulberry32,
  nextAutoMove,
  type PileRef,
  RANK_LABELS,
  SUIT_SYMBOLS,
  undo,
} from "./logic";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const GAP = 4;
const ROW_GAP = 12;
const CARD_RATIO = 1.42;
/** Draw-3 waste fan offset, as a share of card width. */
const FAN = 0.32;
const MOVE_MS = 170;
const DEAL_STAGGER_MS = 14;
const AUTO_STEP_MS = 90;
const DRAG_SLOP = 6;

const RED = "#d32f2f";
const BLACK = "#1c1c1e";
const FACE_LIGHT = "#ffffff";
const FACE_DARK = "#eceae4";

interface Geometry {
  cardH: number;
  cardW: number;
  /** Rank/suit corner font size. */
  font: number;
  left: number;
  tableauTop: number;
}

interface Placed {
  card: Card;
  id: number;
  x: number;
  y: number;
  z: number;
}

interface Layout {
  placed: Placed[];
  /** Card y positions per tableau pile (for hit testing). */
  tabY: number[][];
}

type Hit = { kind: "stock" } | { cardIndex: number; from: PileRef } | null;

interface Drop {
  dx: number;
  dy: number;
  ids: number[];
  token: number;
}

interface DragInfo {
  active: boolean;
  cardIndex: number;
  from: PileRef | null;
  ids: number[];
  isStock: boolean;
  originX: number;
  originY: number;
  pageX: number;
  pageY: number;
}

interface Clock {
  pausedAt: number | null;
  pausedMs: number;
  start: number;
}

function colX(geo: Geometry, col: number): number {
  return geo.left + col * (geo.cardW + GAP);
}

function makeGeometry(width: number, height: number): Geometry {
  let cardW = Math.floor((width - GAP * 6) / 7);
  // Keep at least ~3 card heights of tableau room on squat viewports.
  const maxH = (height - ROW_GAP) / 4;
  if (cardW * CARD_RATIO > maxH) {
    cardW = Math.floor(maxH / CARD_RATIO);
  }
  const cardH = Math.round(cardW * CARD_RATIO);
  return {
    cardH,
    cardW,
    font: Math.max(11, Math.round(cardW * 0.3)),
    left: Math.floor((width - (cardW * 7 + GAP * 6)) / 2),
    tableauTop: cardH + ROW_GAP,
  };
}

/** Per-pile offsets: shrink face-up then face-down spacing until the pile fits. */
function pileOffsets(
  pile: Card[],
  geo: Geometry,
  availH: number
): [number, number] {
  const downs = pile.filter((c) => !c.up).length;
  const ups = Math.max(0, pile.length - downs - 1);
  let fd = Math.round(geo.cardH * 0.12);
  let fu = Math.round(geo.cardH * 0.32);
  const minFu = geo.font + 3;
  const room = availH - geo.cardH;
  if (downs * fd + ups * fu > room && ups > 0) {
    fu = Math.max(minFu, (room - downs * fd) / ups);
  }
  if (downs * fd + ups * fu > room && downs > 0) {
    fd = Math.max(2, (room - ups * fu) / downs);
  }
  return [fd, fu];
}

function layoutBoard(game: GameState, geo: Geometry, boardH: number): Layout {
  const placed: Placed[] = [];
  const put = (card: Card, x: number, y: number, z: number) =>
    placed.push({ card, id: cardId(card), x, y, z });

  for (const [i, card] of game.stock.entries()) {
    put(card, colX(geo, 0), 0, 10 + i);
  }
  const fanStart =
    game.drawCount === 3
      ? Math.max(0, game.waste.length - 3)
      : game.waste.length;
  for (const [i, card] of game.waste.entries()) {
    const fanIdx = Math.max(0, i - fanStart);
    put(card, colX(geo, 1) + fanIdx * geo.cardW * FAN, 0, 100 + i);
  }
  for (const [f, pile] of game.foundations.entries()) {
    for (const [i, card] of pile.entries()) {
      put(card, colX(geo, 3 + f), 0, 300 + i);
    }
  }
  const availH = boardH - geo.tableauTop;
  const tabY = game.tableau.map((pile, col) => {
    const [fd, fu] = pileOffsets(pile, geo, availH);
    const ys: number[] = [];
    let y = geo.tableauTop;
    for (const [i, card] of pile.entries()) {
      ys.push(y);
      put(card, colX(geo, col), y, 200 + i);
      y += card.up ? fu : fd;
    }
    return ys;
  });
  return { placed, tabY };
}

function hitTest(
  game: GameState,
  geo: Geometry,
  tabY: number[][],
  x: number,
  y: number
): Hit {
  const col = Math.min(
    6,
    Math.max(0, Math.floor((x - geo.left) / (geo.cardW + GAP)))
  );
  if (y < geo.cardH + ROW_GAP / 2) {
    if (col === 0) {
      return { kind: "stock" };
    }
    if (col <= 2) {
      return game.waste.length > 0
        ? { cardIndex: game.waste.length - 1, from: { kind: "waste" } }
        : null;
    }
    const pile = game.foundations[col - 3];
    return pile.length > 0
      ? {
          cardIndex: pile.length - 1,
          from: { index: col - 3, kind: "foundation" },
        }
      : null;
  }
  const ys = tabY[col];
  const last = ys.length - 1;
  if (last < 0 || y > ys[last] + geo.cardH) {
    return null;
  }
  for (let i = last; i >= 0; i -= 1) {
    if (y >= ys[i]) {
      return { cardIndex: i, from: { index: col, kind: "tableau" } };
    }
  }
  return null;
}

/** Where a dragged card lands, judged by the top-centre of the dragged card. */
function dropTarget(geo: Geometry, cx: number, cy: number): PileRef | null {
  const col = Math.floor((cx - geo.left + GAP / 2) / (geo.cardW + GAP));
  if (col < 0 || col > 6) {
    return null;
  }
  if (cy < geo.cardH + ROW_GAP / 2) {
    return col >= 3 ? { index: col - 3, kind: "foundation" } : null;
  }
  return { index: col, kind: "tableau" };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface CardViewProps {
  backColor: string;
  backInk: string;
  card: Card;
  dealDelay: number;
  dragging: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  drop: Drop | null;
  faceColor: string;
  geo: Geometry;
  startX: number;
  x: number;
  y: number;
  z: number;
}

function CardView({
  backColor,
  backInk,
  card,
  dealDelay,
  dragging,
  dragX,
  dragY,
  drop,
  faceColor,
  geo,
  startX,
  x,
  y,
  z,
}: CardViewProps) {
  // Cards mount on the stock and fly to their dealt position.
  const ax = useSharedValue(startX);
  const ay = useSharedValue(0);
  const lift = useSharedValue(1);
  const mounted = useRef<boolean>(false);
  const appliedDrop = useRef(0);
  const dropToken = drop?.token ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: animate only when the target or a drop changes; shared values and the deal delay are stable per mount
  useLayoutEffect(() => {
    let delay = 0;
    if (mounted.current) {
      if (drop && drop.token !== appliedDrop.current) {
        // Continue from where the finger let go instead of jumping back.
        appliedDrop.current = drop.token;
        ax.value += drop.dx;
        ay.value += drop.dy;
      }
    } else {
      mounted.current = true;
      delay = dealDelay;
    }
    lift.value = 1;
    ax.value = withDelay(delay, withTiming(x, { duration: MOVE_MS }));
    ay.value = withDelay(
      delay,
      withTiming(y, { duration: MOVE_MS }, (finished) => {
        if (finished) {
          lift.value = 0;
        }
      })
    );
  }, [x, y, dropToken]);

  const animStyle = useAnimatedStyle(() => {
    let zIndex = z;
    if (dragging) {
      zIndex = 1000 + z;
    } else if (lift.value) {
      zIndex = 2000 + z;
    }
    return {
      transform: [
        { translateX: ax.value + (dragging ? dragX.value : 0) },
        { translateY: ay.value + (dragging ? dragY.value : 0) },
      ],
      zIndex,
    };
  });

  const { cardW, cardH, font } = geo;
  const color = isRed(card) ? RED : BLACK;

  return (
    <Animated.View
      style={[
        styles.card,
        { height: cardH, width: cardW },
        card.up
          ? { backgroundColor: faceColor, borderColor: "rgba(0,0,0,0.28)" }
          : { backgroundColor: backColor, borderColor: "rgba(0,0,0,0.35)" },
        animStyle,
      ]}
    >
      {card.up ? (
        <>
          <RNView style={styles.corner}>
            <RNText
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.rank, { color, fontSize: font }]}
            >
              {RANK_LABELS[card.rank]}
            </RNText>
            <RNText
              allowFontScaling={false}
              style={[styles.suitSmall, { color, fontSize: font * 0.85 }]}
            >
              {SUIT_SYMBOLS[card.suit]}
            </RNText>
          </RNView>
          <RNText
            allowFontScaling={false}
            style={[
              styles.suitBig,
              { color, fontSize: cardW * 0.52, lineHeight: cardW * 0.62 },
            ]}
          >
            {SUIT_SYMBOLS[card.suit]}
          </RNText>
        </>
      ) : (
        <RNView style={[styles.backInner, { borderColor: backInk }]}>
          <RNText
            allowFontScaling={false}
            style={{ color: backInk, fontSize: cardW * 0.38 }}
          >
            ✈︎
          </RNText>
        </RNView>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

type Phase = "menu" | "playing" | "won";

export default function SolitaireGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const router = useRouter();
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("menu");
  const [drawCount, setDrawCount] = useState<DrawCount>(1);
  const [game, setGame] = useState<GameState | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const [clock, setClock] = useState<Clock>({
    pausedAt: null,
    pausedMs: 0,
    start: 0,
  });
  const [now, setNow] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [board, setBoard] = useState<{ h: number; w: number } | null>(null);
  const [dragIds, setDragIds] = useState<number[]>([]);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);
  const [final, setFinal] = useState({ moves: 0, score: 0, seconds: 0 });

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragRef = useRef<DragInfo | null>(null);

  const elapsedSec = (at: number) =>
    Math.max(
      0,
      Math.floor(((clock.pausedAt ?? at) - clock.start - clock.pausedMs) / 1000)
    );

  // Wall-clock display tick (the value itself always comes from Date.now()).
  useEffect(() => {
    if (phase !== "playing" || paused) {
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  const startGame = (count: DrawCount) => {
    setDrawCount(count);
    setGame(dealPlayable(count, mulberry32(Date.now())));
    setDealKey((k) => k + 1);
    const start = Date.now();
    setClock({ pausedAt: null, pausedMs: 0, start });
    setNow(start);
    setPaused(false);
    setAutoRunning(false);
    setDragIds([]);
    setDrop(null);
    setResult(null);
    setPhase("playing");
  };

  /** Restarting or quitting mid-game counts as a loss once the player has moved. */
  const resign = () => {
    if (phase === "playing" && game && game.moves > 0) {
      updateProgress("solitaire", 0, { won: false });
    }
  };

  const commit = (next: GameState) => {
    setGame(next);
    if (!isWon(next)) {
      return;
    }
    const seconds = elapsedSec(Date.now());
    const score = finalScore(next.score, seconds);
    setFinal({ moves: next.moves, score, seconds });
    setResult(updateProgress("solitaire", score, { won: true }));
    setAutoRunning(false);
    haptic.success();
    setPhase("won");
  };

  // Auto-complete: one card home per step, each step re-scheduled by the new state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: commit/haptic are recreated every render; a step depends only on the game state and run flags
  useEffect(() => {
    if (!(autoRunning && game) || phase !== "playing" || paused) {
      return;
    }
    const id = setTimeout(() => {
      const move = nextAutoMove(game);
      const next = move ? applyMove(game, move) : null;
      if (next) {
        haptic.tap();
        commit(next);
      } else {
        setAutoRunning(false);
      }
    }, AUTO_STEP_MS);
    return () => clearTimeout(id);
  }, [autoRunning, game, phase, paused]);

  const pause = () => {
    setPaused(true);
    setClock((c) => (c.pausedAt ? c : { ...c, pausedAt: Date.now() }));
  };
  const resume = () => {
    setPaused(false);
    setClock((c) =>
      c.pausedAt
        ? {
            ...c,
            pausedAt: null,
            pausedMs: c.pausedMs + Date.now() - c.pausedAt,
          }
        : c
    );
  };

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoard({ h: height, w: width });
  };

  const geo = board ? makeGeometry(board.w, board.h) : null;
  const layout = game && geo && board ? layoutBoard(game, geo, board.h) : null;
  const interactive = phase === "playing" && !paused && !autoRunning;

  // ---------------------------------------------------------------------------
  // Touch handling (one responder for the whole board; cards ignore touches)
  // ---------------------------------------------------------------------------

  const tapMove = (from: PileRef, cardIndex: number) => {
    if (!game) {
      return;
    }
    const [to] = legalDestinations(game, from, cardIndex);
    const next = to ? applyMove(game, { cardIndex, from, to }) : null;
    if (next) {
      haptic.tap();
      setDrop(null);
      commit(next);
    } else {
      haptic.error();
    }
  };

  const onGrant = (e: GestureResponderEvent) => {
    if (!(game && geo && layout)) {
      return;
    }
    const { locationX, locationY, pageX, pageY } = e.nativeEvent;
    const hit = hitTest(game, geo, layout.tabY, locationX, locationY);
    const info: DragInfo = {
      active: false,
      cardIndex: 0,
      from: null,
      ids: [],
      isStock: hit !== null && "kind" in hit,
      originX: 0,
      originY: 0,
      pageX,
      pageY,
    };
    if (hit && "from" in hit && canPickUp(game, hit.from, hit.cardIndex)) {
      const cards = getPile(game, hit.from).slice(hit.cardIndex);
      const first = layout.placed.find((p) => p.id === cardId(cards[0]));
      info.from = hit.from;
      info.cardIndex = hit.cardIndex;
      info.ids = cards.map(cardId);
      info.originX = first?.x ?? 0;
      info.originY = first?.y ?? 0;
    }
    dragRef.current = info;
  };

  const onMove = (e: GestureResponderEvent) => {
    const info = dragRef.current;
    if (!info?.from) {
      return;
    }
    const dx = e.nativeEvent.pageX - info.pageX;
    const dy = e.nativeEvent.pageY - info.pageY;
    if (!info.active && Math.hypot(dx, dy) > DRAG_SLOP) {
      info.active = true;
      setDragIds(info.ids);
    }
    if (info.active) {
      dragX.value = dx;
      dragY.value = dy;
    }
  };

  const onRelease = (e: GestureResponderEvent) => {
    const info = dragRef.current;
    dragRef.current = null;
    if (!(info && game && geo)) {
      return;
    }
    if (!info.active) {
      if (info.isStock) {
        const next = draw(game);
        if (next) {
          haptic.tap();
          setDrop(null);
          commit(next);
        }
      } else if (info.from) {
        tapMove(info.from, info.cardIndex);
      }
      return;
    }
    const { from } = info;
    const dx = e.nativeEvent.pageX - info.pageX;
    const dy = e.nativeEvent.pageY - info.pageY;
    const to = dropTarget(
      geo,
      info.originX + dx + geo.cardW / 2,
      info.originY + dy + geo.cardH * 0.25
    );
    let next: GameState | null = null;
    if (from && to) {
      const move = { cardIndex: info.cardIndex, from, to };
      if (to.kind === "foundation" && !isLegalMove(game, move)) {
        // Dropped anywhere on the foundation row: use whichever foundation fits.
        const [best] = legalDestinations(game, from, info.cardIndex);
        next =
          best?.kind === "foundation"
            ? applyMove(game, { ...move, to: best })
            : null;
      } else {
        next = applyMove(game, move);
      }
    }
    setDrop({ dx, dy, ids: info.ids, token: Date.now() });
    setDragIds([]);
    if (next) {
      haptic.tap();
      commit(next);
    } else {
      haptic.error();
    }
  };

  const onTerminate = () => {
    const info = dragRef.current;
    dragRef.current = null;
    if (info?.active) {
      setDrop({
        dx: dragX.value,
        dy: dragY.value,
        ids: info.ids,
        token: Date.now(),
      });
      setDragIds([]);
    }
  };

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------

  if (phase === "menu") {
    return (
      <View style={[styles.menu, { backgroundColor: theme.background }]}>
        <Text style={styles.menuTitle}>{t("gameSolitaireName")}</Text>
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("solChooseMode")}
        </Text>
        {([1, 3] as const).map((count) => (
          <Pressable
            accessibilityRole="button"
            key={count}
            onPress={() => {
              haptic.tap();
              startGame(count);
            }}
            style={[
              styles.modeBtn,
              count === drawCount
                ? { backgroundColor: theme.tint, borderColor: theme.tint }
                : { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.modeTitle,
                { color: count === drawCount ? theme.onTint : theme.text },
              ]}
            >
              {count === 1 ? t("solDraw1") : t("solDraw3")}
            </Text>
            <Text
              style={[
                styles.modeDesc,
                { color: count === drawCount ? theme.onTint : theme.mutedText },
              ]}
            >
              {count === 1 ? t("solDraw1Desc") : t("solDraw3Desc")}
            </Text>
          </Pressable>
        ))}
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("solHint")}
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Board
  // ---------------------------------------------------------------------------

  const faceColor = colorScheme === "light" ? FACE_LIGHT : FACE_DARK;
  const showAuto = !!game && canAutoComplete(game) && !autoRunning;
  const slot = { backgroundColor: theme.card, borderColor: theme.border };

  const stat = (label: string, value: string) => (
    <RNView
      style={[
        styles.statBox,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.mutedText }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </RNView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RNView style={styles.topBar}>
        <RNView style={styles.statsRow}>
          {stat(t("solTime"), formatTime(elapsedSec(now)))}
          {stat(t("solMoves"), String(game?.moves ?? 0))}
          {stat(t("solScore"), String(game?.score ?? 0))}
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={() => (paused ? resume() : pause())}
          onReset={() => {
            resign();
            startGame(drawCount);
          }}
        />
      </RNView>

      <RNView
        onLayout={onBoardLayout}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onTerminate}
        onResponderTerminationRequest={() => !dragRef.current?.active}
        onStartShouldSetResponder={() => interactive}
        style={styles.board}
      >
        {geo && layout && game ? (
          <RNView pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Empty pile slots */}
            <RNView
              style={[
                styles.slot,
                slot,
                {
                  height: geo.cardH,
                  left: colX(geo, 0),
                  top: 0,
                  width: geo.cardW,
                },
              ]}
            >
              {game.waste.length > 0 ? (
                <Ionicons
                  color={theme.mutedText}
                  name="refresh"
                  size={geo.cardW * 0.5}
                />
              ) : null}
            </RNView>
            {[0, 1, 2, 3].map((f) => (
              <RNView
                key={`f${f}`}
                style={[
                  styles.slot,
                  slot,
                  {
                    height: geo.cardH,
                    left: colX(geo, 3 + f),
                    top: 0,
                    width: geo.cardW,
                  },
                ]}
              >
                <RNText
                  allowFontScaling={false}
                  style={[
                    styles.slotText,
                    { color: theme.border, fontSize: geo.cardW * 0.4 },
                  ]}
                >
                  A
                </RNText>
              </RNView>
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((c) => (
              <RNView
                key={`t${c}`}
                style={[
                  styles.slot,
                  slot,
                  {
                    height: geo.cardH,
                    left: colX(geo, c),
                    top: geo.tableauTop,
                    width: geo.cardW,
                  },
                ]}
              />
            ))}

            {/* Cards — keyed by card id so moves animate; dealKey remounts on a new deal */}
            <RNView key={dealKey} style={StyleSheet.absoluteFill}>
              {layout.placed.map((p, order) => (
                <CardView
                  backColor={theme.tint}
                  backInk={theme.onTint}
                  card={p.card}
                  dealDelay={order * DEAL_STAGGER_MS}
                  dragging={dragIds.includes(p.id)}
                  dragX={dragX}
                  dragY={dragY}
                  drop={drop?.ids.includes(p.id) ? drop : null}
                  faceColor={faceColor}
                  geo={geo}
                  key={p.id}
                  startX={colX(geo, 0)}
                  x={p.x}
                  y={p.y}
                  z={p.z}
                />
              ))}
            </RNView>
          </RNView>
        ) : null}
      </RNView>

      <RNView style={styles.bottomBar}>
        <Pressable
          accessibilityLabel={t("solUndo")}
          accessibilityRole="button"
          disabled={!(interactive && game?.history.length)}
          onPress={() => {
            if (game?.history.length) {
              haptic.tap();
              setDrop(null);
              setGame(undo(game));
            }
          }}
          style={[
            styles.actionBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: interactive && game?.history.length ? 1 : 0.4,
            },
          ]}
        >
          <Ionicons color={theme.text} name="arrow-undo" size={18} />
          <Text style={[styles.actionText, { color: theme.text }]}>
            {t("solUndo")}
          </Text>
        </Pressable>
        {showAuto ? (
          <Pressable
            accessibilityLabel={t("solAutoComplete")}
            accessibilityRole="button"
            disabled={!interactive}
            onPress={() => {
              haptic.tap();
              setAutoRunning(true);
            }}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.tint, borderColor: theme.tint },
            ]}
          >
            <Ionicons color={theme.onTint} name="flash" size={18} />
            <Text style={[styles.actionText, { color: theme.onTint }]}>
              {t("solAutoComplete")}
            </Text>
          </Pressable>
        ) : null}
      </RNView>

      <GamePauseOverlay
        onQuit={() => {
          resign();
          if (router.canGoBack()) {
            router.back();
          }
        }}
        onRestart={() => {
          resign();
          startGame(drawCount);
        }}
        onResume={resume}
        visible={paused}
      />

      {phase === "won" && result ? (
        <GameResult
          best={result.best}
          isNewBest={result.isNewBest}
          last={result.last === final.score ? undefined : result.last}
          onPlayAgain={() => setPhase("menu")}
          score={final.score}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          subtitle={t("solResultSubtitle", {
            moves: final.moves,
            time: formatTime(final.seconds),
          })}
          title={t("solYouWin")}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  actionText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  backInner: {
    alignItems: "center",
    borderRadius: 3,
    borderWidth: 1,
    bottom: 3,
    justifyContent: "center",
    left: 3,
    opacity: 0.75,
    position: "absolute",
    right: 3,
    top: 3,
  },
  board: {
    alignSelf: "stretch",
    flex: 1,
  },
  bottomBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    minHeight: 40,
  },
  card: {
    borderRadius: 5,
    borderWidth: 1,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
  },
  container: {
    flex: 1,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  corner: {
    alignItems: "center",
    flexDirection: "row",
    left: 3,
    position: "absolute",
    top: 1,
  },
  menu: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  menuHint: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  menuTitle: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.black,
  },
  modeBtn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.button,
    borderWidth: 1,
    gap: 2,
    paddingVertical: Spacing.md,
  },
  modeDesc: {
    fontSize: FontSize.sm,
  },
  modeTitle: {
    ...TextStyle.buttonSecondary,
  },
  rank: {
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
  },
  slot: {
    alignItems: "center",
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: "center",
    position: "absolute",
  },
  slotText: {
    fontWeight: FontWeight.black,
  },
  statBox: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statLabel: {
    ...TextStyle.statLabel,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
  },
  suitBig: {
    bottom: 2,
    position: "absolute",
    right: 3,
  },
  suitSmall: {
    marginLeft: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
