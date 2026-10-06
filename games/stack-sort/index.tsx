import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

// Stable fallback: returning a fresh `{}` from a Zustand selector makes
// getSnapshot produce a new reference every call, which loops React's
// useSyncExternalStore until it throws on first open (no progress entry yet).
const EMPTY_LEVEL_STARS: Record<string, number> = {};

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_STACK = 5; // max items per column
const MIN_COL_W = 46; // min width so numbers are always readable

/** Level definitions: [numCount, columnCount, emptyColumns] */
const LEVELS: [number, number, number][] = [
  /* 1  */ [6, 4, 1],
  /* 2  */ [8, 5, 1],
  /* 3  */ [10, 5, 1],
  /* 4  */ [10, 6, 2],
  /* 5  */ [12, 6, 1],
  /* 6  */ [14, 6, 1],
  /* 7  */ [14, 7, 2],
  /* 8  */ [16, 7, 1],
  /* 9  */ [16, 7, 2],
  /* 10 */ [18, 7, 1],
  /* 11 */ [20, 8, 2],
  /* 12 */ [20, 8, 1],
  /* 13 */ [24, 9, 2],
  /* 14 */ [24, 9, 1],
  /* 15 */ [28, 10, 2],
  /* 16 */ [28, 10, 1],
  /* 17 */ [30, 10, 1],
  /* 18 */ [32, 10, 1],
  /* 19 */ [32, 11, 2],
  /* 20 */ [36, 11, 1],
];

const STAR_THRESHOLDS = [1.8, 3.0]; // multiplier of numCount → 3★, 2★ (harder with chaos)

/* ================================================================
   TILE COLORS (mod 12 palette)
   ================================================================ */

const TILE_COLORS = [
  "#ef5350",
  "#42a5f5",
  "#66bb6a",
  "#ffa726",
  "#ab47bc",
  "#26c6da",
  "#ec407a",
  "#8d6e63",
  "#78909c",
  "#d4e157",
  "#7e57c2",
  "#29b6f6",
];

function tileColor(n: number): string {
  return TILE_COLORS[(n - 1) % TILE_COLORS.length];
}

/* ================================================================
   CHAOTIC LEVEL GENERATOR
   ================================================================ */

/**
 * Pure random shuffle — numbers are dealt into columns without any
 * ordering constraint. Columns may contain e.g. [5, 1, 8, 3].
 * Player must sort within columns AND into the goal.
 */
function generateLevel(
  numCount: number,
  columnCount: number,
  emptyColumns: number
): number[][] {
  const usable = columnCount - emptyColumns;
  const cols: number[][] = Array.from({ length: columnCount }, () => []);

  // Build shuffled deck
  const deck: number[] = [];
  for (let i = 1; i <= numCount; i += 1) {
    deck.push(i);
  }
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Deal round-robin into usable columns, respecting MAX_STACK
  let ci = 0;
  for (const num of deck) {
    let tries = 0;
    while (cols[ci % usable].length >= MAX_STACK) {
      ci += 1;
      tries += 1;
      if (tries > usable) {
        break;
      }
    }
    cols[ci % usable].push(num);
    ci += 1;
  }

  // Shuffle column order so empty ones aren't always at the end
  for (let i = cols.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }

  return cols;
}

/* ================================================================
   DEADLOCK DETECTION
   ================================================================ */

function isDeadlocked(columns: number[][], goal: number[]): boolean {
  const nextGoal = goal.length + 1;
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    if (col.length === 0) {
      return false;
    }
    const top = col.at(-1);
    if (top === undefined || top === nextGoal) {
      return false;
    }
    for (let j = 0; j < columns.length; j += 1) {
      if (i === j) {
        continue;
      }
      if (columns[j].length >= MAX_STACK) {
        continue;
      }
      if (columns[j].length === 0) {
        return false;
      }
      if (columns[j][columns[j].length - 1] > top) {
        return false;
      }
    }
  }
  return true;
}

/* ================================================================
   ANIMATED TILE — always visible, min width enforced
   ================================================================ */

