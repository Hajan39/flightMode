import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps, KidsTileToken } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import {
  extendSimonSequence,
  KIDS_SIMON_GOAL,
  KIDS_SIMON_PADS,
  simonPlaybackAt,
} from "@/utils/kidsGames";

const GAP = 18;
const STARS_HEIGHT = 56;
const FRAME_MS = 50;
/** A tapped pad glows this long. */
const TAP_GLOW_MS = 250;
const PAD_TILES: readonly KidsTileToken[] = [
  "kidsTile1",
  "kidsTile4",
  "kidsTile3",
  "kidsTile2",
];

type Phase = "watch" | "play" | "done";

/**
 * Simon Says, kids variant: four big animal pads light up slowly; the child
 * taps them back. A mistake never ends the game — the same sequence simply
 * plays again. Reach a sequence of 4 for the celebration. Records nothing.
 */
export default function KidsSimonSays({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [sequence, setSequence] = useState<number[]>(() =>
    extendSimonSequence([], Math.random)
  );
  const [phase, setPhase] = useState<Phase>("watch");
  const [playbackStart, setPlaybackStart] = useState(() => Date.now());
  const [lit, setLit] = useState<number | null>(null);
  const [input, setInput] = useState(0);
  const [glow, setGlow] = useState<{ at: number; pad: number } | null>(null);

  // Playback derived from the wall clock (no chained timeouts).
  useEffect(() => {
    if (phase !== "watch") {
      return;
    }
    const id = setInterval(() => {
      const state = simonPlaybackAt(sequence, Date.now() - playbackStart);
      setLit(state.lit);
      if (state.done) {
        setPhase("play");
      }
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [phase, sequence, playbackStart]);

  useEffect(() => {
    if (!glow) {
      return;
    }
    const id = setTimeout(
      () => setGlow(null),
      Math.max(0, glow.at + TAP_GLOW_MS - Date.now())
    );
    return () => clearTimeout(id);
  }, [glow]);

  const replay = (next: number[]) => {
    setSequence(next);
    setInput(0);
    setLit(null);
    setPlaybackStart(Date.now());
    setPhase("watch");
  };

  const handlePress = (pad: number) => {
    if (phase !== "play") {
      return;
    }
    setGlow({ at: Date.now(), pad });
    if (pad !== sequence[input]) {
      // Gentle: show the same sequence again.
      haptic.tap();
      replay(sequence);
      return;
    }
    haptic.tap();
    const nextInput = input + 1;
    if (nextInput < sequence.length) {
      setInput(nextInput);
      return;
    }
    haptic.success();
    if (sequence.length >= KIDS_SIMON_GOAL) {
      setPhase("done");
      return;
    }
    replay(extendSimonSequence(sequence, Math.random));
  };

  const handleAgain = () => {
    setGlow(null);
    replay(extendSimonSequence([], Math.random));
  };

  if (phase === "done") {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const byWidth = (width - 40 - GAP) / 2;
  // Stars row on top, the 👀 / 👆 cue below.
  const byHeight = (height - STARS_HEIGHT - 110 - GAP) / 2;
  const size = Math.max(80, Math.floor(Math.min(byWidth, byHeight, 190)));
  const completed = sequence.length - 1;

  return (
    <View style={styles.root}>
      <KidsStars done={completed} total={KIDS_SIMON_GOAL} />
      <View style={[styles.grid, { gap: GAP, width: size * 2 + GAP }]}>
        {KIDS_SIMON_PADS.map((emoji, pad) => {
          const on = lit === pad || glow?.pad === pad;
          return (
            <Pressable
              accessibilityLabel={emoji}
              accessibilityRole="button"
              accessibilityState={{
                disabled: phase !== "play",
                selected: lit === pad,
              }}
              disabled={phase !== "play"}
              key={emoji}
              onPress={() => handlePress(pad)}
              style={[
                styles.pad,
                {
                  backgroundColor: theme[PAD_TILES[pad]],
                  borderColor: on ? theme.warning : "transparent",
                  height: size,
                  opacity: on || phase === "play" ? 1 : 0.6,
                  transform: [{ scale: on ? 1.08 : 1 }],
                  width: size,
                },
              ]}
            >
              <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>
                {emoji}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.cue}
      >
        {phase === "watch" ? "👀" : "👆"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cue: { fontSize: 44, lineHeight: 54 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  pad: {
    alignItems: "center",
    borderRadius: 36,
    borderWidth: 6,
    justifyContent: "center",
  },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    paddingBottom: 24,
  },
});
