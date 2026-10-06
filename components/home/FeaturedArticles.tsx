import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import LanguageBadge from "@/components/LanguageBadge";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";

export interface FeaturedArticle {
  /** English category, used for the analytics payload. */
  categoryEn: string;
  categoryText: string;
  id: string;
  /** Rendered in English because the active language has no translation. */
  isFallback: boolean;
  readTime: number;
  titleText: string;
}

interface Props {
  articles: FeaturedArticle[];
  onOpenArticle: (articleId: string, categoryEn: string) => void;
}

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
        <Ionicons
          color={theme.mutedText}
          name="document-text-outline"
          size={28}
        />
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
          onPress={() => onOpenArticle(article.id, article.categoryEn)}
          style={[
            homeStyles.featuredCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={homeStyles.featuredBody}
          >
            <View
              darkColor="transparent"
              lightColor="transparent"
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
          <Ionicons color={theme.mutedText} name="chevron-forward" size={20} />
        </AnimatedPressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  category: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  categoryRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  emptyCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 10,
    padding: 20,
  },
  emptyHint: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  emptyTitle: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  meta: { fontSize: 12, marginTop: 4 },
});
