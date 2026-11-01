import { useEffect, useRef, useState } from "react";
import { type GestureResponderEvent, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsShape from "@/components/kids/KidsShape";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import {
  decideDrop,
  KIDS_PAINTS,
  KIDS_SHAPE_ROUNDS,
  type KidsDropDecision,
  makeShapeRound,
  type KidsShape as Shape,
} from "@/utils/kidsGames";

const STARS_HEIGHT = 56;
const MAX_AREA = 520;
const GAP = 14;
/** A missed piece glides back to the tray in this long. */
const GLIDE_MS = 280;
/** All pieces home: pause before the next round. */
const ROUND_DONE_MS = 800;

const SHAPE_LABEL: Record<Shape, TranslationKey> = {
  circle: "kidsShapeCircle",
  square: "kidsShapeSquare",
  star: "kidsShapeStar",
  triangle: "kidsShapeTriangle",
};
/** Each shape keeps one crayon colour, so colour helps too. */
const SHAPE_COLOR: Record<Shape, string> = {
  circle: KIDS_PAINTS[0],
  square: KIDS_PAINTS[4],
  star: KIDS_PAINTS[2],
  triangle: KIDS_PAINTS[3],
};

interface PieceProps {
  label: string;
  left: number;
  /** Accessibility "activate": place it straight into its outline. */
  onAutoPlace: () => void;
  /** Decides where a drop at (dx, dy) from home goes. */
  onDrop: (dx: number, dy: number) => KidsDropDecision;
  onLift: () => void;
  shape: Shape;
  size: number;
  top: number;
}

/** One draggable piece in the tray; glides home after a miss. */
function Piece({
  label,
  left,
  onAutoPlace,
  onDrop,
  onLift,
  shape,
  size,
  top,
}: PieceProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const tilt = useSharedValue(0);
  const start = useRef({ x: 0, y: 0 });
  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  const grant = (e: GestureResponderEvent) => {
    // Grabbed again while still gliding home: continue from where it is.
    cancelAnimation(tx);
    cancelAnimation(ty);
    start.current = {
      x: e.nativeEvent.pageX - tx.value,
      y: e.nativeEvent.pageY - ty.value,
    };
    onLift();
  };
  const move = (e: GestureResponderEvent) => {
    tx.value = e.nativeEvent.pageX - start.current.x;
    ty.value = e.nativeEvent.pageY - start.current.y;
  };
  const release = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - start.current.x;
    const dy = e.nativeEvent.pageY - start.current.y;
    const decision = onDrop(dx, dy);
    if (decision.kind === "return") {
      // A calm glide home (no bounce).
      tx.value = withTiming(0, { duration: GLIDE_MS });
      ty.value = withTiming(0, { duration: GLIDE_MS });
      if (decision.wrong) {
        tilt.value = withSequence(
          withTiming(-10, { duration: 90 }),
          withTiming(10, { duration: 120 }),
          withTiming(0, { duration: 90 })
        );
      }
    }
  };

  return (
    <Animated.View
      accessibilityActions={[{ label, name: "activate" }]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessible
      onAccessibilityAction={(ev) => {
        if (ev.nativeEvent.actionName === "activate") {
          onAutoPlace();
        }
      }}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={release}
      onStartShouldSetResponder={() => true}
      style={[styles.piece, { height: size, left, top, width: size }, animated]}
      testID={`kids-shape-piece-${shape}`}
    >
      <KidsShape color={SHAPE_COLOR[shape]} shape={shape} size={size} />
    </Animated.View>
  );
}

/**
 * Shapes, kids variant: drag each shape (circle, square, triangle, star)
 * into its outline. Close enough snaps in; the wrong outline wiggles the
 * piece and it glides back. 3 then 4 shapes per round, 3 rounds, then the
 * celebration. No timer, nothing lost. Records nothing.
 */
export default function KidsShapes({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [round, setRound] = useState(0);
  const [data, setData] = useState(() => makeShapeRound(0, Math.random));
  const [placed, setPlaced] = useState<boolean[]>(() =>
    data.targets.map(() => false)
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const startRound = (next: number) => {
    const d = makeShapeRound(next, Math.random);
    setData(d);
    setPlaced(d.targets.map(() => false));
  };

  const handleAgain = () => {
    setRound(0);
    startRound(0);
  };

  if (round >= KIDS_SHAPE_ROUNDS) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const { pieces, targets } = data;
  const areaW = Math.min(width - 16, MAX_AREA);
  const areaH = Math.max(320, height - STARS_HEIGHT - 32);
  const count = targets.length;
  const size = Math.floor(
    Math.min(120, (areaW - GAP * (count + 1)) / count, areaH / 3.4)
  );
  const rowLeft = (i: number) =>
    (areaW - (size * count + GAP * (count - 1))) / 2 + i * (size + GAP);
  const targetTop = areaH * 0.22 - size / 2;
  const trayTop = areaH * 0.74 - size / 2;
  const allPlaced = placed.every(Boolean);

  const place = (target: number) => {
    haptic.success();
    const next = placed.map((p, i) => p || i === target);
    setPlaced(next);
    if (next.every(Boolean)) {
      timer.current = setTimeout(() => {
        const nextRound = round + 1;
        setRound(nextRound);
        if (nextRound < KIDS_SHAPE_ROUNDS) {
          startRound(nextRound);
        }
      }, ROUND_DONE_MS);
    }
  };

  const dropTargets = targets.map((shape, i) => ({
    cx: rowLeft(i) + size / 2,
    cy: targetTop + size / 2,
    filled: placed[i],
    shape,
  }));

  const handleDrop = (piece: number, dx: number, dy: number) => {
    const decision = decideDrop(
      pieces[piece],
      rowLeft(piece) + size / 2 + dx,
      trayTop + size / 2 + dy,
      dropTargets,
      size * 0.85
    );
    if (decision.kind === "snap") {
      place(decision.target);
    } else if (decision.wrong) {
      haptic.tap();
    }
    return decision;
  };

  const placedShapes = new Set(
    targets.filter((_, i) => placed[i]).map((shape) => shape)
  );

  return (
    <View style={styles.root}>
      <KidsStars done={round + (allPlaced ? 1 : 0)} total={KIDS_SHAPE_ROUNDS} />
      <View
        style={[
          styles.area,
          { backgroundColor: theme.kidsTile5, height: areaH, width: areaW },
        ]}
      >
        {targets.map((shape, i) => (
          <View
            accessibilityLabel={t("kidsA11yOutline", {
              shape: t(SHAPE_LABEL[shape]),
            })}
            accessible
            key={`target-${String(round)}-${shape}`}
            style={[
              styles.target,
              {
                backgroundColor: theme.kidsBackground,
                height: size,
                left: rowLeft(i),
                top: targetTop,
                width: size,
              },
            ]}
            testID={`kids-shape-target-${shape}`}
          >
            <View style={{ opacity: placed[i] ? 1 : 0.28 }}>
              <KidsShape
                color={placed[i] ? SHAPE_COLOR[shape] : theme.kidsOnTile}
                shape={shape}
                size={size * 0.9}
              />
            </View>
          </View>
        ))}
        {pieces.map((shape, i) =>
          placedShapes.has(shape) ? null : (
            <Piece
              key={`piece-${String(round)}-${shape}`}
              label={t(SHAPE_LABEL[shape])}
              left={rowLeft(i)}
              onAutoPlace={() => place(targets.indexOf(shape))}
              onDrop={(dx, dy) => handleDrop(i, dx, dy)}
              onLift={() => haptic.tap()}
              shape={shape}
              size={size}
              top={trayTop}
            />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { borderRadius: 32, overflow: "hidden" },
  piece: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    zIndex: 2,
  },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
  target: {
    alignItems: "center",
    borderRadius: 24,
    justifyContent: "center",
    position: "absolute",
  },
});
