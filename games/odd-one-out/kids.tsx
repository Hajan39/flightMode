import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { KIDS_ODD_ROUNDS, makeKidsOddRound } from "@/utils/kidsGames";

const GAP = 16;
const STARS_HEIGHT = 56;
/** The found tile glows this long before the next round. */
const FOUND_MS = 700;
/** A wrong tile gently dims this long — nothing is lost. */
const NOPE_MS = 500;

/**
 * Odd One Out, kids variant: 4 (later 6) big pictures, one is different.
 * No timer, no lives; 5 rounds, then the celebration. Records nothing.
 */
export default function KidsOddOneOut({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [round, setRound] = useState(0);
  const [data, setData] = useState(() => makeKidsOddRound(0, Math.random));
  const [found, setFound] = useState(false);
  const [nope, setNope] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const handlePress = (index: number) => {
    if (found) {
      return;
    }
    if (index !== data.oddIndex) {
      haptic.tap();
      clearTimer();
      setNope(index);
      timer.current = setTimeout(() => setNope(null), NOPE_MS);
      return;
    }
    haptic.success();
    clearTimer();
    setNope(null);
    setFound(true);
    timer.current = setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setFound(false);
      if (next < KIDS_ODD_ROUNDS) {
        setData(makeKidsOddRound(next, Math.random));
      }
    }, FOUND_MS);
  };

  const handleAgain = () => {
    setRound(0);
    setFound(false);
    setData(makeKidsOddRound(0, Math.random));
  };

  if (round >= KIDS_ODD_ROUNDS) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const { columns, items } = data;
  const rows = Math.ceil(items.length / columns);
  const byWidth = (width - 32 - GAP * (columns - 1)) / columns;
  const byHeight = (height - STARS_HEIGHT - 32 - GAP * (rows - 1)) / rows;
  const size = Math.max(72, Math.floor(Math.min(byWidth, byHeight, 180)));

  return (
    <View style={styles.root}>
      <KidsStars done={round + (found ? 1 : 0)} total={KIDS_ODD_ROUNDS} />
      <View
        style={[
          styles.grid,
          { gap: GAP, width: size * columns + GAP * (columns - 1) },
        ]}
      >
        {items.map((item, index) => {
          const isFound = found && index === data.oddIndex;
          return (
            <Pressable
              accessibilityLabel={item}
              accessibilityRole="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: identical pictures; position is the identity
              key={`${round}-${index}`}
              onPress={() => handlePress(index)}
              style={[
                styles.tile,
                {
                  backgroundColor: isFound ? theme.kidsTile3 : theme.kidsTile5,
                  borderColor: isFound ? theme.success : "transparent",
                  height: size,
                  opacity: nope === index ? 0.4 : 1,
                  transform: [{ scale: isFound ? 1.08 : 1 }],
                  width: size,
                },
              ]}
            >
              <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.64 }}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
  tile: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 4,
    justifyContent: "center",
  },
});
