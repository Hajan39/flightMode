import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useContentItems } from "@/hooks/useContentItems";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function ContentDetailScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { language, t } = useTranslation();
	const { id } = useLocalSearchParams<{ id: string }>();
	const articles = useContentItems();
	const article = articles.find((a) => a.id === id);
	const markArticleRead = useAchievementStore((s) => s.markArticleRead);
	const [hasFinishedArticle, setHasFinishedArticle] = useState(false);

	useEffect(() => {
		if (id) markArticleRead(id);
	}, [id, markArticleRead]);

	useEffect(() => {
		setHasFinishedArticle(false);
	}, [id]);

	useEffect(() => {
		if (!article) return;

		captureAnalyticsEvent("article_open", {
			article_id: article.id,
			category: getLocalizedText(article.category, language),
			read_time_minutes: article.readTime,
			language,
		});
	}, [article, language]);

	const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		if (!article || hasFinishedArticle) return;

		const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
		const isNearBottom =
			contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;

		if (!isNearBottom) return;

		setHasFinishedArticle(true);
		captureAnalyticsEvent("article_finish", {
			article_id: article.id,
			category: getLocalizedText(article.category, language),
			read_time_minutes: article.readTime,
			language,
		});
	};

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
				onScroll={handleScroll}
				scrollEventThrottle={250}
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