function Tile({
  value,
  selected,
  isGoal,
  width,
}: {
  value: number;
  selected?: boolean;
  isGoal?: boolean;
  width: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const bg = isGoal ? "rgba(255,215,0,0.18)" : `${tileColor(value)}22`;
  const border = isGoal ? "#ffd700" : tileColor(value);
  const textColor = isGoal ? "#ffd700" : tileColor(value);

  useEffect(() => {
    if (selected) {
      Animated.timing(scale, {
        duration: 120,
        easing: Easing.out(Easing.back(2)),
        toValue: 1.15,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scale, {
        duration: 100,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [selected, scale]);

  return (
    <Animated.View
      style={{
        alignItems: "center",
        backgroundColor: bg,
        borderColor: selected ? "#fff" : border,
        borderRadius: 7,
        borderWidth: selected ? 2 : 1.5,
        height: 30,
        justifyContent: "center",
        marginVertical: 1,
        transform: [{ scale }],
        width: width - 6,
      }}
    >
      <Text style={{ color: textColor, fontSize: 14, fontWeight: "800" }}>
        {value}
      </Text>
    </Animated.View>
  );
}

/* ================================================================
   COLUMN COMPONENT — shows ALL tiles (no hidden items)
   ================================================================ */

function ColumnView({
  items,
  index,
  isSelected,
  isGoal,
  onPress,
  colWidth,
  label,
  goalBadgeLabel,
}: {
  items: number[];
  index: number;
  isSelected: boolean;
  isGoal: boolean;
  onPress: (i: number) => void;
  colWidth: number;
  label?: string;
  goalBadgeLabel: string;
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  const bgColor = isGoal
    ? "rgba(255,215,0,0.06)"
    : isSelected
      ? theme.accentSoft
      : "transparent";
  const borderColor = isGoal
    ? "#ffd70060"
    : isSelected
      ? theme.tint
      : `${theme.border}50`;

  return (
    <Pressable onPress={() => onPress(index)}>
      <RNView
        style={{
          alignItems: "center",
          backgroundColor: bgColor,
          borderColor,
          borderRadius: 10,
          borderWidth: 1.5,
          justifyContent: "flex-end",
          minHeight: 50,
          padding: 3,
          width: colWidth,
        }}
      >
        {/* Badge */}
        {isGoal && (
          <RNView style={st.goalBadge}>
            <Text style={st.goalBadgeText}>{goalBadgeLabel}</Text>
          </RNView>
        )}
        {label && !isGoal && (
          <Text
            style={{
              color: `${theme.mutedText}80`,
              fontSize: 7,
              fontWeight: "700",
              position: "absolute",
              top: 2,
            }}
          >
            {label}
          </Text>
        )}
        {/* All tiles — always visible */}
        {items.length === 0 && (
          <RNView
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              borderRadius: 7,
              borderStyle: "dashed",
              borderWidth: 1,
              height: 30,
              width: colWidth - 8,
            }}
          />
        )}
        {items.map((val, i) => (
          <Tile
            isGoal={isGoal}
            key={`${index}-${i}-${val}`}
            selected={isSelected && i === items.length - 1}
            value={val}
            width={colWidth}
          />
        ))}
      </RNView>
    </Pressable>
  );
}

/* ================================================================
   STAR DISPLAY
   ================================================================ */

function Stars({ count, size = 26 }: { count: number; size?: number }) {
  return (
    <RNView style={{ flexDirection: "row", gap: 4, marginVertical: 4 }}>
      {[1, 2, 3].map((i) => (
        <Text key={i} style={{ fontSize: size, opacity: i <= count ? 1 : 0.2 }}>
          ⭐
        </Text>
      ))}
    </RNView>
  );
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function StackSortGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const updateProgress = useGameStore((s) => s.updateProgress);
  const levelStars =
    useGameStore((s) => s.progress["stack-sort"]?.levelStars) ??
    EMPTY_LEVEL_STARS;
  const { width: screenW } = useWindowDimensions();

  const [phase, setPhase] = useState<"menu" | "playing" | "won">("menu");
  const [level, setLevel] = useState(0);
  const [columns, setColumns] = useState<number[][]>([]);
  const [goal, setGoal] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<
    { columns: number[][]; goal: number[] }[]
  >([]);
  const [numCount, setNumCount] = useState(0);

  /* --- derived layout --- */
  const maxPerRow = Math.max(3, Math.floor((screenW - 24) / (MIN_COL_W + 8)));
  const colWidth = Math.max(
    MIN_COL_W,
    Math.floor((screenW - 24 - maxPerRow * 8) / maxPerRow)
  );

  /* --- start level --- */
  const startLevel = (lvl: number) => {
    const [nc, cc, ec] = LEVELS[Math.min(lvl, LEVELS.length - 1)];
    const cols = generateLevel(nc, cc, ec);
    setNumCount(nc);
    setColumns(cols);
    setGoal([]);
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setLevel(lvl);
    setPhase("playing");
  };

  /* --- tap handler --- */
  const handleColumnPress = (colIdx: number) => {
    if (phase !== "playing") {
      return;
    }
    const isGoalTap = colIdx === -1;

    if (selected === null) {
      if (isGoalTap) {
        return;
      }
      if (columns[colIdx].length === 0) {
        return;
      }
      setSelected(colIdx);
      return;
    }

    const srcCol = columns[selected];
    const top = srcCol.at(-1);
    if (top === undefined) {
      setSelected(null);
      return;
    }
    const snapshot = {
      columns: columns.map((c) => [...c]),
      goal: [...goal],
    };

    if (isGoalTap) {
      const nextGoal = goal.length + 1;
      if (top !== nextGoal) {
        setSelected(null);
        return;
      }
      const newCols = columns.map((c) => [...c]);
      newCols[selected] = newCols[selected].slice(0, -1);
      const newGoal = [...goal, top];
      setColumns(newCols);
      setGoal(newGoal);
      setMoves((m) => m + 1);
      setHistory((h) => [...h, snapshot]);
      setSelected(null);

      if (newGoal.length === numCount) {
        haptic.heavy();
        setPhase("won");
        const stars = getStars(moves + 1, numCount);
        updateProgress("stack-sort", stars, {
          levelStarsPatch: { [String(level + 1)]: stars },
        });
      }
      return;
    }

    if (colIdx === selected) {
      setSelected(null);
      return;
    }

    const destCol = columns[colIdx];
    if (destCol.length >= MAX_STACK) {
      setSelected(null);
      return;
    }
    const destTop = destCol.at(-1);
    if (destTop !== undefined && destTop <= top) {
      setSelected(null);
      return;
    }

    const newCols = columns.map((c) => [...c]);
    newCols[selected] = newCols[selected].slice(0, -1);
    newCols[colIdx] = [...newCols[colIdx], top];
    setColumns(newCols);
    haptic.tap();
    setMoves((m) => m + 1);
    setHistory((h) => [...h, snapshot]);
    setSelected(null);
  };

  /* --- undo --- */
  const undo = () => {
    if (history.length === 0) {
      return;
    }
    const prev = history.at(-1);
    if (!prev) {
      return;
    }
    setColumns(prev.columns);
    setGoal(prev.goal);
    setHistory((h) => h.slice(0, -1));
    // Undo reverts the last move, so it should cancel that move from the
    // count — not add another (which inflated the star penalty).
    setMoves((m) => Math.max(0, m - 1));
    setSelected(null);
  };

  /* --- stars --- */
  function getStars(m: number, nc: number): number {
    if (m <= nc * STAR_THRESHOLDS[0]) {
      return 3;
    }
    if (m <= nc * STAR_THRESHOLDS[1]) {
      return 2;
    }
    return 1;
  }

  const dead =
    phase === "playing" && isDeadlocked(columns, goal) && history.length === 0;

  /* ================================================================
	   RENDER — MENU
	   ================================================================ */

  if (phase === "menu") {
    return (
      <View style={s.root}>
        <Text style={s.title}>{t("stackSortTitle")}</Text>
        <Text style={[s.desc, { color: theme.mutedText }]}>
          {t("stackSortIntro")}
        </Text>

        <RNView style={s.rulesBox}>
          <Text style={[s.ruleText, { color: theme.text }]}>
            {t("stackSortRuleTop")}
          </Text>
          <Text style={[s.ruleText, { color: theme.text }]}>
            {t("stackSortRulePlace")}
          </Text>
          <Text style={[s.ruleText, { color: theme.text }]}>
            {t("stackSortRuleGoalLock")}
          </Text>
          <Text style={[s.ruleText, { color: theme.text }]}>
            {t("stackSortRuleChaos")}
          </Text>
          <Text style={[s.ruleText, { color: theme.text }]}>
            {t("stackSortRuleUndo")}
          </Text>
        </RNView>

        <Text style={[s.levelLabel, { color: theme.mutedText }]}>
          {t("stackSortSelectLevel")}
        </Text>
        <ScrollView
          contentContainerStyle={s.levelGrid}
          style={{ maxHeight: 240 }}
        >
          {LEVELS.map((_, i) => (
            <Pressable
              accessibilityLabel={`Level ${i + 1}`}
              accessibilityRole="button"
              key={`level-${i + 1}-${LEVELS[i][0]}-${LEVELS[i][1]}-${LEVELS[i][2]}`}
              onPress={() => startLevel(i)}
              style={[
                s.levelBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[s.levelBtnText, { color: theme.text }]}>
                {i + 1}
              </Text>
              <Stars count={levelStars[String(i + 1)] ?? 0} size={10} />
              <Text style={{ color: theme.mutedText, fontSize: 8 }}>
                {LEVELS[i][0]}n
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  /* ================================================================
	   RENDER — WON
	   ================================================================ */

  if (phase === "won") {
    const stars = getStars(moves, numCount);
    return (
      <View style={s.root}>
        <Text style={s.title}>
          {t("stackSortLevelComplete", { level: level + 1 })}
        </Text>
        <Stars count={stars} />
        <Text style={[s.movesText, { color: theme.mutedText }]}>
          {t("stackSortMovesCount", { count: moves })}
        </Text>
        <RNView style={s.btnRow}>
          {level < LEVELS.length - 1 && (
            <Pressable
              accessibilityLabel={t("stackSortNextLevel")}
              accessibilityRole="button"
              onPress={() => startLevel(level + 1)}
              style={[s.mainBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={[s.mainBtnText, { color: theme.onTint }]}>
                {t("stackSortNextLevel")}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={t("stackSortRetry")}
            accessibilityRole="button"
            onPress={() => startLevel(level)}
            style={[
              s.mainBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[s.mainBtnText, { color: theme.text }]}>
              {t("stackSortRetry")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t("stackSortMenu")}
            accessibilityRole="button"
            onPress={() => setPhase("menu")}
            style={[
              s.mainBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[s.mainBtnText, { color: theme.text }]}>
              {t("stackSortMenu")}
            </Text>
          </Pressable>
        </RNView>
      </View>
    );
  }

  /* ================================================================
	   RENDER — PLAYING  (scattered grid layout)
	   ================================================================ */

  const allCols: {
    items: number[];
    idx: number;
    isGoal: boolean;
    label: string;
  }[] = [];
  columns.forEach((col, i) => {
    allCols.push({ idx: i, isGoal: false, items: col, label: `#${i + 1}` });
  });
  allCols.push({ idx: -1, isGoal: true, items: goal, label: "GOAL" });

  return (
    <View style={s.root}>
      {/* HUD */}
      <RNView style={s.hud}>
        <Text style={[s.hudText, { color: theme.mutedText }]}>
          {t("stackSortHudLevel", { level: level + 1 })}
        </Text>
        <Text style={[s.hudText, { color: theme.text }]}>
          {t("stackSortHudMoves", { moves })}
        </Text>
        <Text style={[s.hudText, { color: "#ffd700" }]}>
          {goal.length}/{numCount}
        </Text>
        <Pressable
          accessibilityLabel={t("stackSortUndo")}
          accessibilityRole="button"
          disabled={history.length === 0}
          onPress={undo}
          style={[s.undoBtn, { borderColor: theme.border }]}
        >
          <Text
            style={{
              color: history.length > 0 ? theme.tint : `${theme.mutedText}40`,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {t("stackSortUndo")}
          </Text>
        </Pressable>
      </RNView>

      {/* Deadlock warning */}
      {dead && (
        <RNView style={s.deadBanner}>
          <Text style={[s.deadText, { color: theme.danger }]}>
            {t("stackSortDeadlock")}
          </Text>
        </RNView>
      )}

      {/* Scattered grid board */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 16 }}
        style={{ flex: 1, width: "100%" }}
      >
        <RNView style={s.grid}>
          {allCols.map((c) => (
            <ColumnView
              colWidth={colWidth}
              goalBadgeLabel={t("stackSortGoal")}
              index={c.idx}
              isGoal={c.isGoal}
              isSelected={selected === c.idx && !c.isGoal}
              items={c.items}
              key={c.isGoal ? "goal" : c.idx}
              label={c.label}
              onPress={handleColumnPress}
            />
          ))}
        </RNView>
      </ScrollView>

      {/* Goal progress bar */}
      <RNView style={s.progressWrap}>
        <RNView
          style={[
            s.progressBar,
            { width: `${(goal.length / numCount) * 100}%` as never },
          ]}
        />
        <Text style={s.progressText}>
          {goal.length} / {numCount}
        </Text>
      </RNView>

      {/* Bottom bar */}
      <RNView style={s.bottomBar}>
        <Pressable
          accessibilityLabel={t("stackSortRestart")}
          accessibilityRole="button"
          onPress={() => startLevel(level)}
          style={[s.smallBtn, { borderColor: theme.border }]}
        >
          <Text style={[s.smallBtnText, { color: theme.text }]}>
            {t("stackSortRestart")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("stackSortMenu")}
          accessibilityRole="button"
          onPress={() => setPhase("menu")}
          style={[s.smallBtn, { borderColor: theme.border }]}
        >
          <Text style={[s.smallBtnText, { color: theme.text }]}>
            {t("stackSortMenu")}
          </Text>
        </Pressable>
      </RNView>
    </View>
  );
}

/* ================================================================
   STYLES — shared
   ================================================================ */

const st = StyleSheet.create({
  goalBadge: {
    backgroundColor: "#ffd700",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    position: "absolute",
    top: -10,
    zIndex: 2,
  },
  goalBadgeText: {
    color: "#1a1200",
    fontSize: 8,
    fontWeight: "900",
  },
});

/* ================================================================
   STYLES — layout
   ================================================================ */

const s = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
    marginTop: 6,
  },
  btnRow: { alignItems: "center", gap: 8, marginTop: 8 },

  deadBanner: {
    backgroundColor: "rgba(239,83,80,0.15)",
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deadText: { fontSize: 12, fontWeight: "700" },
  desc: { fontSize: 13, lineHeight: 20, marginBottom: 10, textAlign: "center" },

  /* Scattered wrapped grid — columns flow across the screen in rows */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingTop: 14,
  },

  hud: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 4,
    width: "100%",
  },
  hudText: { fontSize: 13, fontWeight: "700" },
  levelBtn: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  levelBtnText: { fontSize: 18, fontWeight: "800" },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingBottom: 16,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },

  mainBtn: {
    borderRadius: 12,
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  mainBtnText: { fontSize: 15, fontWeight: "800" },
  movesText: { fontSize: 14, marginBottom: 8 },
  progressBar: {
    backgroundColor: "rgba(255,215,0,0.25)",
    borderRadius: 9,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  progressText: {
    color: "#ffd700",
    fontSize: 10,
    fontWeight: "800",
  },

  progressWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: 9,
    height: 18,
    justifyContent: "center",
    marginBottom: 4,
    marginTop: 8,
    overflow: "hidden",
    width: "85%",
  },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 12,
  },
  rulesBox: { gap: 4, marginBottom: 14 },
  ruleText: { fontSize: 12, lineHeight: 18 },
  smallBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  smallBtnText: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "900", marginBottom: 6 },
  undoBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
