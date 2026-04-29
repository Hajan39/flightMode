import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { gameRegistry } from "@/data/games";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameCategory, GameConfig, GamePlayMode } from "@/types/game";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

type GameListItem = GameConfig & {
	isDailyChallenge: boolean;
	isPlayTogether: boolean;
};

type GameIntent = "all" | "quick" | "together" | "deep";

function getPlayModeMeta(playMode?: GamePlayMode): {
	labelKey:
		| "playTogetherBestOfMode"
		| "playTogetherPassAndPlay"
		| "playTogetherSharedScreen"
		| "playTogetherCrossDevice";
	icon: keyof typeof Ionicons.glyphMap;
} {
	if (playMode === "passAndPlay") {
		return {
			labelKey: "playTogetherPassAndPlay",
			icon: "swap-horizontal-outline",
		};
	}
	if (playMode === "sharedScreen") {
		return {
			labelKey: "playTogetherSharedScreen",
			icon: "phone-portrait-outline",
		};
	}
	if (playMode === "crossDevice") {
		return {
			labelKey: "playTogetherCrossDevice",
			icon: "phone-landscape-outline",
		};
	}
	return { labelKey: "playTogetherBestOfMode", icon: "ribbon-outline" };
}

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
	const [activeIntent, setActiveIntent] = useState<GameIntent>("all");
	const [search, setSearch] = useState("");

	const intentFilters: Array<{
		key: GameIntent;
		label: string;
		icon: keyof typeof Ionicons.glyphMap;
	}> = [
		{ key: "all", label: t("categoryFilter_all"), icon: "grid-outline" },
		{
			key: "quick",
			label: `≤ ${t("minutesShort", { minutes: 3 })}`,
			icon: "flash-outline",
		},
		{
			key: "together",
			label: t("categoryFilter_multiplayer"),
			icon: "people-outline",
		},
		{
			key: "deep",
			label: `7+ ${t("minutesShort", { minutes: 7 }).replace("7 ", "")}`,
			icon: "layers-outline",
		},
	];

	const games: GameListItem[] = gameRegistry.map((game) => ({
		id: game.id,
		name: t(game.titleKey),
		description: t(game.descriptionKey),
		estimatedTime: game.estimatedTime,
		icon: game.icon,
		category: game.category,
		difficulty: game.difficulty,
		playMode: game.playMode,
		isDailyChallenge: Boolean(game.isDailyChallenge),
		isPlayTogether: Boolean(game.isPlayTogether),
	}));

	const filteredGames = useMemo(() => {
		const query = search.trim().toLowerCase();
		const inIntent = games.filter((game) => {
			if (activeIntent === "quick") return game.estimatedTime <= 3;
			if (activeIntent === "together") return game.isPlayTogether;
			if (activeIntent === "deep") {
				return game.estimatedTime >= 7 || game.difficulty === "hard";
			}
			return true;
		});
		const inCategory =
			activeCategory === "all"
				? inIntent
				: inIntent.filter((g) => g.category === activeCategory);

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

			if (a.isDailyChallenge !== b.isDailyChallenge) {
				return Number(b.isDailyChallenge) - Number(a.isDailyChallenge);
			}

			if (a.isPlayTogether !== b.isPlayTogether) {
				return Number(b.isPlayTogether) - Number(a.isPlayTogether);
			}

			if (a.estimatedTime !== b.estimatedTime) {
				return a.estimatedTime - b.estimatedTime;
			}

			return a.name.localeCompare(b.name);
		});
	}, [activeCategory, activeIntent, games, progress, search]);

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
				contentContainerStyle={styles.intentBar}
				style={styles.filterBarScroll}
			>
				{intentFilters.map((intent) => {
					const isActive = intent.key === activeIntent;
					return (
						<AnimatedPressable
							key={intent.key}
							onPress={() => setActiveIntent(intent.key)}
							scaleTo={0.95}
							style={[
								styles.intentChip,
								{
									backgroundColor: isActive ? theme.tint : theme.card,
									borderColor: isActive ? theme.tint : theme.border,
								},
							]}
						>
							<Ionicons
								name={intent.icon}
								size={14}
								color={isActive ? "#fff" : theme.mutedText}
							/>
							<Text
								style={[
									styles.filterChipText,
									{ color: isActive ? "#fff" : theme.text },
								]}
							>
								{intent.label}
							</Text>
						</AnimatedPressable>
					);
				})}
			</ScrollView>
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
					const playModeMeta = getPlayModeMeta(item.playMode);
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
										{
											backgroundColor: item.isDailyChallenge
												? theme.tint
												: theme.border,
										},
									]}
									lightColor="transparent"
									darkColor="transparent"
								/>
								<Ionicons
									name={item.icon as never}
									size={32}
									color={theme.mutedText}
								/>
								<View
									style={styles.cardContent}
									lightColor="transparent"
									darkColor="transparent"
								>
									<View
										style={styles.cardTitleRow}
										lightColor="transparent"
										darkColor="transparent"
									>
										<Text style={styles.cardTitle}>{item.name}</Text>
										{item.isDailyChallenge ? (
											<View
												style={[
													styles.iconBadge,
													{ backgroundColor: theme.accentSoft },
												]}
												lightColor="transparent"
												darkColor="transparent"
											>
												<Ionicons name="flash" size={11} color={theme.tint} />
											</View>
										) : null}
									</View>
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
												{ backgroundColor: theme.surface },
											]}
											lightColor="transparent"
											darkColor="transparent"
										>
											<Text
												style={[
													styles.metaChipText,
													{ color: theme.mutedText },
												]}
											>
												{t(
													`difficulty${item.difficulty.charAt(0).toUpperCase()}${item.difficulty.slice(1)}` as never,
												)}
											</Text>
										</View>
										{item.isPlayTogether ? (
											<View
												style={[
													styles.metaChip,
													{ backgroundColor: theme.surface },
												]}
												lightColor="transparent"
												darkColor="transparent"
											>
												<Ionicons
													name={playModeMeta.icon}
													size={12}
													color={theme.mutedText}
												/>
												<Text
													style={[
														styles.metaChipText,
														{ color: theme.mutedText },
													]}
												>
													{t(playModeMeta.labelKey)}
												</Text>
											</View>
										) : null}
										{gameProgress ? (
											<View
												style={[
													styles.metaChip,
													{ backgroundColor: theme.surface },
												]}
												lightColor="transparent"
												darkColor="transparent"
											>
												<Ionicons
													name="trophy-outline"
													size={12}
													color={theme.mutedText}
												/>
												<Text
													style={[
														styles.metaChipText,
														{ color: theme.mutedText },
													]}
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
	intentBar: {
		paddingHorizontal: 16,
		paddingTop: 0,
		paddingBottom: 6,
		gap: 8,
	},
	intentChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 11,
		paddingVertical: 7,
		minHeight: 34,
		borderRadius: 20,
		borderWidth: 1,
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
	cardTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexWrap: "wrap",
	},
	cardTitle: { fontSize: 18, fontWeight: "600" },
	iconBadge: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
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
