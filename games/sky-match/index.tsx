import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";

import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { swipeDirection } from "@/hooks/useSwipe";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import {
  areAdjacent,
  type Board,
  colOf,
  createBoard,
  createIdGen,
  findHint,
  getLevel,
  type IdGen,
  LEVEL_COUNT,
  playSwap,
  rowOf,
  SIZE,
  type Special,
  type Step,
  shuffleBoard,
  starsFor,
  type Tile,
} from "./logic";

/* ================================================================
   LOOK
   ================================================================ */

type IconName = keyof typeof Ionicons.glyphMap;

/** One colour + icon per kind; distinct in hue and shape for colour-blind play. */
const KIND_STYLE: { color: string; icon: IconName }[] = [
  { color: "#3B82F6", icon: "airplane" },
  { color: "#14B8A6", icon: "cloud" },
  { color: "#F59E0B", icon: "sunny" },
  { color: "#EF4444", icon: "briefcase" },
  { color: "#22C55E", icon: "earth" },
  { color: "#A855F7", icon: "ticket" },
];

const SPECIAL_BADGE: Partial<Record<Special, IconName>> = {
  bomb: "flash",
  col: "swap-vertical",
  row: "swap-horizontal",
};

const SWAP_MS = 140;
const POP_MS = 170;
const FALL_MS = 230;
const HINT_AFTER_MS = 6000;

// Stable fallback for the Zustand selector (a fresh {} would loop useSyncExternalStore).
const EMPTY_LEVEL_STARS: Record<string, number> = {};

/* ================================================================
   TILE
   ================================================================ */

interface TileViewProps {
  cell: number;
  /** Rows above the board a new tile starts from (0 = already on the board). */
  dropFrom: number;
  hinted: boolean;
  popping: boolean;
  selected: boolean;
  size: number;
  tile: Tile;
}

function TileView({
  cell,
  dropFrom,
  hinted,
  popping,
  selected,
  size,
  tile,
}: TileViewProps) {
  const x = colOf(cell) * size;
  const y = rowOf(cell) * size;
  const pos = useRef(
    new Animated.ValueXY({ x, y: y - dropFrom * size })
  ).current;
  const scale = useRef(new Animated.Value(1)).current;
  const lastY = useRef(y - dropFrom * size);

  useEffect(() => {
    // Falls take longer the further they go; swaps are one quick step.
    const rows = Math.abs(y - lastY.current) / size;
    lastY.current = y;
    Animated.timing(pos, {
      duration: rows > 1 ? Math.min(FALL_MS + 60, 120 + rows * 30) : SWAP_MS,
      easing: Easing.out(Easing.quad),
      toValue: { x, y },
      useNativeDriver: true,
    }).start();
  }, [pos, x, y, size]);

  useEffect(() => {
    if (popping) {
      Animated.timing(scale, {
        duration: POP_MS,
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (hinted) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            duration: 380,
            toValue: 1.12,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            duration: 380,
            toValue: 1,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        scale.setValue(1);
      };
    }
    scale.setValue(1);
  }, [popping, hinted, scale]);

  const inner = size - 4;
  const isColor = tile.special === "color";
  const look = isColor ? null : KIND_STYLE[tile.kind];
  const badge = SPECIAL_BADGE[tile.special];

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          height: size,
          transform: [...pos.getTranslateTransform(), { scale }],
          width: size,
        },
      ]}
    >
      <RNView
        style={[
          styles.tileInner,
          {
            backgroundColor: isColor ? "#1F2937" : look?.color,
            borderColor: selected ? "#FFFFFF" : "rgba(255,255,255,0.18)",
            borderRadius: inner * 0.28,
            borderWidth: selected ? 3 : 1,
            height: inner,
            width: inner,
          },
        ]}
      >
        <Ionicons
          color={isColor ? "#FBBF24" : "#FFFFFF"}
          name={isColor ? "star" : (look?.icon ?? "ellipse")}
          size={inner * 0.52}
        />
        {badge ? (
          <RNView style={[styles.badge, { borderRadius: inner * 0.2 }]}>
            <Ionicons color="#FFFFFF" name={badge} size={inner * 0.3} />
          </RNView>
        ) : null}
      </RNView>
    </Animated.View>
  );
}

