import { StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
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
			description: "Quick, standard, or long-haul memory mode",
			estimatedTime: 10,
			icon: "grid-outline",
		},
		{
			id: "tap-rush",
			name: "Tap Rush",
			description: "Tap as fast as possible in 20 seconds",
			estimatedTime: 2,
			icon: "finger-print-outline",
		},
		{
			id: "sky-math",
			name: "Sky Math",
			description: "Solve quick math rounds",
			estimatedTime: 3,
			icon: "calculator-outline",
		},
		{
			id: "quiz",
			name: "Flight Quiz",
			description: "Quick travel knowledge questions",
			estimatedTime: 4,
			icon: "help-circle-outline",
		},
		{
			id: "reaction",
			name: "Reaction Timer",
			description: "Ultra short speed challenge",
			estimatedTime: 1,
			icon: "flash-outline",
		},
		{
			id: "runway-landing",
			name: "Runway Landing",
			description: "Time your landing in the runway zone",
			estimatedTime: 2,
			icon: "airplane-outline",
		},
		{
			id: "cabin-call",
			name: "Cabin Call",
			description: "Follow cabin crew commands quickly",
			estimatedTime: 3,
			icon: "megaphone-outline",
		},
		{
			id: "air-traffic-control",
			name: "Air Traffic Control",
			description: "Manage incoming flights and keep the runway queue safe",
			estimatedTime: 12,
			icon: "navigate-outline",
		},
		{
			id: "flight-path",
			name: "Flight Path",
			description: "Draw routes to guide planes to runways — avoid collisions!",
			estimatedTime: 8,
			icon: "map-outline",
		},
		{
			id: "sky-defense",
			name: "Sky Defense",
			description: "Build towers to protect the airport from storms",
			estimatedTime: 10,
			icon: "shield-outline",
		},
		{
			id: "stack-sort",
			name: "Stack Sort",
			description: "Sort numbers into the goal column — a chill puzzle challenge",
			estimatedTime: 5,
			icon: "layers-outline",
		},
		{
			id: "duel-tictactoe",
			name: "Tic Tac Toe Duo",
			description: "Two players on one device",
			estimatedTime: 4,
			icon: "people-outline",
		},
		{
			id: "duel-dice",
			name: "Dice Duel",
			description: "Pass-and-play dice match",
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
				renderItem={({ item }) => {
					const gameProgress = progress[item.id];
					return (
						<Pressable
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
						</Pressable>
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
