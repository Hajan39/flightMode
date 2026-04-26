import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import GameRules from "@/components/GameRules";
import { getGameById } from "@/data/games";

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
