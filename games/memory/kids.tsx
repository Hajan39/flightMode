import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import {
  createKidsDeck,
  KIDS_MEMORY_FLIP_BACK_MS,
  KIDS_MEMORY_LEVELS,
  type KidsCard,
} from "@/utils/kidsGames";

const GAP = 14;
const STARS_HEIGHT = 56;

/**
 * Memory, kids variant: 2×3 animal cards, then 3×4 on "again". No timer, no
 * moves, no score; a mismatch simply turns back. Records nothing.
 */
export default function KidsMemory({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [level, setLevel] = useState(0);
  const { columns, pairs } = KIDS_MEMORY_LEVELS[level];
  const [cards, setCards] = useState<KidsCard[]>(() =>
    createKidsDeck(KIDS_MEMORY_LEVELS[0].pairs, Math.random)
  );
  const [open, setOpen] = useState<number[]>([]);
  const flipBack = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flipBack.current) {
        clearTimeout(flipBack.current);
      }
    },
    []
  );

  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const finished = matchedPairs === pairs;

  const handlePress = (card: KidsCard) => {
    if (card.matched || open.includes(card.id) || open.length >= 2) {
      return;
    }
    haptic.tap();
    const nextOpen = [...open, card.id];
    setOpen(nextOpen);
    if (nextOpen.length < 2) {
      return;
    }
    const [a, b] = nextOpen.map((id) => cards.find((c) => c.id === id));
    if (a && b && a.face === b.face) {
      haptic.success();
      setCards((prev) =>
        prev.map((c) =>
          c.id === a.id || c.id === b.id ? { ...c, matched: true } : c
        )
      );
      setOpen([]);
      return;
    }
    flipBack.current = setTimeout(() => {
      flipBack.current = null;
      setOpen([]);
    }, KIDS_MEMORY_FLIP_BACK_MS);
  };

  const handleAgain = () => {
    const nextLevel = (level + 1) % KIDS_MEMORY_LEVELS.length;
    setLevel(nextLevel);
    setCards(createKidsDeck(KIDS_MEMORY_LEVELS[nextLevel].pairs, Math.random));
    setOpen([]);
  };

  if (finished) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const rows = Math.ceil(cards.length / columns);
  const byWidth = (width - 32 - GAP * (columns - 1)) / columns;
  const byHeight = (height - STARS_HEIGHT - 32 - GAP * (rows - 1)) / rows;
  const size = Math.max(64, Math.floor(Math.min(byWidth, byHeight, 170)));

  return (
    <View style={styles.root}>
      <KidsStars done={matchedPairs} total={pairs} />
      <View
        style={[
          styles.grid,
          { gap: GAP, width: size * columns + GAP * (columns - 1) },
        ]}
      >
        {cards.map((card, index) => {
          const showing = card.matched || open.includes(card.id);
          return (
            <Pressable
              accessibilityLabel={
                showing ? card.face : t("kidsA11yCard", { n: index + 1 })
              }
              accessibilityRole="button"
              key={card.id}
              onPress={() => handlePress(card)}
              style={[
                styles.card,
                {
                  backgroundColor: showing
                    ? theme.kidsTile2
                    : theme[index % 2 === 0 ? "kidsTile4" : "kidsTile5"],
                  borderColor: card.matched ? theme.success : "transparent",
                  height: size,
                  width: size,
                },
              ]}
            >
              <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>
                {showing ? card.face : "☁️"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 4,
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
});
