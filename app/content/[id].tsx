import { useEffect } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import { StyleSheet, ScrollView } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import content from "@/data/content.json";
import type { ContentItem } from "@/types/content";
import { useAchievementStore } from "@/store/useAchievementStore";

const articles = content as ContentItem[];

export default function ContentDetailScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { language, t } = useTranslation();
	const { id } = useLocalSearchParams<{ id: string }>();
	const article = articles.find((a) => a.id === id);
	const markArticleRead = useAchievementStore((s) => s.markArticleRead);

	useEffect(() => {
		if (id) markArticleRead(id);
	}, [id, markArticleRead]);

	if (!article) {
		return (
			<View style={styles.container}>
				<Text style={styles.notFoundTitle}>{t("articleNotFound")}</Text>
				<Text style={[styles.notFoundHint, { color: theme.mutedText }]}>
					{t("articleNotFoundHint")}
				</Text>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{ title: getLocalizedText(article.title, language) }}
			/>
			<ScrollView
				style={[styles.scroll, { backgroundColor: theme.background }]}
				contentContainerStyle={styles.content}
			>
				<Text style={[styles.category, { color: theme.tint }]}>
					{getLocalizedText(article.category, language)}
				</Text>
				<Text style={styles.title}>
					{getLocalizedText(article.title, language)}
				</Text>
				<Text style={[styles.meta, { color: theme.mutedText }]}>
					{t("minutesRead", { minutes: article.readTime })}
				</Text>
				<Text style={[styles.readingHint, { color: theme.mutedText }]}>
					{t("exploreReadingHint")}
				</Text>
				{getLocalizedText(article.body, language)
					.split("\n")
					.filter((p) => p.trim().length > 0)
					.map((paragraph) => {
						const trimmed = paragraph.trim();
						const paragraphKey = `${article.id}-${trimmed.slice(0, 24)}-${trimmed.length}`;

						return (
							<Text key={paragraphKey} style={[styles.body, { color: theme.text }]}>
								{trimmed}
							</Text>
						);
					})}
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", justifyContent: "center" },
	notFoundTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
	notFoundHint: { fontSize: 13, textAlign: "center", marginTop: 6 },
	scroll: { flex: 1 },
	content: { padding: 20 },
	category: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
	title: { fontSize: 22, fontWeight: "700", marginTop: 8 },
	meta: { fontSize: 13, marginTop: 4, marginBottom: 8 },
	readingHint: { fontSize: 12, lineHeight: 16, marginBottom: 14 },
	body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
});
