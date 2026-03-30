import { useMemo, useState } from "react";
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
	const [activeCategory, setActiveCategory] = useState("All");
	const [sortMode, setSortMode] = useState<SortMode>("recommended");

	const localizedArticles = useMemo(
		() =>
			articles.map((item) => ({
				...item,
				titleText: getLocalizedText(item.title, language),
				categoryText: getLocalizedText(item.category, language),
			})),
		[language],
	);

	const categories = useMemo(
		() => [
			"All",
			...Array.from(new Set(localizedArticles.map((a) => a.categoryText))),
		],
		[localizedArticles],
	);

	const filteredArticles = useMemo(() => {
		const q = search.trim().toLowerCase();
		const filtered = localizedArticles.filter((item) => {
			const categoryMatch =
				activeCategory === "All" || item.categoryText === activeCategory;
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
	}, [activeCategory, localizedArticles, search, sortMode]);

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
						placeholder="Search articles"
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
						{ key: "recommended", label: "Recommended" },
						{ key: "read-short", label: "Shortest read" },
						{ key: "read-long", label: "Longest read" },
						{ key: "title", label: "Title" },
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
								{item.label}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			</View>
			<FlatList
				data={filteredArticles}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
					<Pressable
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
					</Pressable>
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
