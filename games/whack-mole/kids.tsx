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
  KIDS_MOLE_GOAL,
  KIDS_MOLE_HOLES,
  KIDS_MOLE_PAUSE_MS,
  KIDS_MOLE_UP_MS,
  nextMoleHole,
} from "@/utils/kidsGames";

const COLUMNS = 2;
const GAP = 16;
const STARS_HEIGHT = 56;
const FRAME_MS = 100;
const POP_MS = 500;
const MOLE = "🐹";

interface Mole {
  hole: number;
  upAt: number;
}

/**
 * Whack-a-Mole, kids variant ("Peekaboo"): one slow hamster at a time in six
 * big holes. Missing it costs nothing — it just hides and pops up elsewhere.
 * Catch 8 for the celebration. No timer, no score. Records nothing.
 */
export default function KidsWhackMole({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [caught, setCaught] = useState(0);
  const [mole, setMoleState] = useState<Mole | null>(null);
  const moleRef = useRef<Mole | null>(null);
  const setMole = (next: Mole | null) => {
    moleRef.current = next;
    setMoleState(next);
  };
  const [pop, setPop] = useState<number | null>(null);
  const nextAtRef = useRef(Date.now() + KIDS_MOLE_PAUSE_MS);
  const lastHoleRef = useRef<number | null>(null);
  const done = caught >= KIDS_MOLE_GOAL;

  // Wall-clock driven: a mole is up for KIDS_MOLE_UP_MS, then hides.
  useEffect(() => {
    if (done) {
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      const { current } = moleRef;
      if (current && now - current.upAt >= KIDS_MOLE_UP_MS) {
        nextAtRef.current = now + KIDS_MOLE_PAUSE_MS;
        moleRef.current = null;
        setMoleState(null);
      } else if (!current && now >= nextAtRef.current) {
        const hole = nextMoleHole(lastHoleRef.current, Math.random);
        lastHoleRef.current = hole;
        moleRef.current = { hole, upAt: now };
        setMoleState(moleRef.current);
      }
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (pop === null) {
      return;
    }
    const id = setTimeout(() => setPop(null), POP_MS);
    return () => clearTimeout(id);
  }, [pop]);

  const handlePress = (hole: number) => {
    if (!mole || mole.hole !== hole) {
      return;
    }
    haptic.success();
    setMole(null);
    setPop(hole);
    nextAtRef.current = Date.now() + KIDS_MOLE_PAUSE_MS;
    setCaught((c) => c + 1);
  };

  const handleAgain = () => {
    setCaught(0);
    setMole(null);
    setPop(null);
    nextAtRef.current = Date.now() + KIDS_MOLE_PAUSE_MS;
  };

  if (done) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const rows = Math.ceil(KIDS_MOLE_HOLES / COLUMNS);
  const byWidth = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;
  const byHeight = (height - STARS_HEIGHT - 32 - GAP * (rows - 1)) / rows;
  const size = Math.max(72, Math.floor(Math.min(byWidth, byHeight, 180)));

  return (
    <View style={styles.root}>
      <KidsStars done={caught} total={KIDS_MOLE_GOAL} />
      <View
        style={[
          styles.grid,
          { gap: GAP, width: size * COLUMNS + GAP * (COLUMNS - 1) },
        ]}
      >
        {Array.from({ length: KIDS_MOLE_HOLES }, (_, hole) => {
          const up = mole?.hole === hole;
          let face = "";
          if (up) {
            face = MOLE;
          } else if (pop === hole) {
            face = "⭐";
          }
          return (
            <Pressable
              accessibilityLabel={
                up ? MOLE : t("kidsA11yHole", { n: hole + 1 })
              }
              accessibilityRole="button"
              key={`hole-${String(hole)}`}
              onPress={() => handlePress(hole)}
              style={[
                styles.hole,
                {
                  backgroundColor: up ? theme.kidsTile3 : theme.kidsTile6,
                  height: size,
                  width: size,
                },
              ]}
            >
              <Text
                style={[
                  styles.pit,
                  { fontSize: size * 0.42, lineHeight: size * 0.5 },
                ]}
              >
                🕳️
              </Text>
              <Text
                style={[
                  styles.face,
                  { fontSize: size * 0.5, lineHeight: size * 0.62 },
                ]}
              >
                {face}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { bottom: "18%", position: "absolute", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  hole: {
    alignItems: "center",
    borderRadius: 32,
    justifyContent: "center",
    overflow: "hidden",
  },
  pit: { bottom: "6%", position: "absolute", textAlign: "center" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
});
