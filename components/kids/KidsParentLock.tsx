import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { parentHoldState } from "@/utils/kidsMode";

const SIZE = 64;
const DOTS = 12;
const DOT = 7;
const RING_RADIUS = SIZE / 2 - DOT / 2 - 1;
const FRAME_MS = 50;

/** Dot positions around the ring, clockwise from 12 o'clock. */
const DOT_POSITIONS = Array.from({ length: DOTS }, (_, i) => {
  const angle = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
  return {
    key: `dot-${i}`,
    left: SIZE / 2 + RING_RADIUS * Math.cos(angle) - DOT / 2,
    top: SIZE / 2 + RING_RADIUS * Math.sin(angle) - DOT / 2,
  };
});

/**
 * Parent lock (kids mode exit): press and hold for 3 s. A ring of dots fills
 * and a haptic tick marks every second; letting go early cancels. Timing is
 * derived from the wall clock (`parentHoldState`), not from counted ticks.
 */
export default function KidsParentLock({ onUnlock }: { onUnlock: () => void }) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const [progress, setProgress] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const ticksRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedAtRef.current = null;
    ticksRef.current = 0;
  };

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    },
    []
  );

  const handlePressIn = () => {
    stop();
    startedAtRef.current = Date.now();
    haptic.tap();
    timerRef.current = setInterval(() => {
      const state = parentHoldState(startedAtRef.current, Date.now());
      setProgress(state.progress);
      if (state.ticks > ticksRef.current) {
        ticksRef.current = state.ticks;
        if (!state.done) {
          haptic.tap();
        }
      }
      if (state.done) {
        stop();
        haptic.success();
        onUnlock();
      }
    }, FRAME_MS);
  };

  const handlePressOut = () => {
    stop();
    setProgress(0);
  };

  const filled = Math.round(progress * DOTS);

  return (
    <Pressable
      accessibilityHint={t("kidsLockHint")}
      accessibilityLabel={t("kidsLockLabel")}
      accessibilityRole="button"
      hitSlop={8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        {
          backgroundColor: progress > 0 ? theme.elevated : "transparent",
        },
      ]}
      testID="kids-parent-lock"
    >
      {DOT_POSITIONS.map((dot, i) => (
        <View
          key={dot.key}
          style={[
            styles.dot,
            {
              backgroundColor: i < filled ? theme.tint : theme.progressTrack,
              left: dot.left,
              opacity: progress > 0 ? 1 : 0.55,
              top: dot.top,
            },
          ]}
        />
      ))}
      <Ionicons
        color={progress > 0 ? theme.tint : theme.mutedText}
        name="lock-closed"
        size={24}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: SIZE / 2,
    height: SIZE,
    justifyContent: "center",
    width: SIZE,
  },
  dot: {
    borderRadius: DOT / 2,
    height: DOT,
    position: "absolute",
    width: DOT,
  },
});
