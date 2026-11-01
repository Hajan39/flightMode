import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import KidsCelebration from "@/components/kids/KidsCelebration";
import KidsStars from "@/components/kids/KidsStars";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { KidsGameProps, KidsTileToken } from "@/data/kidsGames";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import {
  catchFallProgress,
  KIDS_CATCH_GOAL,
  KIDS_CATCH_ITEMS,
  KIDS_CATCH_LANES,
  KIDS_CATCH_LINE,
  KIDS_CATCH_SPAWN_MS,
} from "@/utils/kidsGames";

const STARS_HEIGHT = 56;
const FRAME_MS = 50;
const MAX_BOARD_WIDTH = 420;
const FIRST_SPAWN_MS = 600;
const LANE_TILES: readonly KidsTileToken[] = [
  "kidsTile4",
  "kidsTile5",
  "kidsTile4",
];

interface Falling {
  emoji: string;
  id: number;
  lane: number;
  spawnAt: number;
}

/**
 * Cargo Catch, kids variant: presents fall slowly down three wide lanes; tap
 * a lane to move the basket there. No bombs, no lives, no timer — a missed
 * present just falls away. Catch 8 for the celebration. Records nothing.
 */
export default function KidsCargoCatch({ onHome }: KidsGameProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  const [items, setItems] = useState<Falling[]>([]);
  const [basket, setBasket] = useState(1);
  const [caught, setCaught] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const itemsRef = useRef<Falling[]>([]);
  const basketRef = useRef(1);
  const nextSpawnRef = useRef(Date.now() + FIRST_SPAWN_MS);
  const nextIdRef = useRef(0);
  const done = caught >= KIDS_CATCH_GOAL;

  // Positions come from each item's spawn time (wall clock), not tick counts.
  useEffect(() => {
    if (done) {
      return;
    }
    const id = setInterval(() => {
      const at = Date.now();
      let got = 0;
      let next = itemsRef.current.filter((item) => {
        const p = catchFallProgress(item.spawnAt, at);
        if (p >= KIDS_CATCH_LINE && item.lane === basketRef.current) {
          got += 1;
          return false;
        }
        return p < 1;
      });
      if (at >= nextSpawnRef.current && next.length < 2) {
        const lane = Math.floor(Math.random() * KIDS_CATCH_LANES);
        next = [
          ...next,
          {
            emoji:
              KIDS_CATCH_ITEMS[nextIdRef.current % KIDS_CATCH_ITEMS.length],
            id: nextIdRef.current,
            lane,
            spawnAt: at,
          },
        ];
        nextIdRef.current += 1;
        nextSpawnRef.current = at + KIDS_CATCH_SPAWN_MS;
      }
      itemsRef.current = next;
      setItems(next);
      setNow(at);
      if (got > 0) {
        haptic.success();
        setCaught((c) => c + got);
      }
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [done, haptic]);

  const moveTo = (lane: number) => {
    if (lane !== basketRef.current) {
      haptic.tap();
    }
    basketRef.current = lane;
    setBasket(lane);
  };

  const handleAgain = () => {
    itemsRef.current = [];
    setItems([]);
    nextSpawnRef.current = Date.now() + FIRST_SPAWN_MS;
    setCaught(0);
  };

  if (done) {
    return <KidsCelebration onAgain={handleAgain} onHome={onHome} />;
  }

  const boardWidth = Math.min(width - 24, MAX_BOARD_WIDTH);
  const laneWidth = boardWidth / KIDS_CATCH_LANES;
  const boardHeight = Math.max(240, height - STARS_HEIGHT - 32);
  const itemSize = Math.min(72, laneWidth * 0.62);
  const basketSize = Math.min(88, laneWidth * 0.78);
  const fallSpan = boardHeight - basketSize - itemSize * 0.4;

  return (
    <View style={styles.root}>
      <KidsStars done={caught} total={KIDS_CATCH_GOAL} />
      <View style={[styles.board, { height: boardHeight, width: boardWidth }]}>
        {Array.from({ length: KIDS_CATCH_LANES }, (_, lane) => (
          <Pressable
            accessibilityLabel={t("kidsA11yLane", { n: lane + 1 })}
            accessibilityRole="button"
            key={`lane-${String(lane)}`}
            onPress={() => moveTo(lane)}
            style={[
              styles.lane,
              {
                backgroundColor: theme[LANE_TILES[lane]],
                opacity: lane === basket ? 1 : 0.7,
                width: laneWidth,
              },
            ]}
          >
            {items
              .filter((item) => item.lane === lane)
              .map((item) => (
                <Text
                  key={item.id}
                  style={[
                    styles.item,
                    {
                      fontSize: itemSize * 0.8,
                      lineHeight: itemSize,
                      top:
                        Math.min(1, catchFallProgress(item.spawnAt, now)) *
                        fallSpan,
                      width: laneWidth,
                    },
                  ]}
                  testID={`kids-item-lane-${String(lane)}`}
                >
                  {item.emoji}
                </Text>
              ))}
            {lane === basket ? (
              <Text
                style={[
                  styles.basket,
                  {
                    fontSize: basketSize * 0.8,
                    lineHeight: basketSize,
                    width: laneWidth,
                  },
                ]}
              >
                🧺
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  basket: { bottom: 6, position: "absolute", textAlign: "center" },
  board: {
    borderRadius: 32,
    flexDirection: "row",
    overflow: "hidden",
  },
  item: { position: "absolute", textAlign: "center" },
  lane: { height: "100%" },
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingBottom: 24,
  },
});
