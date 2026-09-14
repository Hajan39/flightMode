import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import LanguageBadge from "@/components/LanguageBadge";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";

export type FeaturedArticle = {
	id: string;
	titleText: string;
	categoryText: string;
	/** English category, used for the analytics payload. */
	categoryEn: string;
	readTime: number;
	/** Rendered in English because the active language has no translation. */
	isFallback: boolean;
};

type Props = {
	articles: FeaturedArticle[];
	onOpenArticle: (articleId: string, categoryEn: string) => void;
};

/** Two recommended articles, or an empty-state card. */
export default function FeaturedArticles({ articles, onOpenArticle }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	if (articles.length === 0) {
		return (
			<View
				style={[
					styles.emptyCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Ionicons name="document-text-outline" size={28} color={theme.mutedText} />
				<Text style={[styles.emptyTitle, { color: theme.mutedText }]}>
					{t("homeArticlesEmpty")}
				</Text>
				<Text style={[styles.emptyHint, { color: theme.mutedText }]}>
					{t("homeArticlesEmptyHint")}
				</Text>
			</View>
		);
	}

	return (
		<>
			{articles.map((article) => (
				<AnimatedPressable
					key={article.id}
					style={[
						homeStyles.featuredCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => onOpenArticle(article.id, article.categoryEn)}
				>
					<View
						lightColor="transparent"
						darkColor="transparent"
						style={homeStyles.featuredBody}
					>
						<View
							lightColor="transparent"
							darkColor="transparent"
							style={styles.categoryRow}
						>
							<Text style={[styles.category, { color: theme.tint }]}>
								{article.categoryText}
							</Text>
							{article.isFallback ? <LanguageBadge /> : null}
						</View>
						<Text style={homeStyles.featuredTitle}>{article.titleText}</Text>
						<Text style={[styles.meta, { color: theme.mutedText }]}>
							~{t("minutesShort", { minutes: article.readTime })}
						</Text>
					</View>
					<Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
				</AnimatedPressable>
			))}
		</>
	);
}

const styles = StyleSheet.create({
	categoryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
	category: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
	meta: { fontSize: 12, marginTop: 4 },
	emptyCard: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 20,
		alignItems: "center",
		gap: 8,
		marginTop: 10,
	},
	emptyTitle: { fontSize: 14, fontWeight: "600", textAlign: "center" },
	emptyHint: { fontSize: 12, textAlign: "center", lineHeight: 17 },
});
