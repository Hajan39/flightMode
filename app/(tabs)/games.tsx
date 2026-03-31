import { StyleSheet, FlatList, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameConfig } from "@/types/game";

export default function GamesScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const progress = useGameStore((s) => s.progress);
	const games: GameConfig[] = [
		{
			id: "memory",
			name: t("gameMemoryName"),
			description: t("gameMemoryListDescription"),
			estimatedTime: 10,
			icon: "grid-outline",
		},
		{
			id: "tap-rush",
			name: t("gameTapRushName"),
			description: t("gameTapRushDescription"),
			estimatedTime: 2,
			icon: "finger-print-outline",
		},
		{
			id: "sky-math",
			name: t("gameSkyMathName"),
			description: t("gameSkyMathDescription"),
			estimatedTime: 3,
			icon: "calculator-outline",
		},
		{
			id: "quiz",
			name: t("gameQuizName"),
			description: t("gameQuizDescription"),
			estimatedTime: 4,
			icon: "help-circle-outline",
		},
		{
			id: "reaction",
			name: t("gameReactionName"),
			description: t("gameReactionDescription"),
			estimatedTime: 1,
			icon: "flash-outline",
		},
		{
			id: "runway-landing",
			name: t("gameRunwayLandingName"),
			description: t("gameRunwayLandingDescription"),
			estimatedTime: 2,
			icon: "airplane-outline",
		},
		{
			id: "cabin-call",
			name: t("gameCabinCallName"),
			description: t("gameCabinCallDescription"),
			estimatedTime: 3,
			icon: "megaphone-outline",
		},
		{
			id: "air-traffic-control",
			name: t("gameAirTrafficControlName"),
			description: t("gameAirTrafficControlDescription"),
			estimatedTime: 12,
			icon: "navigate-outline",
		},
		{
			id: "flight-path",
			name: t("gameFlightPathName"),
			description: t("gameFlightPathDescription"),
			estimatedTime: 8,
			icon: "map-outline",
		},
		{
			id: "sky-defense",
			name: t("gameSkyDefenseName"),
			description: t("gameSkyDefenseDescription"),
			estimatedTime: 10,
			icon: "shield-outline",
		},
		{
			id: "stack-sort",
			name: t("gameStackSortName"),
			description: t("gameStackSortDescription"),
			estimatedTime: 5,
			icon: "layers-outline",
		},
		{
			id: "duel-tictactoe",
			name: t("gameDuelTicTacToeName"),
			description: t("gameDuelTicTacToeDescription"),
			estimatedTime: 4,
			icon: "people-outline",
		},
		{
			id: "duel-dice",
			name: t("gameDuelDiceName"),
			description: t("gameDuelDiceDescription"),
			estimatedTime: 3,
			icon: "dice-outline",
		},
	];

	return (
		<View style={styles.container}>
			<FlatList
				data={games}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item, index }) => {
					const gameProgress = progress[item.id];
					return (
						<Animated.View entering={FadeInDown.delay(index * 60).springify()}>
							<AnimatedPressable
								style={[
									styles.card,
									{ backgroundColor: theme.card, borderColor: theme.border },
								]}
								onPress={() => router.push(`/game/${item.id}` as never)}
							>
								<Ionicons
									name={item.icon as never}
									size={32}
									color={theme.tint}
								/>
								<View
									style={styles.cardContent}
									lightColor="transparent"
									darkColor="transparent"
								>
									<Text style={styles.cardTitle}>{item.name}</Text>
									<Text style={[styles.cardDesc, { color: theme.mutedText }]}>
										{item.description}
									</Text>
									<Text style={[styles.cardMeta, { color: theme.mutedText }]}>
										~{t("minutesShort", { minutes: item.estimatedTime })}
										{gameProgress
											? ` · ${t("bestScorePlayed", { score: gameProgress.highScore, times: gameProgress.timesPlayed })}`
											: ""}
									</Text>
								</View>
								<Ionicons
									name="chevron-forward"
									size={20}
									color={theme.mutedText}
								/>
							</AnimatedPressable>
						</Animated.View>
					);
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	list: { padding: 16 },
	card: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 12,
	},
	cardContent: { flex: 1, marginLeft: 12 },
	cardTitle: { fontSize: 18, fontWeight: "600" },
	cardDesc: { fontSize: 14, color: "#666", marginTop: 2 },
	cardMeta: { fontSize: 12, color: "#999", marginTop: 4 },
});
