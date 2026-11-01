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
  KIDS_SHADOW_OPTIONS,
  KIDS_SHADOW_ROUNDS,
  makeShadowRound,
} from "@/utils/kidsGames";

const STARS_HEIGHT = 56;
const GAP = 14;
const FOUND_MS = 900;
const NOPE_MS = 500;
/**
 * Emoji ignore text colour, so the silhouette is the emoji drawn through a
 * brightness(0) filter (web CSS; RN parses the same string on native).
 */
const SILHOUETTE = { filter: "brightness(0)" } as const;

/** Relative luminance of a #rrggbb colour (0 = black, 1 = white). */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/**
 * Shadows, kids variant: one animal on top, three dark silhouettes below —
 * tap the animal's own shadow. A wrong one just dims for a moment; the
 * right one lights up in colour. 5 rounds, then the celebration. Records
 * nothing.
 */
export default function KidsShadows({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [round, setRound] = useState(0);
  const [data, setData] = useState(() => makeShadowRound(null, Math.random));
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
    clearTimer();
    if (index !== data.answerIndex) {
      haptic.tap();
      setNope(index);
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
      if (next < KIDS_SHADOW_ROUNDS) {
        setData(makeShadowRound(data.animal, Math.random));
      }
    }, FOUND_MS);
  };

  const handleAgain = () => {
    setRound(0);
    setFound(false);
    setData(makeShadowRound(null, Math.random));
  };

  if (round >= KIDS_SHADOW_ROUNDS) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  // Black shadows need light paper: on dark palettes use the light ink colour.
  const paper =
    luminance(theme.kidsBackground) < 0.3 ? theme.kidsOnTile : theme.kidsTile5;
  const option = Math.floor(
    Math.max(
      72,
      Math.min(
        140,
        (width - 24 - GAP * (KIDS_SHADOW_OPTIONS - 1)) / KIDS_SHADOW_OPTIONS
      )
    )
  );
  const hero = Math.floor(
    Math.max(
      110,
      Math.min(240, width - 48, height - STARS_HEIGHT - option - 96)
    )
  );

  return (
    <View style={styles.root}>
      <KidsStars done={round + (found ? 1 : 0)} total={KIDS_SHADOW_ROUNDS} />
      <View
        accessibilityLabel={data.animal}
        accessible
        style={[
          styles.hero,
          { backgroundColor: theme.kidsTile2, height: hero, width: hero },
        ]}
        testID="kids-shadow-animal"
      >
        <Text style={{ fontSize: hero * 0.56, lineHeight: hero * 0.7 }}>
          {data.animal}
        </Text>
      </View>
      <View style={[styles.row, { gap: GAP }]}>
        {data.options.map((animal, index) => {
          const isFound = found && index === data.answerIndex;
          return (
            <Pressable
              accessibilityLabel={t("kidsA11yShadow", { animal })}
              accessibilityRole="button"
              key={`${String(round)}-${animal}`}
              onPress={() => handlePress(index)}
              style={[
                styles.option,
                {
                  backgroundColor: paper,
                  borderColor: isFound ? theme.success : "transparent",
                  height: option,
                  opacity: nope === index ? 0.4 : 1,
                  transform: [{ scale: isFound ? 1.08 : 1 }],
                  width: option,
                },
              ]}
              testID={`kids-shadow-${String(index)}`}
            >
              <View style={isFound ? null : SILHOUETTE}>
                <Text
                  style={{ fontSize: option * 0.56, lineHeight: option * 0.7 }}
                >
                  {animal}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    borderRadius: 36,
    justifyContent: "center",
  },
  option: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 4,
    justifyContent: "center",
  },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 20,
    justifyContent: "center",
    paddingBottom: 24,
  },
  row: { flexDirection: "row", justifyContent: "center" },
});
