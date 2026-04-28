import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GameRules from "@/components/GameRules";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { getGameById } from "@/data/games";
import { useTranslation } from "@/hooks/useTranslation";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function GameScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const game = id ? getGameById(id) : undefined;

	const headerOptions = game
		? {
				title: t(game.titleKey),
				headerRight: () => (
					<GameRules titleKey={game.titleKey} rulesKey={game.rulesKey} inline />
				),
			}
		: { title: t("stackGame") };

	const GameComponent = game ? game.loadComponent() : null;

	useEffect(() => {
		if (!game) return;

		captureAnalyticsEvent("game_start", {
			game_id: game.id,
			category: game.category,
			difficulty: game.difficulty,
			estimated_minutes: game.estimatedTime,
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
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<GameComponent />
			</SafeAreaView>
		</>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	container: { flex: 1, alignItems: "center", justifyContent: "center" },
	notFoundTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
	notFoundHint: { fontSize: 13, textAlign: "center", marginTop: 6 },
});
