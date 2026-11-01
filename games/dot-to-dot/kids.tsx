import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { KIDS_DOT_ROUNDS, pickDotPictures, tapDot } from "@/utils/kidsGames";

const STARS_HEIGHT = 56;
const LINE = 7;
/** The finished picture shows this long before the next one. */
const REVEAL_MS = 1500;
const WIGGLE_MS = 450;

type Point = readonly [number, number];

/**
 * Dot to dot, kids variant: tap the numbered dots in order (1→5, later
 * 1→7); a line follows each right tap and the closed outline reveals the
 * picture. A wrong dot only wiggles. 3 pictures, then the celebration.
 * Records nothing.
 */
export default function KidsDotToDot({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [pictures, setPictures] = useState(() => pickDotPictures(Math.random));
  const [round, setRound] = useState(0);
  const [next, setNext] = useState(0);
  const [wiggle, setWiggle] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wiggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      for (const ref of [timer, wiggleTimer]) {
        if (ref.current) {
          clearTimeout(ref.current);
        }
      }
    },
    []
  );

  const handleAgain = () => {
    setPictures(pickDotPictures(Math.random));
    setRound(0);
    setNext(0);
  };

  if (round >= KIDS_DOT_ROUNDS) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const picture = pictures[round];
  const total = picture.points.length;
  const complete = next >= total;
  const canvas = Math.floor(
    Math.max(220, Math.min(width - 16, height - STARS_HEIGHT - 32, 520))
  );
  const dot = Math.floor(Math.max(64, Math.min(84, canvas * 0.18)));
  const at = ([x, y]: Point) => ({
    x: dot / 2 + x * (canvas - dot),
    y: dot / 2 + y * (canvas - dot),
  });

  const handlePress = (index: number) => {
    if (complete) {
      return;
    }
    const result = tapDot(next, index, total);
    if (!result.ok) {
      haptic.tap();
      if (wiggleTimer.current) {
        clearTimeout(wiggleTimer.current);
      }
      setWiggle(index);
      wiggleTimer.current = setTimeout(() => setWiggle(null), WIGGLE_MS);
      return;
    }
    setNext(result.next);
    if (!result.complete) {
      haptic.tap();
      return;
    }
    haptic.success();
    timer.current = setTimeout(() => {
      setRound((r) => r + 1);
      setNext(0);
    }, REVEAL_MS);
  };

  const segments: [Point, Point][] = [];
  for (let i = 1; i < Math.min(next, total); i += 1) {
    segments.push([picture.points[i - 1], picture.points[i]]);
  }
  if (complete) {
    segments.push([picture.points[total - 1], picture.points[0]]);
  }

  return (
    <View style={styles.root}>
      <KidsStars done={round + (complete ? 1 : 0)} total={KIDS_DOT_ROUNDS} />
      <View
        style={[
          styles.canvas,
          {
            backgroundColor: theme.kidsTile5,
            height: canvas,
            width: canvas,
          },
        ]}
        testID={`kids-dots-${picture.id}`}
      >
        {segments.map(([a, b], i) => {
          const p = at(a);
          const q = at(b);
          const length = Math.hypot(q.x - p.x, q.y - p.y);
          const angle = Math.atan2(q.y - p.y, q.x - p.x);
          return (
            <View
              key={`line-${picture.id}-${String(i)}`}
              style={[
                styles.line,
                {
                  backgroundColor: theme.kidsOnTile,
                  left: (p.x + q.x) / 2 - length / 2,
                  top: (p.y + q.y) / 2 - LINE / 2,
                  transform: [{ rotate: `${angle}rad` }],
                  width: length,
                },
              ]}
            />
          );
        })}
        {complete ? (
          <Animated.Text
            accessibilityLabel={picture.emoji}
            entering={ZoomIn.springify()}
            style={[
              styles.reveal,
              {
                fontSize: canvas * 0.34,
                lineHeight: canvas * 0.42,
                top: canvas / 2 - canvas * 0.21,
                width: canvas,
              },
            ]}
          >
            {picture.emoji}
          </Animated.Text>
        ) : null}
        {picture.points.map((point, index) => {
          const { x, y } = at(point);
          const isDone = index < next;
          const isNext = index === next;
          let fill = theme.kidsTile4;
          if (isDone) {
            fill = theme.kidsTile3;
          } else if (isNext) {
            fill = theme.kidsTile1;
          }
          return (
            <Pressable
              accessibilityLabel={t("kidsA11yDot", { n: index + 1 })}
              accessibilityRole="button"
              accessibilityState={{ selected: isDone }}
              key={`dot-${picture.id}-${String(index)}`}
              onPress={() => handlePress(index)}
              style={[
                styles.dot,
                {
                  backgroundColor: fill,
                  borderColor: isNext ? theme.kidsOnTile : "transparent",
                  borderRadius: dot / 2,
                  height: dot,
                  left: x - dot / 2,
                  opacity: complete ? 0.5 : 1,
                  top: y - dot / 2,
                  transform: [{ rotate: wiggle === index ? "16deg" : "0deg" }],
                  width: dot,
                },
              ]}
              testID={`kids-dot-${String(index + 1)}`}
            >
              <Text style={[styles.number, { color: theme.kidsOnTile }]}>
                {index + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { borderRadius: 32 },
  dot: {
    alignItems: "center",
    borderWidth: 4,
    justifyContent: "center",
    position: "absolute",
  },
  line: {
    borderRadius: LINE / 2,
    height: LINE,
    pointerEvents: "none",
    position: "absolute",
  },
  number: { fontSize: 26, fontWeight: "900", lineHeight: 32 },
  reveal: {
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    textAlign: "center",
  },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
});
