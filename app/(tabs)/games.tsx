import { useMemo, useState } from "react";
import {
	StyleSheet,
	FlatList,
	ScrollView,
	TextInput,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { gameRegistry } from "@/data/games";
import { useGameStore } from "@/store/useGameStore";
import type { GameConfig, GameCategory, GameDifficulty } from "@/types/game";

const CATEGORIES: ("all" | GameCategory)[] = [
	"all",
	"brain",
	"reflex",
	"strategy",
	"multiplayer",
];

function getCategoryColor(category: GameCategory, colorScheme: "light" | "dark" | "crazy") {
	if (colorScheme === "crazy") {
		if (category === "brain") return "#c084fc";
		if (category === "reflex") return "#fbbf24";
		if (category === "strategy") return "#4ade80";
		return "#22d3ee";
	}
	const isDark = colorScheme === "dark";
	if (category === "brain") return isDark ? "#8b5cf6" : "#6d28d9";
	if (category === "reflex") return isDark ? "#f59e0b" : "#d97706";
	if (category === "strategy") return isDark ? "#22c55e" : "#15803d";
	return isDark ? "#06b6d4" : "#0891b2";
}

function getDifficultyColor(
	difficulty: GameDifficulty,
	theme: (typeof Colors)[keyof typeof Colors],
): string {
	if (difficulty === "easy") return theme.successBorder;
	if (difficulty === "medium") return theme.warning;
	return "#ef4444";
}

export default function GamesScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const progress = useGameStore((s) => s.progress);
	const [activeCategory, setActiveCategory] = useState<"all" | GameCategory>(
		"all",
	);
	const [search, setSearch] = useState("");

	const games: GameConfig[] = gameRegistry.map((game) => ({
		id: game.id,
		name: t(game.titleKey),
		description: t(game.descriptionKey),
		estimatedTime: game.estimatedTime,
		icon: game.icon,
		category: game.category,
		difficulty: game.difficulty,
	}));

	const filteredGames = useMemo(() => {
		const query = search.trim().toLowerCase();
		const inCategory =
			activeCategory === "all"
				? games
				: games.filter((g) => g.category === activeCategory);

		const searchedGames =
			query.length === 0
				? inCategory
				: inCategory.filter(
						(game) =>
							game.name.toLowerCase().includes(query) ||
							game.description.toLowerCase().includes(query),
					);

		return [...searchedGames].sort((a, b) => {
			const aProgress = progress[a.id];
			const bProgress = progress[b.id];

			if (aProgress && !bProgress) return -1;
			if (!aProgress && bProgress) return 1;

			if (aProgress && bProgress) {
				if (aProgress.lastPlayed !== bProgress.lastPlayed) {
					return bProgress.lastPlayed - aProgress.lastPlayed;
				}
				if (aProgress.highScore !== bProgress.highScore) {
					return bProgress.highScore - aProgress.highScore;
				}
			}

			if (a.estimatedTime !== b.estimatedTime) {
				return a.estimatedTime - b.estimatedTime;
			}

			return a.name.localeCompare(b.name);
		});
	}, [activeCategory, games, progress, search]);

	return (
		<View style={styles.container}>
			<View
				style={[
					styles.searchWrap,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Ionicons name="search" size={16} color={theme.mutedText} />
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder={t("gamesSearchPlaceholder")}
					placeholderTextColor={theme.mutedText}
					style={[styles.searchInput, { color: theme.text }]}
				/>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.filterBar}
				style={styles.filterBarScroll}
			>
				{CATEGORIES.map((cat) => {
					const isActive = cat === activeCategory;
					return (
						<AnimatedPressable
							key={cat}
							onPress={() => setActiveCategory(cat)}
							scaleTo={0.95}
							style={[
								styles.filterChip,
								{
									backgroundColor: isActive ? theme.tint : theme.card,
									borderColor: isActive ? theme.tint : theme.border,
								},
							]}
						>
							<Text
								style={[
									styles.filterChipText,
									{ color: isActive ? "#fff" : theme.text },
								]}
							>
								{t(`categoryFilter_${cat}`)}
							</Text>
						</AnimatedPressable>
					);
				})}
			</ScrollView>
			<FlatList
				data={filteredGames}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				ListEmptyComponent={
					<View
						style={[styles.emptyState, { borderColor: theme.border }]}
						lightColor="transparent"
						darkColor="transparent"
					>
						<Text style={styles.emptyTitle}>{t("gamesEmptyTitle")}</Text>
						<Text style={[styles.emptyHint, { color: theme.mutedText }]}>
							{t("gamesEmptyHint")}
						</Text>
					</View>
				}
				renderItem={({ item, index }) => {
					const gameProgress = progress[item.id];
					const categoryColor = getCategoryColor(item.category, colorScheme);
					return (
						<Animated.View entering={FadeInDown.delay(index * 60).springify()}>
							<AnimatedPressable
								style={[
									styles.card,
									{ backgroundColor: theme.card, borderColor: theme.border },
								]}
								onPress={() => router.push(`/game/${item.id}` as never)}
							>
								<View
									style={[
										styles.cardAccent,
										{ backgroundColor: categoryColor },
									]}
									lightColor="transparent"
									darkColor="transparent"
								/>
								<Ionicons
									name={item.icon as never}
									size={32}
									color={categoryColor}
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
									<View
										style={styles.metaRow}
										lightColor="transparent"
										darkColor="transparent"
									>
										<View
											style={[
												styles.metaChip,
												{ backgroundColor: theme.surface },
											]}
											lightColor="transparent"
											darkColor="transparent"
										>
											<Ionicons
												name="time-outline"
												size={12}
												color={theme.mutedText}
											/>
											<Text
												style={[
													styles.metaChipText,
													{ color: theme.mutedText },
												]}
											>
												~{t("minutesShort", { minutes: item.estimatedTime })}
											</Text>
										</View>
										<View
											style={[
												styles.metaChip,
												{
													backgroundColor: getDifficultyColor(
														item.difficulty,
														theme,
													),
												},
											]}
											lightColor="transparent"
											darkColor="transparent"
										>
											<Text style={[styles.metaChipText, { color: "#fff" }]}>
												{t(
													`difficulty${item.difficulty.charAt(0).toUpperCase()}${item.difficulty.slice(1)}` as never,
												)}
											</Text>
										</View>
										{gameProgress ? (
											<View
												style={[
													styles.metaChip,
													{ backgroundColor: theme.accentSoft },
												]}
												lightColor="transparent"
												darkColor="transparent"
											>
												<Ionicons
													name="trophy-outline"
													size={12}
													color={theme.tint}
												/>
												<Text
													style={[styles.metaChipText, { color: theme.tint }]}
												>
													{gameProgress.highScore}
												</Text>
											</View>
										) : null}
									</View>
									{gameProgress ? (
										<Text style={[styles.cardMeta, { color: theme.mutedText }]}>
											{t("bestScorePlayed", {
												score: gameProgress.highScore,
												times: gameProgress.timesPlayed,
											})}
										</Text>
									) : null}
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
	searchWrap: {
		marginHorizontal: 16,
		marginTop: 10,
		marginBottom: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 10,
		minHeight: 44,
		paddingVertical: 6,
	},
	searchInput: {
		flex: 1,
		fontSize: 14,
		lineHeight: 20,
		height: 22,
		paddingVertical: 0,
		textAlignVertical: "center",
	},
	filterBar: {
		paddingHorizontal: 16,
		paddingTop: 0,
		paddingBottom: 8,
		gap: 8,
	},
	filterChip: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 10,
		paddingVertical: 7,
		minHeight: 34,
		borderRadius: 20,
		borderWidth: 1,
	},
	filterChipText: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
		includeFontPadding: false,
	},
	list: { padding: 16 },
	card: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 12,
		overflow: "hidden",
	},
	cardAccent: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		width: 4,
	},
	cardContent: { flex: 1, marginLeft: 12 },
	cardTitle: { fontSize: 18, fontWeight: "600" },
	cardDesc: { fontSize: 14, color: "#666", marginTop: 2 },
	cardMeta: { fontSize: 12, color: "#999", marginTop: 4 },
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 8,
	},
	metaChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 999,
	},
	metaChipText: {
		fontSize: 11,
		fontWeight: "700",
	},
	emptyState: {
		marginTop: 8,
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: "700",
	},
	emptyHint: {
		fontSize: 13,
		marginTop: 4,
	},
});
