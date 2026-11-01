import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { getKidsGame } from "@/data/kidsGames";
import {
  GameViewportProvider,
  gameColumnWidth,
} from "@/hooks/useGameDimensions";
import { useTranslation } from "@/hooks/useTranslation";

const TOP_BAR = 80;

/**
 * Kids game host: one kids-mode game variant in the same portrait column
 * the adult host uses (games size from `useGameDimensions`). No header, no
 * rules, no countdown, no analytics — a big 🏠 is the only control.
 */
export default function KidsGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const router = useRouter();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const game = id ? getKidsGame(id) : undefined;

  const GameComponent = useMemo(() => {
    if (!game) {
      return null;
    }
    try {
      return game.loadComponent();
    } catch {
      return null;
    }
  }, [game]);

  const goHome = () => router.dismissTo("/kids" as never);

  const height =
    measuredHeight ??
    Math.max(0, window.height - TOP_BAR - insets.top - insets.bottom);
  const columnWidth = gameColumnWidth(window.width, height);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.kidsBackground }]}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={t("kidsHome")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={goHome}
          style={({ pressed }) => [
            styles.homeButton,
            {
              backgroundColor: theme.kidsTile4,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Text style={styles.homeIcon}>🏠</Text>
        </Pressable>
      </View>
      <View
        onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
        style={styles.body}
      >
        {GameComponent ? (
          <GameViewportProvider value={{ height, width: columnWidth }}>
            <View style={[styles.column, { width: columnWidth }]}>
              <GameComponent onHome={goHome} />
            </View>
          </GameViewportProvider>
        ) : (
          <Text style={styles.missing}>🙈</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  column: { alignSelf: "center", flex: 1 },
  homeButton: {
    alignItems: "center",
    borderRadius: 24,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  homeIcon: { fontSize: 32, lineHeight: 40 },
  missing: { fontSize: 80, marginTop: 80, textAlign: "center" },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: "row",
    height: TOP_BAR,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
