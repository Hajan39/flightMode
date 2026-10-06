import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

import { NONOGRAM_LEVELS, type NonogramLevel } from "./levels";

// Stable fallback: returning a fresh `{}` from a Zustand selector makes
// getSnapshot produce a new reference every call, which loops React's
// useSyncExternalStore until it throws on first open (no progress entry yet).
const EMPTY_LEVEL_STARS: Record<string, number> = {};

import {
  type CellState,
  countFilledCells,
  deriveClues,
  EMPTY,
  FILLED,
  findForcedCell,
  isLineSatisfied,
  UNKNOWN,
} from "./logic";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_CELL = 34; // biggest comfortable cell
const CLUE_DIGIT_W = 13; // width reserved per row-clue number
const CLUE_LINE_H = 13; // height reserved per column-clue number
const GROUP_GAP = 4; // extra gap after every 5th line

type Phase = "menu" | "playing" | "won";
type Mode = "fill" | "mark";

/* ================================================================
   HELPERS
   ================================================================ */

function makeEmptyGrid(size: number): CellState[][] {
  return Array.from({ length: size }, () =>
    new Array<CellState>(size).fill(UNKNOWN)
  );
}

function starsForMistakes(mistakes: number): number {
  if (mistakes === 0) {
    return 3;
  }
  if (mistakes <= 2) {
    return 2;
  }
  return 1;
}

