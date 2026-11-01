import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import {
  canFinishColouring,
  emptyFills,
  filledCount,
  fillRegion,
  KIDS_PAINTS,
} from "@/utils/kidsGames";
import { KIDS_PICTURES, type KidsRegion } from "./pictures";

const STARS_HEIGHT = 56;
const DOT = 64;
const DOT_GAP = 10;
const DONE_SIZE = 84;
const OUTLINE = 4;
const PAINT_NAMES: readonly TranslationKey[] = [
  "kidsPaintRed",
  "kidsPaintOrange",
  "kidsPaintYellow",
  "kidsPaintGreen",
  "kidsPaintBlue",
  "kidsPaintPurple",
];

/** Box of a region on a `canvas`-px square. */
const boxOf = (r: KidsRegion, canvas: number) => ({
  height: r.h * canvas,
  left: r.x * canvas,
  top: r.y * canvas,
  width: r.w * canvas,
});

/**
 * Colouring, kids variant: pick one of six big crayons, tap a part of the
 * picture to paint it. Any colour anywhere is fine (repaint any time); the
 * big ✓ finishes the picture with the celebration, and ▶ moves on to the
 * next picture. No timer, no wrong answers. Records nothing.
 */
export default function KidsColouring({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [pictureIndex, setPictureIndex] = useState(0);
  const picture = KIDS_PICTURES[pictureIndex % KIDS_PICTURES.length];
  const [fills, setFills] = useState(() => emptyFills(picture.regions.length));
  const [paint, setPaint] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleAgain = () => {
    const next = (pictureIndex + 1) % KIDS_PICTURES.length;
    setPictureIndex(next);
    setFills(emptyFills(KIDS_PICTURES[next].regions.length));
    setFinished(false);
  };

  if (finished) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const paletteRows =
    width - 16 >= DOT * 6 + DOT_GAP * 5 + DONE_SIZE + 16 ? 1 : 2;
  const perRow = 6 / paletteRows;
  const paletteHeight = paletteRows * DOT + (paletteRows - 1) * DOT_GAP;
  const canvas = Math.floor(
    Math.max(
      200,
      Math.min(width - 16, height - STARS_HEIGHT - paletteHeight - 64, 520)
    )
  );
  const canFinish = canFinishColouring(fills);

  const renderShape = (
    r: KidsRegion,
    fill: string,
    outline: string,
    box: { height: number; width: number }
  ) => {
    if (r.kind === "triangle") {
      const outer = {
        borderBottomWidth: box.height,
        borderLeftWidth: box.width / 2,
        borderRightWidth: box.width / 2,
      };
      const inset = OUTLINE * 2.2;
      return (
        <View style={styles.triangleBox}>
          <View
            style={[styles.triangle, outer, { borderBottomColor: outline }]}
          />
          <View
            style={[
              styles.triangle,
              {
                borderBottomColor: fill,
                borderBottomWidth: box.height - inset * 1.5,
                borderLeftWidth: box.width / 2 - inset,
                borderRightWidth: box.width / 2 - inset,
                left: inset,
                top: inset * 1.1,
              },
            ]}
          />
        </View>
      );
    }
    return (
      <View
        style={[
          styles.fill,
          {
            backgroundColor: fill,
            borderColor: outline,
            borderRadius:
              r.kind === "ellipse"
                ? Math.max(box.width, box.height)
                : (r.r ?? 0) * canvas,
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.root}>
      <KidsStars done={filledCount(fills)} total={fills.length} />
      <View
        accessibilityLabel={picture.emoji}
        style={[
          styles.canvas,
          {
            backgroundColor: theme.kidsTile4,
            height: canvas,
            width: canvas,
          },
        ]}
        testID={`kids-colouring-${picture.id}`}
      >
        {picture.regions.map((r, i) => {
          const box = boxOf(r, canvas);
          const f = fills[i];
          return (
            <Pressable
              accessibilityLabel={t("kidsA11yPart", { n: i + 1 })}
              accessibilityRole="button"
              accessibilityValue={
                f === null ? undefined : { text: t(PAINT_NAMES[f]) }
              }
              key={`${picture.id}-${String(i)}`}
              onPress={() => {
                haptic.tap();
                setFills(fillRegion(fills, i, paint));
              }}
              style={[
                styles.region,
                box,
                r.rotate ? { transform: [{ rotate: `${r.rotate}deg` }] } : null,
              ]}
              testID={`kids-region-${String(i)}-${f === null ? "empty" : String(f)}`}
            >
              {renderShape(
                r,
                f === null ? theme.kidsBackground : KIDS_PAINTS[f],
                theme.kidsOnTile,
                box
              )}
            </Pressable>
          );
        })}
        {picture.decor.map((d, i) => (
          <View
            key={`${picture.id}-decor-${String(i)}`}
            style={[
              styles.decor,
              boxOf(d, canvas),
              {
                backgroundColor: theme.kidsOnTile,
                borderRadius: d.kind === "ellipse" ? canvas : 0,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.tools}>
        <View
          style={[
            styles.palette,
            { gap: DOT_GAP, width: perRow * DOT + (perRow - 1) * DOT_GAP },
          ]}
        >
          {KIDS_PAINTS.map((color, i) => (
            <Pressable
              accessibilityLabel={t(PAINT_NAMES[i])}
              accessibilityRole="button"
              accessibilityState={{ selected: paint === i }}
              key={color}
              onPress={() => {
                haptic.tap();
                setPaint(i);
              }}
              style={[
                styles.dot,
                {
                  backgroundColor: color,
                  borderColor:
                    paint === i ? theme.kidsOnTile : theme.kidsBackground,
                  transform: [{ scale: paint === i ? 1.08 : 0.92 }],
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          accessibilityLabel={t("kidsA11yDone")}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canFinish }}
          disabled={!canFinish}
          onPress={() => setFinished(true)}
          style={({ pressed }) => [
            styles.done,
            {
              backgroundColor: theme.kidsTile3,
              opacity: canFinish ? 1 : 0.35,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Text style={[styles.doneIcon, { color: theme.kidsOnTile }]}>✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { borderRadius: 28, overflow: "hidden" },
  decor: { pointerEvents: "none", position: "absolute" },
  done: {
    alignItems: "center",
    borderRadius: 28,
    height: DONE_SIZE,
    justifyContent: "center",
    width: DONE_SIZE,
  },
  doneIcon: { fontSize: 46, fontWeight: "900", lineHeight: 54 },
  dot: { borderRadius: DOT / 2, borderWidth: 5, height: DOT, width: DOT },
  fill: { borderWidth: OUTLINE, flex: 1 },
  palette: { flexDirection: "row", flexWrap: "wrap" },
  region: { position: "absolute" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    paddingBottom: 24,
  },
  tools: { alignItems: "center", flexDirection: "row", gap: 18 },
  triangle: {
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    height: 0,
    position: "absolute",
    width: 0,
  },
  triangleBox: { flex: 1 },
});
