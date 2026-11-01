import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import KidsParentLock from "@/components/kids/KidsParentLock";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { kidsGames } from "@/data/kidsGames";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { kidsGridColumns } from "@/utils/kidsMode";

const GUTTER = 20;
const GAP = 16;
/** Tiles stay friendly-big but never gigantic on tablets. */
const MAX_TILE = 260;

/**
 * Kids home: a grid of big picture tiles (2 columns on phones, 3 on
 * tablets), no header, no tab bar. The only way out is the parent lock in
 * the corner (hold 3 s). Android back here never reaches adult screens: it
 * just sends the app to the background.
 */
export default function KidsHomeScreen() {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const router = useRouter();
  const haptic = useHaptic();
  const { width } = useWindowDimensions();
  const setKidsMode = useSettingsStore((s) => s.setKidsMode);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const columns = kidsGridColumns(width);
  const available = Math.max(0, width - GUTTER * 2);
  const tile = Math.max(
    96,
    Math.min(MAX_TILE, Math.floor((available - GAP * (columns - 1)) / columns))
  );
  const gridWidth = tile * columns + GAP * (columns - 1);

  // Kids mode off → the root layout's route lock takes us back to Home.
  const handleUnlock = () => setKidsMode(false);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.kidsBackground }]}
    >
      <View style={styles.topBar}>
        <Text
          accessibilityLabel={t("kidsModeTitle")}
          accessibilityRole="header"
          style={styles.hello}
        >
          ✈️ ☁️
        </Text>
        <KidsParentLock onUnlock={handleUnlock} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid, { gap: GAP, width: gridWidth }]}>
          {kidsGames.map((game) => (
            <Pressable
              accessibilityLabel={t(game.labelKey)}
              accessibilityRole="button"
              key={game.id}
              onPress={() => {
                haptic.tap();
                router.push(`/kids/${game.id}` as never);
              }}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: theme[game.tile],
                  height: tile,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                  width: tile,
                },
              ]}
            >
              <Text
                style={[
                  styles.tileEmoji,
                  { fontSize: tile * 0.42, lineHeight: tile * 0.52 },
                ]}
              >
                {game.emoji}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.tileLabel, { color: theme.kidsOnTile }]}
              >
                {t(game.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  hello: { fontSize: 34, lineHeight: 42 },
  safeArea: { flex: 1 },
  scrollContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 32,
    paddingHorizontal: GUTTER,
    paddingTop: 8,
  },
  tile: {
    alignItems: "center",
    borderRadius: 36,
    justifyContent: "center",
    padding: 12,
  },
  tileEmoji: { textAlign: "center" },
  tileLabel: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingTop: 8,
  },
});
