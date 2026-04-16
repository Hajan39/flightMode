import { useState } from "react";
import { StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameConfig, GameCategory } from "@/types/game";

const CATEGORY_ICONS: Record<"all" | GameCategory, string> = {
	all: "apps-outline",
	brain: "bulb-outline",
	reflex: "flash-outline",
	strategy: "map-outline",
	multiplayer: "people-outline",
};

const CATEGORIES: ("all" | GameCategory)[] = [
	"all",
	"brain",
	"reflex",
	"strategy",
	"multiplayer",
];

export default function GamesScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const progress = useGameStore((s) => s.progress);
	const [activeCategory, setActiveCategory] = useState<"all" | GameCategory>(
		"all",
	);

	const games: GameConfig[] = [
		{
			id: "memory",
			name: t("gameMemoryName"),
			description: t("gameMemoryListDescription"),
			estimatedTime: 10,
			icon: "grid-outline",
			category: "brain",
		},
		{
			id: "tap-rush",
			name: t("gameTapRushName"),
			description: t("gameTapRushDescription"),
			estimatedTime: 2,
			icon: "finger-print-outline",
			category: "reflex",
		},
		{
			id: "sky-math",
			name: t("gameSkyMathName"),
			description: t("gameSkyMathDescription"),
			estimatedTime: 3,
			icon: "calculator-outline",
			category: "brain",
		},
		{
			id: "quiz",
			name: t("gameQuizName"),
			description: t("gameQuizDescription"),
			estimatedTime: 4,
			icon: "help-circle-outline",
			category: "brain",
		},
		{
			id: "reaction",
			name: t("gameReactionName"),
			description: t("gameReactionDescription"),
			estimatedTime: 1,
			icon: "flash-outline",
			category: "reflex",
		},
		{
			id: "runway-landing",
			name: t("gameRunwayLandingName"),
			description: t("gameRunwayLandingDescription"),
			estimatedTime: 2,
			icon: "airplane-outline",
			category: "reflex",
		},
		{
			id: "cabin-call",
			name: t("gameCabinCallName"),
			description: t("gameCabinCallDescription"),
			estimatedTime: 3,
			icon: "megaphone-outline",
			category: "reflex",
		},
		{
			id: "air-traffic-control",
			name: t("gameAirTrafficControlName"),
			description: t("gameAirTrafficControlDescription"),
			estimatedTime: 12,
			icon: "navigate-outline",
			category: "strategy",
		},
		{
			id: "flight-path",
			name: t("gameFlightPathName"),
			description: t("gameFlightPathDescription"),
			estimatedTime: 8,
			icon: "map-outline",
			category: "strategy",
		},
		{
			id: "sky-defense",
			name: t("gameSkyDefenseName"),
			description: t("gameSkyDefenseDescription"),
			estimatedTime: 10,
			icon: "shield-outline",
			category: "strategy",
		},
		{
			id: "stack-sort",
			name: t("gameStackSortName"),
			description: t("gameStackSortDescription"),
			estimatedTime: 5,
			icon: "layers-outline",
			category: "brain",
		},
		{
			id: "duel-tictactoe",
			name: t("gameDuelTicTacToeName"),
			description: t("gameDuelTicTacToeDescription"),
			estimatedTime: 4,
			icon: "people-outline",
			category: "multiplayer",
		},
		{
			id: "duel-dice",
			name: t("gameDuelDiceName"),
			description: t("gameDuelDiceDescription"),
			estimatedTime: 3,
			icon: "dice-outline",
			category: "multiplayer",
		},
		{
			id: "duel-connect4",
			name: t("gameDuelConnect4Name"),
			description: t("gameDuelConnect4Description"),
			estimatedTime: 5,
			icon: "apps-outline",
			category: "multiplayer",
		},
		{
			id: "duel-emoji-find",
			name: t("gameDuelEmojiFindName"),
			description: t("gameDuelEmojiFindDescription"),
			estimatedTime: 4,
			icon: "search-outline",
			category: "multiplayer",
		},
		{
			id: "duel-hangman",
			name: t("gameDuelHangmanName"),
			description: t("gameDuelHangmanDescription"),
			estimatedTime: 5,
			icon: "text-outline",
			category: "multiplayer",
		},
		{
			id: "cross-air-radar",
			name: t("gameCrossAirRadarName"),
			description: t("gameCrossAirRadarDescription"),
			estimatedTime: 10,
			icon: "radio-outline",
			category: "multiplayer",
		},
		{
			id: "cross-code-breaker",
			name: t("gameCrossCodeBreakerName"),
			description: t("gameCrossCodeBreakerDescription"),
			estimatedTime: 8,
			icon: "lock-open-outline",
			category: "multiplayer",
		},
		{
			id: "cross-liars-dice",
			name: t("gameCrossLiarsDiceName"),
			description: t("gameCrossLiarsDiceDescription"),
			estimatedTime: 6,
			icon: "skull-outline",
			category: "multiplayer",
		},
	];

	const filteredGames =
		activeCategory === "all"
			? games
			: games.filter((g) => g.category === activeCategory);

	return (
		<View style={styles.container}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.filterBar}
				style={styles.filterBarScroll}
			>
				{CATEGORIES.map((cat) => {
					const isActive = cat === activeCategory;
					return (
						<Pressable
							key={cat}
							onPress={() => setActiveCategory(cat)}
							style={[
								styles.filterChip,
								{
									backgroundColor: isActive ? theme.tint : theme.card,
									borderColor: isActive ? theme.tint : theme.border,
								},
							]}
						>
							<Ionicons
								name={CATEGORY_ICONS[cat] as never}
								size={16}
								color={isActive ? "#fff" : theme.mutedText}
								style={{ marginRight: 4 }}
							/>
							<Text
								style={[
									styles.filterChipText,
									{ color: isActive ? "#fff" : theme.text },
								]}
							>
								{t(`categoryFilter_${cat}`)}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
			<FlatList
				data={filteredGames}
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
	filterBarScroll: { flexGrow: 0 },
	filterBar: {
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 8,
		gap: 8,
	},
	filterChip: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 20,
		borderWidth: 1,
	},
	filterChipText: { fontSize: 13, fontWeight: "600" },
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