function Stars({ count, size }: { count: number; size: number }) {
  return (
    <RNView style={styles.starsRow}>
      {[1, 2, 3].map((i) => (
        <Text key={i} style={{ fontSize: size, opacity: i <= count ? 1 : 0.2 }}>
          ⭐
        </Text>
      ))}
    </RNView>
  );
}

/* ================================================================
   GAME
   ================================================================ */

type Phase = "menu" | "playing" | "done";

interface Placed {
  cell: number;
  dropFrom: number;
  tile: Tile;
}

/** Tiles to draw: where each one sits and how far above the board a new one starts. */
function placeTiles(board: Board, previous: Board | null): Placed[] {
  const known = new Set(previous?.map((t) => t?.id));
  const newPerColumn = new Array(SIZE).fill(0);
  if (previous) {
    for (const tile of board) {
      if (tile && !known.has(tile.id)) {
        newPerColumn[colOf(board.indexOf(tile))] += 1;
      }
    }
  }
  const placed: Placed[] = [];
  board.forEach((tile, cell) => {
    if (!tile) {
      return;
    }
    const fresh = previous !== null && !known.has(tile.id);
    placed.push({
      cell,
      dropFrom: fresh ? newPerColumn[colOf(cell)] : 0,
      tile,
    });
  });
  return placed;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export default function SkyMatchGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const updateProgress = useGameStore((state) => state.updateProgress);
  const levelStars =
    useGameStore((state) => state.progress["sky-match"]?.levelStars) ??
    EMPTY_LEVEL_STARS;

  const [phase, setPhase] = useState<Phase>("menu");
  const [levelId, setLevelId] = useState(1);
  const [board, setBoard] = useState<Board>([]);
  const [previous, setPrevious] = useState<Board | null>(null);
  const [popping, setPopping] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(0);
  const [comboText, setComboText] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [resultStars, setResultStars] = useState(0);

  const busy = useRef<boolean>(false);
  const idGen = useRef<IdGen>(createIdGen());
  const boardRef = useRef<RNView>(null);
  const origin = useRef({ x: 0, y: 0 });
  const touchStart = useRef<{ cell: number; x: number; y: number } | null>(
    null
  );
  // Bumped on restart/quit so a cascade still playing out stops touching state.
  const runToken = useRef(0);

  const level = getLevel(levelId);
  const boardSize = Math.floor(
    Math.min(width - Spacing.lg * 2, height - 280, 440)
  );
  const cellSize = boardSize / SIZE;

  /* --- hint after a quiet spell --- */
  useEffect(() => {
    if (phase !== "playing" || paused || busy.current) {
      return;
    }
    setHint(null);
    const timer = setTimeout(() => setHint(findHint(board)), HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [board, phase, paused]);

  const startLevel = (id: number) => {
    runToken.current += 1;
    busy.current = false;
    idGen.current = createIdGen();
    setLevelId(id);
    setBoard(createBoard(Math.random, idGen.current));
    setPrevious(null);
    setPopping(new Set());
    setSelected(null);
    setHint(null);
    setScore(0);
    setMovesLeft(getLevel(id).moves);
    setComboText(null);
    setPaused(false);
    setPhase("playing");
  };

  const finishLevel = (finalScore: number) => {
    const stars = starsFor(level, finalScore);
    setResultStars(stars);
    if (stars > 0) {
      haptic.success();
    } else {
      haptic.error();
    }
    updateProgress("sky-match", finalScore, {
      levelStarsPatch: stars > 0 ? { [String(level.id)]: stars } : {},
      won: stars > 0,
    });
    setPhase("done");
  };

  /** Plays the cascade frames: pop → (new specials) → fall, chain by chain. */
  const animateSteps = async (
    start: Board,
    steps: Step[],
    token: number,
    scoreBefore: number,
    movesAfter: number
  ) => {
    // One chain at a time; recursion keeps the frames strictly sequential.
    const playStep = async (
      n: number,
      shown: Board,
      sum: number
    ): Promise<{ current: Board; total: number } | null> => {
      const step = steps[n];
      if (!step) {
        return { current: shown, total: sum };
      }
      setPopping(new Set(step.cleared.map((c) => shown[c]?.id ?? -1)));
      if (n > 0) {
        setComboText(t("smCombo", { count: n + 1 }));
      }
      haptic.tap();
      await wait(POP_MS);
      if (runToken.current !== token) {
        return null;
      }
      setPopping(new Set());
      setPrevious(shown);
      setBoard(step.afterClear);
      setScore(sum + step.points);
      await wait(60);
      if (runToken.current !== token) {
        return null;
      }
      setPrevious(step.afterClear);
      setBoard(step.afterFall);
      await wait(FALL_MS + 30);
      if (runToken.current !== token) {
        return null;
      }
      return playStep(n + 1, step.afterFall, sum + step.points);
    };
    const end = await playStep(0, start, scoreBefore);
    if (!end) {
      return;
    }
    const { current, total } = end;
    setComboText(null);
    if (!findHint(current)) {
      const shuffled = shuffleBoard(current, Math.random, idGen.current);
      setPrevious(null);
      setBoard(shuffled);
      setComboText(t("smShuffle"));
      await wait(700);
      if (runToken.current !== token) {
        return;
      }
      setComboText(null);
    }
    busy.current = false;
    if (movesAfter <= 0) {
      finishLevel(total);
    }
  };

  const trySwap = async (a: number, b: number) => {
    if (busy.current || phase !== "playing" || paused) {
      return;
    }
    setSelected(null);
    setHint(null);
    const steps = playSwap(board, a, b, Math.random, idGen.current);
    const token = runToken.current;
    busy.current = true;
    // Show the swap either way; an illegal one slides back.
    const swappedBoard = [...board];
    swappedBoard[a] = board[b];
    swappedBoard[b] = board[a];
    setPrevious(board);
    setBoard(swappedBoard);
    await wait(SWAP_MS + 20);
    if (runToken.current !== token) {
      return;
    }
    if (!steps) {
      haptic.error();
      setPrevious(swappedBoard);
      setBoard(board);
      await wait(SWAP_MS);
      busy.current = false;
      return;
    }
    const movesAfter = movesLeft - 1;
    setMovesLeft(movesAfter);
    await animateSteps(swappedBoard, steps, token, score, movesAfter);
  };

  /* --- input: swipe a tile, or tap two neighbours --- */
  const cellAt = (pageX: number, pageY: number): number | null => {
    const col = Math.floor((pageX - origin.current.x) / cellSize);
    const row = Math.floor((pageY - origin.current.y) / cellSize);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) {
      return null;
    }
    return row * SIZE + col;
  };

  const onGrant = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const cell = cellAt(pageX, pageY);
    touchStart.current = cell === null ? null : { cell, x: pageX, y: pageY };
  };

  const onRelease = (e: GestureResponderEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) {
      return;
    }
    const dir = swipeDirection(
      e.nativeEvent.pageX - start.x,
      e.nativeEvent.pageY - start.y
    );
    if (dir) {
      const row = rowOf(start.cell);
      const col = colOf(start.cell);
      const target = {
        down: row < SIZE - 1 ? start.cell + SIZE : null,
        left: col > 0 ? start.cell - 1 : null,
        right: col < SIZE - 1 ? start.cell + 1 : null,
        up: row > 0 ? start.cell - SIZE : null,
      }[dir];
      if (target !== null) {
        trySwap(start.cell, target);
      }
      return;
    }
    // Tap: select, or swap with the selected neighbour.
    if (selected !== null && areAdjacent(selected, start.cell)) {
      trySwap(selected, start.cell);
    } else {
      haptic.tap();
      setSelected(selected === start.cell ? null : start.cell);
    }
  };

  /* ================================================================
     RENDER — MENU
     ================================================================ */

  if (phase === "menu") {
    const unlockedUpTo = (() => {
      let id = 1;
      while (id < LEVEL_COUNT && (levelStars[String(id)] ?? 0) > 0) {
        id += 1;
      }
      return id;
    })();
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{t("gameSkyMatchName")}</Text>
        <Text style={[styles.desc, { color: theme.mutedText }]}>
          {t("smIntro")}
        </Text>
        <RNView style={styles.legend}>
          {KIND_STYLE.map((k) => (
            <RNView
              key={k.icon}
              style={[styles.legendTile, { backgroundColor: k.color }]}
            >
              <Ionicons color="#FFFFFF" name={k.icon} size={16} />
            </RNView>
          ))}
        </RNView>
        <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
          {t("selectLevel")}
        </Text>
        <ScrollView contentContainerStyle={styles.levelGrid}>
          {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((id) => {
            const locked = id > unlockedUpTo;
            return (
              <Pressable
                accessibilityLabel={t("levelLabel", { level: id })}
                accessibilityRole="button"
                accessibilityState={{ disabled: locked }}
                disabled={locked}
                key={id}
                onPress={() => startLevel(id)}
                style={[
                  styles.levelBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      id === unlockedUpTo ? theme.tint : theme.border,
                    opacity: locked ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={[styles.levelBtnText, { color: theme.text }]}>
                  {locked ? "🔒" : String(id)}
                </Text>
                <Stars count={levelStars[String(id)] ?? 0} size={9} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  /* ================================================================
     RENDER — LEVEL DONE
     ================================================================ */

  if (phase === "done") {
    const passed = resultStars > 0;
    return (
      <View style={styles.root}>
        <Text style={styles.doneEmoji}>{passed ? "🛬" : "🌧️"}</Text>
        <Text style={styles.title}>
          {passed ? t("smLevelPassed") : t("smLevelFailed")}
        </Text>
        <Text style={[styles.desc, { color: theme.mutedText }]}>
          {t("levelLabel", { level: level.id })} ·{" "}
          {t("smScoreOf", { score, target: level.target })}
        </Text>
        <Stars count={resultStars} size={30} />
        <RNView style={styles.btnCol}>
          {passed && level.id < LEVEL_COUNT ? (
            <Pressable
              accessibilityLabel={t("nextLevel")}
              accessibilityRole="button"
              onPress={() => startLevel(level.id + 1)}
              style={[styles.mainBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={[styles.mainBtnText, { color: theme.onTint }]}>
                {t("nextLevel")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={t("playAgain")}
            accessibilityRole="button"
            onPress={() => startLevel(level.id)}
            style={[
              styles.mainBtn,
              passed
                ? {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }
                : { backgroundColor: theme.tint },
            ]}
          >
            <Text
              style={[
                styles.mainBtnText,
                { color: passed ? theme.text : theme.onTint },
              ]}
            >
              {t("playAgain")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t("selectLevel")}
            accessibilityRole="button"
            onPress={() => setPhase("menu")}
            style={[
              styles.mainBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.mainBtnText, { color: theme.text }]}>
              {t("selectLevel")}
            </Text>
          </Pressable>
        </RNView>
      </View>
    );
  }

  /* ================================================================
     RENDER — PLAYING
     ================================================================ */

  const progress = Math.min(1, score / (level.target * 1.6));
  const placed = placeTiles(board, previous);
  const hintCells: number[] = hint ?? [];

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        <Text style={[styles.levelTag, { color: theme.mutedText }]}>
          {t("levelLabel", { level: level.id })}
        </Text>
        <GameControls
          isPaused={paused}
          onPause={() => setPaused(true)}
          onReset={() => startLevel(level.id)}
        />
      </RNView>

      <RNView style={styles.hud}>
        <RNView style={[styles.hudBox, { backgroundColor: theme.card }]}>
          <Text style={[styles.hudLabel, { color: theme.mutedText }]}>
            {t("smMoves")}
          </Text>
          <Text
            style={[
              styles.hudValue,
              { color: movesLeft <= 3 ? "#EF4444" : theme.text },
            ]}
          >
            {movesLeft}
          </Text>
        </RNView>
        <RNView
          style={[
            styles.hudBox,
            styles.hudWide,
            { backgroundColor: theme.card },
          ]}
        >
          <Text style={[styles.hudLabel, { color: theme.mutedText }]}>
            {t("smScoreOf", { score, target: level.target })}
          </Text>
          <RNView
            style={[styles.progressTrack, { backgroundColor: theme.surface }]}
          >
            <RNView
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.tint,
                  width: `${Math.round(progress * 100)}%`,
                },
              ]}
            />
            {[1, 1.3, 1.6].map((m) => (
              <RNView
                key={m}
                style={[
                  styles.progressMark,
                  {
                    backgroundColor:
                      score >= level.target * m ? "#FBBF24" : theme.border,
                    left: `${Math.round((m / 1.6) * 100) - 2}%`,
                  },
                ]}
              />
            ))}
          </RNView>
        </RNView>
      </RNView>

      <RNView style={styles.comboRow}>
        {comboText ? (
          <Text style={[styles.combo, { color: theme.tint }]}>{comboText}</Text>
        ) : null}
      </RNView>

      <RNView
        onLayout={() =>
          boardRef.current?.measureInWindow((x, y) => {
            origin.current = { x, y };
          })
        }
        onResponderGrant={onGrant}
        onResponderRelease={onRelease}
        onResponderTerminationRequest={() => false}
        onStartShouldSetResponder={() => true}
        ref={boardRef}
        style={[
          styles.board,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            height: boardSize,
            width: boardSize,
          },
        ]}
      >
        {placed.map(({ cell, dropFrom, tile }) => (
          <TileView
            cell={cell}
            dropFrom={dropFrom}
            hinted={hintCells.includes(cell)}
            key={tile.id}
            popping={popping.has(tile.id)}
            selected={selected === cell}
            size={cellSize}
            tile={tile}
          />
        ))}
      </RNView>

      <Text style={[styles.footHint, { color: theme.mutedText }]}>
        {t("smHowTo")}
      </Text>

      <GamePauseOverlay
        onQuit={() => {
          runToken.current += 1;
          setPhase("menu");
        }}
        onRestart={() => startLevel(level.id)}
        onResume={() => setPaused(false)}
        visible={paused}
      />
    </View>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    bottom: 2,
    justifyContent: "center",
    padding: 2,
    position: "absolute",
    right: 2,
  },
  board: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    overflow: "hidden",
  },
  btnCol: { alignSelf: "stretch", gap: Spacing.sm, marginTop: Spacing.lg },
  combo: { fontSize: 18, fontWeight: "900" },
  comboRow: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  doneEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  footHint: { fontSize: 12, marginTop: Spacing.md, textAlign: "center" },
  hud: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  hudBox: {
    alignItems: "center",
    borderRadius: Radius.md,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hudLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  hudValue: { fontSize: 22, fontWeight: "900" },
  hudWide: { alignItems: "stretch", flex: 1, gap: 8 },
  legend: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  legendTile: {
    alignItems: "center",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  levelBtn: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  levelBtnText: { fontSize: 17, fontWeight: "800" },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingBottom: Spacing.xl,
  },
  levelTag: { fontSize: 14, fontWeight: "700" },
  mainBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    paddingVertical: 14,
  },
  mainBtnText: { fontSize: 16, fontWeight: "800" },
  progressFill: { borderRadius: 4, height: "100%" },
  progressMark: {
    borderRadius: 4,
    height: 8,
    position: "absolute",
    top: 0,
    width: 8,
  },
  progressTrack: { borderRadius: 4, height: 8, overflow: "hidden" },
  root: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  starsRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 0,
  },
  tileInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "900", textAlign: "center" },
  topRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
