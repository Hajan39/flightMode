import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GameRules from "@/components/GameRules";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { getGameById } from "@/data/games";
import { useTranslation } from "@/hooks/useTranslation";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const game = id ? getGameById(id) : undefined;
  const markGameSeen = useDiscoveryStore((s) => s.markGameSeen);

  // Mark the game as seen so it drops out of the Home "New to try" row.
  useEffect(() => {
    if (id) {
      markGameSeen(id);
    }
  }, [id, markGameSeen]);

  const headerOptions = game
    ? {
        headerRight: () => (
          <GameRules inline rulesKey={game.rulesKey} titleKey={game.titleKey} />
        ),
        title: t(game.titleKey),
      }
    : { title: t("stackGame") };

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

  useEffect(() => {
    if (!game) {
      return;
    }

    captureAnalyticsEvent("game_start", {
      category: game.category,
      difficulty: game.difficulty,
      estimated_minutes: game.estimatedTime,
      game_id: game.id,
    });
  }, [game]);

  if (!GameComponent) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={styles.container}>
          <Text style={styles.notFoundTitle}>{t("gameNotFound", { id })}</Text>
          <Text style={[styles.notFoundHint, { color: theme.mutedText }]}>
            {t("gameNotFoundHint")}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <SafeAreaView
        edges={["left", "right", "bottom"]}
        style={[styles.safeArea, { backgroundColor: theme.background }]}
      >
        <GameComponent />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, justifyContent: "center" },
  notFoundHint: { fontSize: 13, marginTop: 6, textAlign: "center" },
  notFoundTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  safeArea: {
    flex: 1,
  },
});