/** Final stars: mistake tiers, capped at 2 when any hint was used. */
function starsForResult(mistakes: number, hintsUsed: number): number {
  const stars = starsForMistakes(mistakes);
  return hintsUsed > 0 ? Math.min(stars, 2) : stars;
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
   REVEALED PIXEL ART (win overlay)
   ================================================================ */

function PixelArt({
  solution,
  tint,
  surface,
}: {
  solution: string[];
  tint: string;
  surface: string;
}) {
  const size = solution.length;
  const cell = Math.max(10, Math.floor(180 / size));
  return (
    <RNView style={{ marginVertical: Spacing.md }}>
      {solution.map((row, r) => (
        <RNView
          key={`art-row-${r + 1}-${row}`}
          style={{ flexDirection: "row" }}
        >
          {[...row].map((ch, c) => (
            <RNView
              // biome-ignore lint/suspicious/noArrayIndexKey: static art grid
              key={`art-${r}-${c}`}
              style={{
                backgroundColor: ch === "#" ? tint : surface,
                borderRadius: 2,
                height: cell,
                margin: 0.5,
                width: cell,
              }}
            />
          ))}
        </RNView>
      ))}
    </RNView>
  );
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function NonogramGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenW } = useWindowDimensions();
  const updateProgress = useGameStore((state) => state.updateProgress);
  const levelStars =
    useGameStore((state) => state.progress.nonogram?.levelStars) ??
    EMPTY_LEVEL_STARS;

  const [phase, setPhase] = useState<Phase>("menu");
  const [level, setLevel] = useState<NonogramLevel>(NONOGRAM_LEVELS[0]);
  const [grid, setGrid] = useState<CellState[][]>(() => makeEmptyGrid(5));
  const [mode, setMode] = useState<Mode>("fill");
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintCell, setHintCell] = useState<{ r: number; c: number } | null>(
    null
  );
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clues = useMemo(() => deriveClues(level.solution), [level]);
  const totalFilled = useMemo(() => countFilledCells(level.solution), [level]);

  // Guard: disabled when line logic can't force any cell (shouldn't happen
  // mid-solve — every level is line-solvable — but bad user marks could).
  const hintAvailable = useMemo(
    () => phase === "playing" && findForcedCell(clues, grid) !== null,
    [phase, clues, grid]
  );

  useEffect(
    () => () => {
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
      }
    },
    []
  );

  /* --- start level --- */
  const startLevel = useCallback((lvl: NonogramLevel) => {
    setLevel(lvl);
    setGrid(makeEmptyGrid(lvl.size));
    setMode("fill");
    setMistakes(0);
    setHintsUsed(0);
    setHintCell(null);
    if (hintTimer.current) {
      clearTimeout(hintTimer.current);
    }
    setPhase("playing");
  }, []);

  /* --- shared win check (tap + hint paths both end here, exactly once) --- */
  const finishIfSolved = (next: CellState[][], hintsNow: number) => {
    const filledCount = next.flat().filter((cell) => cell === FILLED).length;
    if (filledCount !== totalFilled) {
      return;
    }
    haptic.heavy();
    setPhase("won");
    const stars = starsForResult(mistakes, hintsNow);
    updateProgress("nonogram", stars, {
      levelStarsPatch: { [String(level.id)]: stars },
      won: true,
    });
  };

  /* --- hint: apply one logically forced cell (never a mistake) --- */
  const handleHint = () => {
    if (phase !== "playing") {
      return;
    }
    const forced = findForcedCell(clues, grid);
    if (!forced) {
      return;
    }
    haptic.tap();
    const next = grid.map((row) => [...row]);
    next[forced.r][forced.c] = forced.state;
    setGrid(next);
    setHintsUsed((h) => h + 1);
    setHintCell({ c: forced.c, r: forced.r });
    if (hintTimer.current) {
      clearTimeout(hintTimer.current);
    }
    hintTimer.current = setTimeout(() => setHintCell(null), 900);
    finishIfSolved(next, hintsUsed + 1);
  };

  /* --- win check + tap handler --- */
  const handleCellPress = (r: number, c: number) => {
    if (phase !== "playing") {
      return;
    }
    const current = grid[r][c];

    if (mode === "mark") {
      if (current === FILLED) {
        return;
      }
      haptic.tap();
      const next = grid.map((row) => [...row]);
      next[r][c] = current === EMPTY ? UNKNOWN : EMPTY;
      setGrid(next);
      return;
    }

    // Fill mode — only unknown cells are actionable.
    if (current !== UNKNOWN) {
      return;
    }
    const next = grid.map((row) => [...row]);

    if (level.solution[r][c] !== "#") {
      // Picross mistake rule: wrong fill counts a mistake and auto-marks X.
      haptic.error();
      next[r][c] = EMPTY;
      setGrid(next);
      setMistakes((m) => m + 1);
      return;
    }

    haptic.tap();
    next[r][c] = FILLED;
    setGrid(next);
    finishIfSolved(next, hintsUsed);
  };

  /* ================================================================
	   RENDER — MENU
	   ================================================================ */

  if (phase === "menu") {
    return (
      <View style={s.root}>
        <Text style={s.title}>{t("gameNonogramName")}</Text>
        <Text style={[s.desc, { color: theme.mutedText }]}>
          {t("gameNonogramDescription")}
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
          {NONOGRAM_LEVELS.map((lvl) => (
            <Pressable
              accessibilityLabel={t("levelLabel", { level: lvl.id })}
              accessibilityRole="button"
              key={`level-${lvl.id}`}
              onPress={() => startLevel(lvl)}
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
    const stars = starsForResult(mistakes, hintsUsed);
    const nextLevel = NONOGRAM_LEVELS.find((l) => l.id === level.id + 1);
    return (
      <View style={s.root}>
        <Text style={s.title}>{t("nonoSolved")}</Text>
        <PixelArt
          solution={level.solution}
          surface={theme.surface}
          tint={theme.tint}
        />
        <Stars count={stars} />
        <Text style={[s.hint, { color: theme.mutedText }]}>
          {t("nonoMistakes", { count: mistakes })}
        </Text>
        <RNView style={s.btnCol}>
          {nextLevel && (
            <Pressable
              accessibilityLabel={t("nextLevel")}
              accessibilityRole="button"
              onPress={() => startLevel(nextLevel)}
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

  /* --- layout --- */
  const { size } = level;
  const maxRowClues = Math.max(1, ...clues.rows.map((r) => r.length));
  const maxColClues = Math.max(1, ...clues.cols.map((c) => c.length));
  const rowGutterW = maxRowClues * CLUE_DIGIT_W + Spacing.sm;
  const colGutterH = maxColClues * CLUE_LINE_H + Spacing.xs;
  const groupGaps = Math.floor((size - 1) / 5) * GROUP_GAP;
  const cellSize = Math.min(
    MAX_CELL,
    Math.floor(
      (screenW - Spacing.lg * 2 - rowGutterW - groupGaps - size * 2) / size
    )
  );

  const rowSatisfied = clues.rows.map((clue, r) =>
    isLineSatisfied(
      clue,
      grid[r].map((cell) => cell === FILLED)
    )
  );
  const colSatisfied = clues.cols.map((clue, c) =>
    isLineSatisfied(
      clue,
      grid.map((row) => row[c] === FILLED)
    )
  );

  /* ================================================================
	   RENDER — PLAYING
	   ================================================================ */

  const cellOuter = (index: number) => ({
    marginRight:
      (index + 1) % 5 === 0 && index !== size - 1 ? GROUP_GAP + 2 : 2,
  });
  const rowOuter = (index: number) => ({
    marginBottom:
      (index + 1) % 5 === 0 && index !== size - 1 ? GROUP_GAP + 2 : 2,
  });

  return (
    <View style={s.root}>
      {/* HUD */}
      <RNView style={s.hud}>
        <Text style={[s.hudText, { color: theme.mutedText }]}>
          {t("levelLabel", { level: level.id })}
        </Text>
        <Text
          style={[
            s.hudText,
            { color: mistakes > 0 ? theme.danger : theme.text },
          ]}
        >
          {t("nonoMistakes", { count: mistakes })}
        </Text>
      </RNView>

      {/* Board */}
      <RNView style={{ marginTop: Spacing.sm }}>
        {/* Column clues */}
        <RNView style={{ flexDirection: "row" }}>
          <RNView style={{ width: rowGutterW }} />
          {clues.cols.map((clue, c) => (
            <RNView
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
              key={`col-clue-${c}`}
              style={[
                {
                  alignItems: "center",
                  height: colGutterH,
                  justifyContent: "flex-end",
                  width: cellSize,
                },
                cellOuter(c),
              ]}
            >
              {(clue.length > 0 ? clue : [0]).map((n, i) => (
                <Text
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed clue list
                  key={`col-clue-${c}-${i}`}
                  style={[
                    s.clueText,
                    {
                      color: colSatisfied[c]
                        ? `${theme.mutedText}70`
                        : theme.text,
                    },
                  ]}
                >
                  {n}
                </Text>
              ))}
            </RNView>
          ))}
        </RNView>

        {/* Rows: clue gutter + cells */}
        {grid.map((row, r) => (
          <RNView
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
            key={`row-${r}`}
            style={[
              { alignItems: "center", flexDirection: "row" },
              rowOuter(r),
            ]}
          >
            <RNView
              style={{
                flexDirection: "row",
                gap: 3,
                justifyContent: "flex-end",
                paddingRight: Spacing.xs,
                width: rowGutterW,
              }}
            >
              {(clues.rows[r].length > 0 ? clues.rows[r] : [0]).map((n, i) => (
                <Text
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed clue list
                  key={`row-clue-${r}-${i}`}
                  style={[
                    s.clueText,
                    {
                      color: rowSatisfied[r]
                        ? `${theme.mutedText}70`
                        : theme.text,
                    },
                  ]}
                >
                  {n}
                </Text>
              ))}
            </RNView>
            {row.map((cell, c) => (
              <Pressable
                accessibilityLabel={t("a11yRowCol", { col: c + 1, row: r + 1 })}
                accessibilityRole="button"
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
                key={`cell-${r}-${c}`}
                onPress={() => handleCellPress(r, c)}
                style={[
                  {
                    alignItems: "center",
                    backgroundColor:
                      cell === FILLED ? theme.tint : theme.elevated,
                    borderColor:
                      (hintCell?.r === r && hintCell?.c === c) ||
                      cell === FILLED
                        ? theme.tint
                        : theme.border,
                    borderRadius: 4,
                    borderWidth:
                      hintCell?.r === r && hintCell?.c === c ? 2.5 : 1,
                    height: cellSize,
                    justifyContent: "center",
                    width: cellSize,
                  },
                  cellOuter(c),
                ]}
              >
                {cell === EMPTY && (
                  <Text
                    style={{
                      color: theme.mutedText,
                      fontSize: Math.max(10, cellSize * 0.45),
                      fontWeight: FontWeight.bold,
                    }}
                  >
                    ✕
                  </Text>
                )}
              </Pressable>
            ))}
          </RNView>
        ))}
      </RNView>

      {/* Fill / Mark mode toggle */}
      <RNView style={s.modeRow}>
        <Pressable
          accessibilityLabel={t("nonoFill")}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "fill" }}
          onPress={() => setMode("fill")}
          style={[
            s.modeBtn,
            {
              backgroundColor: mode === "fill" ? theme.tint : theme.surface,
              borderColor: mode === "fill" ? theme.tint : theme.border,
            },
          ]}
        >
          <Text
            style={[
              s.modeBtnText,
              { color: mode === "fill" ? theme.onTint : theme.text },
            ]}
          >
            ■ {t("nonoFill")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("nonoMark")}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "mark" }}
          onPress={() => setMode("mark")}
          style={[
            s.modeBtn,
            {
              backgroundColor: mode === "mark" ? theme.tint : theme.surface,
              borderColor: mode === "mark" ? theme.tint : theme.border,
            },
          ]}
        >
          <Text
            style={[
              s.modeBtnText,
              { color: mode === "mark" ? theme.onTint : theme.text },
            ]}
          >
            ✕ {t("nonoMark")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("hint")}
          accessibilityRole="button"
          accessibilityState={{ disabled: !hintAvailable }}
          disabled={!hintAvailable}
          onPress={handleHint}
          style={[
            s.modeBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: hintAvailable ? 1 : 0.4,
            },
          ]}
        >
          <Text style={[s.modeBtnText, { color: theme.text }]}>
            💡 {t("hint")}
          </Text>
        </Pressable>
      </RNView>

      {/* Bottom bar */}
      <RNView style={s.bottomBar}>
        <Pressable
          accessibilityLabel={t("playAgain")}
          accessibilityRole="button"
          onPress={() => startLevel(level)}
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
  bottomBar: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },

  btnCol: { alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },

  clueText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: FontWeight.bold,
    lineHeight: 13,
  },
  desc: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  hint: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
    textAlign: "center",
  },

  hud: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xs,
    width: "100%",
  },
  hudText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  levelBtn: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  levelBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingBottom: Spacing.lg,
  },

  mainBtn: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
  },
  mainBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  modeBtn: {
    borderRadius: Radius.button,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
  },
  modeBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.5,
  },

  modeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  smallBtn: {
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  smallBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  title: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.black,
    marginBottom: Spacing.xs,
  },
});
