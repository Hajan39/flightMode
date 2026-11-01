import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps, KidsTileToken } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import {
  isSlideSolved,
  KIDS_SLIDE_SIZE,
  shuffleSlideBoard,
  slideTile,
  solvedSlideBoard,
} from "@/utils/kidsGames";

const GAP = 10;
const GUIDE_CELL = 30;
const GUIDE_HEIGHT = GUIDE_CELL * KIDS_SLIDE_SIZE + 24;
/** Each tile has a picture + colour, so order works before numbers do. */
const TILE_PICTURES = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐸", "🐵"];
const TILE_COLORS: readonly KidsTileToken[] = [
  "kidsTile1",
  "kidsTile2",
  "kidsTile3",
  "kidsTile4",
  "kidsTile5",
  "kidsTile6",
  "kidsTile1",
  "kidsTile2",
];

const SOLVED = solvedSlideBoard();

/**
 * Sliding Puzzle, kids variant: 3×3, big numbered animal tiles, shuffled by
 * only a few legal slides (always solvable, quick). A small picture guide
 * shows the goal. No timer, no moves count. Records nothing.
 */
export default function KidsSlidingPuzzle({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [board, setBoard] = useState(() => shuffleSlideBoard(Math.random));
  const solved = isSlideSolved(board);

  const handlePress = (index: number) => {
    const next = slideTile(board, index);
    if (!next) {
      return;
    }
    haptic.tap();
    setBoard(next);
  };

  if (solved) {
    return (
      <KidsCelebration
        onAgain={() => setBoard(shuffleSlideBoard(Math.random))}
        onHome={onHome}
      />
    );
  }

  const byWidth = (width - 32 - GAP * (KIDS_SLIDE_SIZE - 1)) / KIDS_SLIDE_SIZE;
  const byHeight =
    (height - GUIDE_HEIGHT - 40 - GAP * (KIDS_SLIDE_SIZE - 1)) /
    KIDS_SLIDE_SIZE;
  const size = Math.max(72, Math.floor(Math.min(byWidth, byHeight, 150)));

  const renderTile = (value: number, cell: number, small: boolean) => {
    if (value === 0) {
      return null;
    }
    return (
      <View
        style={[
          styles.tileInner,
          {
            backgroundColor: theme[TILE_COLORS[value - 1]],
            borderRadius: small ? 5 : 24,
            height: cell,
            width: cell,
          },
        ]}
      >
        <Text style={{ fontSize: cell * 0.36, lineHeight: cell * 0.44 }}>
          {TILE_PICTURES[value - 1]}
        </Text>
        {small ? null : (
          <Text style={[styles.number, { color: theme.kidsOnTile }]}>
            {value}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.grid,
          styles.guide,
          { gap: 2, width: GUIDE_CELL * KIDS_SLIDE_SIZE + 4 },
        ]}
      >
        {SOLVED.map((value) => (
          <View
            key={`guide-${String(value)}`}
            style={{ height: GUIDE_CELL, width: GUIDE_CELL }}
          >
            {renderTile(value, GUIDE_CELL, true)}
          </View>
        ))}
      </View>
      <View
        style={[
          styles.grid,
          {
            gap: GAP,
            width: size * KIDS_SLIDE_SIZE + GAP * (KIDS_SLIDE_SIZE - 1),
          },
        ]}
      >
        {board.map((value, index) =>
          value === 0 ? (
            <View
              key="empty"
              style={[
                styles.empty,
                { borderColor: theme.border, height: size, width: size },
              ]}
              testID={`kids-slot-${String(index)}-0`}
            />
          ) : (
            <Pressable
              accessibilityLabel={t("kidsA11yTile", { n: value })}
              accessibilityRole="button"
              key={`tile-${String(value)}`}
              onPress={() => handlePress(index)}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
              testID={`kids-slot-${String(index)}-${String(value)}`}
            >
              {renderTile(value, size, false)}
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderRadius: 24, borderStyle: "dashed", borderWidth: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  guide: { marginBottom: 4, marginTop: 4 },
  number: { fontSize: 22, fontWeight: "900", lineHeight: 26 },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    paddingBottom: 24,
  },
  tileInner: { alignItems: "center", justifyContent: "center" },
});
