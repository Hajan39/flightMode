import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius } from "@/constants/Spacing";
import { useArticleImage } from "@/hooks/useArticleImage";
import { hasLanguage, useContentItems } from "@/hooks/useContentItems";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { trackFirstSessionCompleted } from "@/utils/firstSession";

export default function ContentDetailScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { language, t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const articles = useContentItems();
  const article = articles.find((a) => a.id === id);
  const markArticleRead = useAchievementStore((s) => s.markArticleRead);
  const [hasFinishedArticle, setHasFinishedArticle] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroImage = useArticleImage(article?.image);
  const isFallback = article ? !hasLanguage(article, language) : false;

  useEffect(() => {
    if (id) {
      markArticleRead(id);
    }
  }, [id, markArticleRead]);

  useEffect(() => {
    if (!id) {
      return;
    }
    setHasFinishedArticle(false);
  }, [id]);

  useEffect(() => {
    if (!article) {
      return;
    }

    captureAnalyticsEvent("article_open", {
      article_id: article.id,
      category: getLocalizedText(article.category, language),
      is_fallback: isFallback,
      language,
      read_time_minutes: article.readTime,
    });
  }, [article, language, isFallback]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!article || hasFinishedArticle) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;

    if (!isNearBottom) {
      return;
    }

    setHasFinishedArticle(true);
    captureAnalyticsEvent("article_finish", {
      article_id: article.id,
      category: getLocalizedText(article.category, language),
      is_fallback: isFallback,
      language,
      read_time_minutes: article.readTime,
    });
    trackFirstSessionCompleted("content");
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 20 + insets.bottom },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={250}
        style={[styles.scroll, { backgroundColor: theme.background }]}
      >
        {heroImage && (
          <Image
            resizeMode="cover"
            source={heroImage}
            style={[
              styles.heroImage,
              { height: Math.round((width - 40) * 0.5625), width: width - 40 },
            ]}
          />
        )}
        <Text style={[styles.category, { color: theme.tint }]}>
          {getLocalizedText(article.category, language)}
        </Text>
        <Text style={styles.title}>
          {getLocalizedText(article.title, language)}
        </Text>
        <Text style={[styles.meta, { color: theme.mutedText }]}>
          {t("minutesRead", { minutes: article.readTime })}
          {isFallback ? ` · ${t("contentFallbackNotice")}` : ""}
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
            // Article bodies use a tiny markdown subset: "**Heading**" lines,
            // "- " bullets and inline **bold**.
            const heading = /^\*\*(.+)\*\*$/.exec(trimmed);
            if (heading) {
              return (
                <Text
                  key={paragraphKey}
                  style={[styles.heading, { color: theme.text }]}
                >
                  {heading[1]}
                </Text>
              );
            }
            const isBullet = trimmed.startsWith("- ");
            const text = isBullet ? trimmed.slice(2) : trimmed;

            return (
              <Text
                key={paragraphKey}
                style={[
                  styles.body,
                  isBullet && styles.bullet,
                  { color: theme.text },
                ]}
              >
                {isBullet ? "•  " : null}
                {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                  part.startsWith("**") && part.endsWith("**") ? (
                    <Text key={i} style={styles.bold}>
                      {part.slice(2, -2)}
                    </Text>
                  ) : (
                    part
                  )
                )}
              </Text>
            );
          })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  bold: { fontWeight: "700" },
  bullet: { paddingLeft: 4 },
  category: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  container: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { padding: 20 },
  heading: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginTop: 8 },
  heroImage: { borderRadius: Radius.md, marginBottom: 16 },
  meta: { fontSize: 13, marginBottom: 8, marginTop: 4 },
  notFoundHint: { fontSize: 13, marginTop: 6, textAlign: "center" },
  notFoundTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  readingHint: { fontSize: 12, lineHeight: 16, marginBottom: 14 },
  scroll: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", marginTop: 8 },
});
