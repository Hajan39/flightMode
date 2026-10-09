import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import { LEVELS } from "./levels";

// Stable fallback: returning a fresh `{}` from a Zustand selector makes
// getSnapshot produce a new reference every call, which loops React's
// useSyncExternalStore until it throws on first open (no progress entry yet).
const EMPTY_LEVEL_STARS: Record<string, number> = {};

import { useGameDimensions } from "@/hooks/useGameDimensions";
import {
  cellIndex,
  findConflicts,
  getHintCell,
  isSolvedGrid,
  parseRows,
  type SunMoonCell,
} from "./logic";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_CELL = 52;
const CELL_GAP = 4;
const GRID_PADDING = 20;

/** Mistake thresholds → stars: 0 = 3★, ≤3 = 2★, else 1★. */
function getStars(mistakes: number): number {
  if (mistakes === 0) {
    return 3;
  }
  if (mistakes <= 3) {
    return 2;
  }
  return 1;
}

const SYMBOLS: Record<SunMoonCell, string> = {
  ".": "",
  M: "🌙",
  S: "☀️",
};

const NEXT_CELL: Record<SunMoonCell, SunMoonCell> = {
  ".": "S",
  M: ".",
  S: "M",
};

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

type Phase = "menu" | "playing" | "won";

export default function SunMoonGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const updateProgress = useGameStore((state) => state.updateProgress);
  const levelStars =
    useGameStore((state) => state.progress["sun-moon"]?.levelStars) ??
    EMPTY_LEVEL_STARS;
  const { width: screenW } = useGameDimensions();

  const [phase, setPhase] = useState<Phase>("menu");
  const [levelIdx, setLevelIdx] = useState(0);
  const [cells, setCells] = useState<SunMoonCell[]>([]);
  const [givenMask, setGivenMask] = useState<boolean[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wonStars, setWonStars] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintIdx, setHintIdx] = useState<number | null>(null);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hintTimeout.current) {
        clearTimeout(hintTimeout.current);
      }
    },
    []
  );

  const level = LEVELS[levelIdx];
  const { size } = level;

  const conflicts = useMemo(() => findConflicts(cells, size), [cells, size]);

  /* --- derived layout: 8×8 must fit phone width --- */
  const maxBoardWidth = Math.min(screenW - GRID_PADDING * 2, 400);
  const cellSize = Math.min(
    MAX_CELL,
    Math.floor((maxBoardWidth - CELL_GAP * (size - 1)) / size)
  );

  /* --- start level --- */
  const startLevel = (idx: number) => {
    const start = parseRows(LEVELS[idx].givens);
    if (hintTimeout.current) {
      clearTimeout(hintTimeout.current);
    }
    setLevelIdx(idx);
    setCells(start);
    setGivenMask(start.map((cell) => cell !== "."));
    setMistakes(0);
    setWonStars(0);
    setHintsUsed(0);
    setHintIdx(null);
    setPhase("playing");
  };

  /* --- shared win flow (tap + hint paths) --- */
  const finishIfSolved = (
    nextCells: SunMoonCell[],
    usedHint: boolean
  ): boolean => {
    if (!isSolvedGrid(nextCells, size)) {
      return false;
    }
    // A solved grid has zero conflicts by definition, so the winning
    // placement can never have been a mistake — `mistakes` is final here.
    const withHints = usedHint || hintsUsed > 0;
    const stars = withHints
      ? Math.min(getStars(mistakes), 2)
      : getStars(mistakes);
    setWonStars(stars);
    haptic.success();
    updateProgress("sun-moon", stars, {
      levelStarsPatch: { [String(level.id)]: stars },
      won: true,
    });
    setPhase("won");
    return true;
  };

  /* --- hint: fill the first wrong/blank cell with the correct symbol --- */
  const handleHint = () => {
    if (phase !== "playing") {
      return;
    }
    const hint = getHintCell(cells, level);
    if (!hint) {
      return;
    }

    const nextCells = [...cells];
    nextCells[hint.index] = hint.value;
    setCells(nextCells);
    setHintsUsed((h) => h + 1);
    haptic.tap();

    setHintIdx(hint.index);
    if (hintTimeout.current) {
      clearTimeout(hintTimeout.current);
    }
    hintTimeout.current = setTimeout(() => setHintIdx(null), 900);

    finishIfSolved(nextCells, true);
  };

  /* --- tap handler: cycle blank → ☀️ → 🌙 → blank --- */
  const handleCellPress = (idx: number) => {
    if (phase !== "playing") {
      return;
    }
    if (givenMask[idx]) {
      return;
    }

    const nextValue = NEXT_CELL[cells[idx]];
    const nextCells = [...cells];
    nextCells[idx] = nextValue;
    const nextConflicts = findConflicts(nextCells, size);

    // A placement (not a clear) that yields any NEW conflict counts once.
    if (nextValue === ".") {
      haptic.tap();
    } else {
      let createdConflict = false;
      for (const c of nextConflicts) {
        if (!conflicts.has(c)) {
          createdConflict = true;
          break;
        }
      }
      if (createdConflict) {
        setMistakes((m) => m + 1);
        haptic.error();
      } else {
        haptic.tap();
      }
    }

    setCells(nextCells);
    finishIfSolved(nextCells, false);
  };

  /* ================================================================
	   RENDER — MENU (level select)
	   ================================================================ */

  if (phase === "menu") {
    return (
      <View style={s.root}>
        <Text style={s.title}>{t("gameSunMoonName")}</Text>
        <Text style={[s.desc, { color: theme.mutedText }]}>
          {t("gameSunMoonDescription")}
        </Text>
        <Text style={[s.hint, { color: theme.mutedText }]}>
          {t("gameTapToStart")}
        </Text>

        <Text style={[s.sectionLabel, { color: theme.mutedText }]}>
          {t("selectLevel")}
        </Text>
        <ScrollView
          contentContainerStyle={s.levelGrid}
          style={{ maxHeight: 300 }}
        >
          {LEVELS.map((lvl, i) => (
            <Pressable
              accessibilityLabel={t("levelLabel", { level: lvl.id })}
              accessibilityRole="button"
              key={lvl.id}
              onPress={() => startLevel(i)}
              style={[
                s.levelBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[s.levelBtnText, { color: theme.text }]}>
                {lvl.id}
              </Text>
              <Stars count={levelStars[String(lvl.id)] ?? 0} size={10} />
              <Text style={{ color: theme.mutedText, fontSize: 8 }}>
                {lvl.size}×{lvl.size}
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
    return (
      <View style={s.root}>
        <Text style={s.wonEmoji}>☀️🌙</Text>
        <Text style={s.title}>{t("sunMoonSolved")}</Text>
        <Text style={[s.desc, { color: theme.mutedText }]}>
          {t("levelLabel", { level: level.id })}
        </Text>
        <Stars count={wonStars} />
        <RNView style={s.btnCol}>
          {levelIdx < LEVELS.length - 1 && (
            <Pressable
              accessibilityLabel={t("nextLevel")}
              accessibilityRole="button"
              onPress={() => startLevel(levelIdx + 1)}
              style={[s.mainBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={[s.mainBtnText, { color: theme.onTint }]}>
                {t("nextLevel")}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={t("playAgain")}
            accessibilityRole="button"
            onPress={() => startLevel(levelIdx)}
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
              {t("playAgain")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t("selectLevel")}
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

  return (
    <View style={s.root}>
      {/* HUD */}
      <RNView style={s.hud}>
        <RNView style={[s.pill, { backgroundColor: theme.card }]}>
          <Text style={[s.pillText, { color: theme.text }]}>
            {t("levelLabel", { level: level.id })}
          </Text>
        </RNView>
        <RNView
          style={[
            s.pill,
            {
              backgroundColor:
                conflicts.size > 0 ? theme.dangerSurface : theme.card,
            },
          ]}
        >
          <Text
            style={[
              s.pillText,
              { color: conflicts.size > 0 ? theme.danger : theme.mutedText },
            ]}
          >
            {t("sunMoonConflicts", { count: conflicts.size })}
          </Text>
        </RNView>
        <Pressable
          accessibilityLabel={t("hint")}
          accessibilityRole="button"
          accessibilityState={{ disabled: phase !== "playing" }}
          disabled={phase !== "playing"}
          onPress={handleHint}
          style={[
            s.pill,
            {
              backgroundColor: theme.card,
              opacity: phase === "playing" ? 1 : 0.4,
            },
          ]}
        >
          <Text style={[s.pillText, { color: theme.tint }]}>
            💡 {t("hint")}
          </Text>
        </Pressable>
      </RNView>

      {/* Board */}
      <RNView style={s.boardWrapper}>
        <RNView style={{ gap: CELL_GAP }}>
          {Array.from({ length: size }, (_, row) => (
            <RNView
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are static per level
              key={row}
              style={{ flexDirection: "row", gap: CELL_GAP }}
            >
              {Array.from({ length: size }, (_unused, col) => {
                const idx = cellIndex(row, col, size);
                const value = cells[idx];
                const isGiven = givenMask[idx];
                const isConflict = conflicts.has(idx);
                const isHinted = hintIdx === idx;
                let symbolLabel = t("sunMoonEmpty");
                if (value === "S") {
                  symbolLabel = t("sunMoonSun");
                } else if (value === "M") {
                  symbolLabel = t("sunMoonMoon");
                }
                let cellBg: string = theme.elevated;
                let cellBorder = `${theme.tint}50`;
                if (isHinted) {
                  cellBg = `${theme.tint}40`;
                  cellBorder = theme.tint;
                } else if (isConflict) {
                  cellBg = theme.dangerSurface;
                  cellBorder = theme.dangerBorder;
                } else if (isGiven) {
                  cellBg = theme.surface;
                  cellBorder = theme.border;
                }
                return (
                  <Pressable
                    accessibilityLabel={`${t("a11yRowCol", { col: col + 1, row: row + 1 })}: ${symbolLabel}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isGiven }}
                    disabled={isGiven}
                    key={idx}
                    onPress={() => handleCellPress(idx)}
                    style={[
                      s.cell,
                      {
                        backgroundColor: cellBg,
                        borderColor: cellBorder,
                        height: cellSize,
                        width: cellSize,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: Math.floor(cellSize * 0.55) }}>
                      {SYMBOLS[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </RNView>
          ))}
        </RNView>
      </RNView>

      {/* Bottom bar */}
      <RNView style={s.bottomBar}>
        <Pressable
          accessibilityLabel={t("playAgain")}
          accessibilityRole="button"
          onPress={() => startLevel(levelIdx)}
          style={[s.smallBtn, { borderColor: theme.border }]}
        >
          <Text style={[s.smallBtnText, { color: theme.text }]}>
            {t("playAgain")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("selectLevel")}
          accessibilityRole="button"
          onPress={() => setPhase("menu")}
          style={[s.smallBtn, { borderColor: theme.border }]}
        >
          <Text style={[s.smallBtnText, { color: theme.text }]}>
            {t("selectLevel")}
          </Text>
        </Pressable>
      </RNView>
    </View>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const s = StyleSheet.create({
  boardWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  bottomBar: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  btnCol: { alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  cell: {
    alignItems: "center",
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  hint: { fontSize: 12, marginBottom: Spacing.lg },

  hud: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  levelBtn: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  levelBtnText: { fontSize: 18, fontWeight: "800" },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingBottom: Spacing.lg,
  },
  mainBtn: {
    alignItems: "center",
    borderRadius: Radius.card,
    minWidth: 180,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  mainBtnText: { fontSize: 15, fontWeight: "800" },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, fontWeight: "700" },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: GRID_PADDING,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  smallBtn: {
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  smallBtnText: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "900", marginBottom: 6 },

  wonEmoji: { fontSize: 44, marginBottom: Spacing.sm },
});
