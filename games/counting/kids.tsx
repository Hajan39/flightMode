import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import {
  countDots,
  KIDS_COUNT_MAX,
  KIDS_COUNT_ROUNDS,
  makeCountRound,
} from "@/utils/kidsGames";

const STARS_HEIGHT = 56;
const GAP = 12;
const FOUND_MS = 900;
const NOPE_MS = 500;
const NUMBERS = Array.from({ length: KIDS_COUNT_MAX }, (_, i) => i + 1);

/**
 * Counting, kids variant: 1–5 pictures on top; tap the button with as many
 * dots (dice-style, the numeral small underneath). A wrong button wiggles,
 * nothing is lost. 5 rounds (first up to 3, then up to 5), then the
 * celebration. Records nothing.
 */
export default function KidsCounting({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [round, setRound] = useState(0);
  const [data, setData] = useState(() => makeCountRound(0, null, Math.random));
  const [found, setFound] = useState(false);
  const [nope, setNope] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const handlePress = (n: number) => {
    if (found) {
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    if (n !== data.count) {
      haptic.tap();
      setNope(n);
      timer.current = setTimeout(() => setNope(null), NOPE_MS);
      return;
    }
    haptic.success();
    setNope(null);
    setFound(true);
    timer.current = setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setFound(false);
      if (next < KIDS_COUNT_ROUNDS) {
        setData(makeCountRound(next, data.count, Math.random));
      }
    }, FOUND_MS);
  };

  const handleAgain = () => {
    setRound(0);
    setFound(false);
    setData(makeCountRound(0, null, Math.random));
  };

  if (round >= KIDS_COUNT_ROUNDS) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const button = Math.floor(
    Math.max(76, Math.min(116, (width - 24 - GAP * 2) / 3))
  );
  const trayW = Math.min(width - 24, 460);
  const trayH = Math.max(
    140,
    Math.min(300, height - STARS_HEIGHT - button * 2 - GAP - 80)
  );
  const objectSize = Math.min(
    trayH * 0.42,
    (trayW - 24) / Math.min(3, data.count) - 8
  );
  const dot = button * 0.17;

  return (
    <View style={styles.root}>
      <KidsStars done={round + (found ? 1 : 0)} total={KIDS_COUNT_ROUNDS} />
      <View
        accessibilityLabel={Array.from(
          { length: data.count },
          () => data.emoji
        ).join(" ")}
        accessible
        style={[
          styles.tray,
          {
            backgroundColor: found ? theme.kidsTile3 : theme.kidsTile2,
            height: trayH,
            width: trayW,
          },
        ]}
        testID={`kids-count-${String(data.count)}`}
      >
        {Array.from({ length: data.count }, (_, i) => (
          <Text
            key={`${String(round)}-${String(i)}`}
            style={{
              fontSize: objectSize * 0.8,
              lineHeight: objectSize,
              transform: [{ scale: found ? 1.12 : 1 }],
            }}
          >
            {data.emoji}
          </Text>
        ))}
      </View>
      <View style={[styles.buttons, { gap: GAP, width: button * 3 + GAP * 2 }]}>
        {NUMBERS.map((n) => {
          const isFound = found && n === data.count;
          return (
            <Pressable
              accessibilityLabel={String(n)}
              accessibilityRole="button"
              key={`n-${String(n)}`}
              onPress={() => handlePress(n)}
              style={[
                styles.button,
                {
                  backgroundColor: isFound ? theme.kidsTile3 : theme.kidsTile4,
                  borderColor: isFound ? theme.success : "transparent",
                  height: button,
                  opacity: nope === n ? 0.45 : 1,
                  transform: [{ rotate: nope === n ? "-8deg" : "0deg" }],
                  width: button,
                },
              ]}
            >
              <View
                style={[
                  styles.dots,
                  { height: button * 0.6, width: button * 0.6 },
                ]}
              >
                {countDots(n).map((cell) => (
                  <View
                    key={`d-${String(cell)}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: theme.kidsOnTile,
                        borderRadius: dot / 2,
                        height: dot,
                        left:
                          (cell % 3) * button * 0.2 + button * 0.1 - dot / 2,
                        top:
                          Math.floor(cell / 3) * button * 0.2 +
                          button * 0.1 -
                          dot / 2,
                        width: dot,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.numeral, { color: theme.kidsOnTile }]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 4,
    justifyContent: "center",
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  dot: { position: "absolute" },
  dots: { position: "relative" },
  numeral: { fontSize: 18, fontWeight: "800", lineHeight: 22 },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 18,
    justifyContent: "center",
    paddingBottom: 24,
  },
  tray: {
    alignContent: "center",
    alignItems: "center",
    borderRadius: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: 12,
  },
});
