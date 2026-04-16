import { useState } from "react";
import {
	StyleSheet,
	FlatList,
	Pressable,
	TextInput,
	ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import content from "@/data/content.json";
import type { ContentItem } from "@/types/content";

const articles = content as ContentItem[];
type SortMode = "recommended" | "read-short" | "read-long" | "title";

export default function ExploreScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { language, t } = useTranslation();
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState("");
	const [sortMode, setSortMode] = useState<SortMode>("recommended");

	const localizedArticles = articles.map((item) => ({
		...item,
		titleText: getLocalizedText(item.title, language),
		categoryText: getLocalizedText(item.category, language),
	}));

	const categories = [
		t("exploreAll"),
		...Array.from(new Set(localizedArticles.map((a) => a.categoryText))),
	];

	const filteredArticles = (() => {
		const q = search.trim().toLowerCase();
		const allLabel = t("exploreAll");
		const filtered = localizedArticles.filter((item) => {
			const categoryMatch =
				activeCategory === "" ||
				activeCategory === allLabel ||
				item.categoryText === activeCategory;
			const searchMatch =
				q.length === 0 ||
				item.titleText.toLowerCase().includes(q) ||
				item.categoryText.toLowerCase().includes(q);
			return categoryMatch && searchMatch;
		});

		if (sortMode === "read-short") {
			return filtered.sort((a, b) => a.readTime - b.readTime);
		}

		if (sortMode === "read-long") {
			return filtered.sort((a, b) => b.readTime - a.readTime);
		}

		if (sortMode === "title") {
			return filtered.sort((a, b) => a.titleText.localeCompare(b.titleText));
		}

		return filtered;
	})();

	return (
		<View style={styles.container}>
			<View style={styles.topTools}>
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
						placeholder={t("exploreSearchPlaceholder")}
						placeholderTextColor={theme.mutedText}
						style={[styles.searchInput, { color: theme.text }]}
					/>
				</View>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.categoryRow}
				>
					{categories.map((category) => (
						<Pressable
							key={category}
							style={[
								styles.categoryChip,
								{
									borderColor: theme.border,
									backgroundColor:
										activeCategory === category ? theme.tint : theme.card,
								},
							]}
							onPress={() => setActiveCategory(category)}
						>
							<Text
								style={[
									styles.categoryChipText,
									activeCategory === category && styles.categoryChipTextActive,
								]}
							>
								{category}
							</Text>
						</Pressable>
					))}
				</ScrollView>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.sortRow}
				>
					{[
						{ key: "recommended", labelKey: "exploreSortRecommended" as const },
						{ key: "read-short", labelKey: "exploreSortShortestRead" as const },
						{ key: "read-long", labelKey: "exploreSortLongestRead" as const },
						{ key: "title", labelKey: "exploreSortTitle" as const },
					].map((item) => (
						<Pressable
							key={item.key}
							style={[
								styles.sortChip,
								{
									borderColor: theme.border,
									backgroundColor:
										sortMode === item.key ? theme.tint : theme.elevated,
								},
							]}
							onPress={() => setSortMode(item.key as SortMode)}
						>
							<Text
								style={[
									styles.sortChipText,
									sortMode === item.key && styles.categoryChipTextActive,
								]}
							>
								{t(item.labelKey)}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			</View>
			<FlatList
				data={filteredArticles}
				keyExtractor={(item) => item.id}
				contentContainerStyle={[
					styles.list,
					filteredArticles.length === 0 && styles.emptyList,
				]}
				ListEmptyComponent={
					<View style={styles.emptyState}>
						<Ionicons name="search-outline" size={48} color={theme.mutedText} />
						<Text style={[styles.emptyText, { color: theme.mutedText }]}>
							{t("exploreNoResults")}
						</Text>
					</View>
				}
				renderItem={({ item }) => (
					<AnimatedPressable
						style={[
							styles.card,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => router.push(`/content/${item.id}` as never)}
					>
						<View
							style={styles.cardBody}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Text style={[styles.category, { color: theme.tint }]}>
								{item.categoryText}
							</Text>
							<Text style={styles.title}>{item.titleText}</Text>
							<Text style={[styles.meta, { color: theme.mutedText }]}>
								{t("minutesRead", { minutes: item.readTime })}
							</Text>
						</View>
						<Ionicons
							name="chevron-forward"
							size={20}
							color={theme.mutedText}
						/>
					</AnimatedPressable>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	topTools: {
		paddingHorizontal: 16,
		paddingTop: 16,
		gap: 12,
	},
	searchWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 14,
		paddingVertical: 2,
	},
	categoryRow: {
		gap: 8,
		paddingRight: 16,
	},
	sortRow: {
		gap: 8,
		paddingRight: 16,
	},
	categoryChip: {
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	sortChip: {
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	categoryChipText: {
		fontSize: 12,
		fontWeight: "700",
	},
	sortChipText: {
		fontSize: 12,
		fontWeight: "700",
	},
	categoryChipTextActive: {
		color: "#fff",
	},
	list: { padding: 16 },
	emptyList: { flex: 1 },
	emptyState: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		paddingTop: 60,
	},
	emptyText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
	card: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 12,
	},
	cardBody: { flex: 1 },
	category: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
	title: { fontSize: 16, fontWeight: "600", marginTop: 4 },
	meta: { fontSize: 12, color: "#999", marginTop: 4 },
});
