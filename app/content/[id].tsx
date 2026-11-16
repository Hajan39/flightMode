import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import PlusBadge from "@/components/PlusBadge";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius } from "@/constants/Spacing";
import { useArticleImage } from "@/hooks/useArticleImage";
import { hasLanguage, useContentItems } from "@/hooks/useContentItems";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { trackFirstSessionCompleted } from "@/utils/firstSession";
import {
  canReadFullArticle,
  getVisibleParagraphs,
  isPlusContent,
} from "@/utils/plusContent";

// Article bodies use a tiny markdown subset: "**Heading**" lines and inline **bold**.
const HEADING_RE = /^\*\*(.+)\*\*$/;
const BOLD_SPLIT_RE = /(\*\*[^*]+\*\*)/;

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
  const router = useRouter();
  const plus = useSupporterStore((s) => s.plus);
  // Free articles are always fully readable; Plus ones show the intro only.
  const unlocked = article ? canReadFullArticle(article, plus) : false;

  // Only real, fully readable articles count: a deep link to an unknown id
  // (or a Plus preview) must not feed the "articles read" achievements.
  const readableArticleId = unlocked ? article?.id : undefined;
  useEffect(() => {
    if (readableArticleId) {
      markArticleRead(readableArticleId);
    }
  }, [readableArticleId, markArticleRead]);

  useEffect(() => {
    if (!id) {
      return;
    }
    setHasFinishedArticle(false);
  }, [id]);

  // Once per article per mount: a content sync finishing (new `article`
  // object) or a language switch must not report a second open.
  const reportedOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!article || reportedOpenRef.current === article.id) {
      return;
    }
    reportedOpenRef.current = article.id;

    captureAnalyticsEvent("article_open", {
      article_id: article.id,
      category: getLocalizedText(article.category, language),
      is_fallback: isFallback,
      is_locked: !unlocked,
      is_plus: isPlusContent(article),
      language,
      read_time_minutes: article.readTime,
    });
  }, [article, language, isFallback, unlocked]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!(article && unlocked) || hasFinishedArticle) {
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
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.categoryRow}
        >
          <Text style={[styles.category, { color: theme.tint }]}>
            {getLocalizedText(article.category, language)}
          </Text>
          {isPlusContent(article) ? <PlusBadge /> : null}
        </View>
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
        {getVisibleParagraphs(
          article,
          getLocalizedText(article.body, language),
          plus
        ).map((trimmed) => {
          const paragraphKey = `${article.id}-${trimmed.slice(0, 24)}-${trimmed.length}`;
          // Article bodies use a tiny markdown subset: "**Heading**" lines,
          // "- " bullets and inline **bold**.
          const heading = HEADING_RE.exec(trimmed);
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
              {text.split(BOLD_SPLIT_RE).map((part, i) =>
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
        {unlocked ? null : (
          <View
            style={[
              styles.lockedCard,
              { backgroundColor: theme.accentSoft, borderColor: theme.tint },
            ]}
          >
            <Ionicons color={theme.tint} name="book-outline" size={24} />
            <Text style={[styles.lockedTitle, { color: theme.text }]}>
              {t("plusArticleLockedTitle")}
            </Text>
            <Text style={[styles.lockedBody, { color: theme.mutedText }]}>
              {t("plusArticleLockedBody")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                captureAnalyticsEvent("premium_view", { placement: "article" });
                router.push("/plus" as never);
              }}
              style={[styles.lockedButton, { backgroundColor: theme.tint }]}
            >
              <Text style={[styles.lockedButtonText, { color: theme.onTint }]}>
                {t("plusArticleLockedCta")}
              </Text>
            </Pressable>
          </View>
        )}
        {unlocked && article.sources && article.sources.length > 0 ? (
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={[styles.sources, { borderColor: theme.border }]}
          >
            <Text style={[styles.sourcesTitle, { color: theme.mutedText }]}>
              {t("articleSources")}
            </Text>
            {article.sources.map((source) => (
              <Text
                key={source.url}
                style={[styles.sourceItem, { color: theme.mutedText }]}
              >
                {`•  ${source.title}`}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  bold: { fontWeight: "700" },
  bullet: { paddingLeft: 4 },
  category: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  categoryRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  container: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { padding: 20 },
  heading: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginTop: 8 },
  heroImage: { borderRadius: Radius.md, marginBottom: 16 },
  lockedBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  lockedButton: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.md,
    marginTop: 8,
    paddingVertical: 12,
  },
  lockedButtonText: { fontSize: 15, fontWeight: "700" },
  lockedCard: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 6,
    marginTop: 8,
    padding: 20,
  },
  lockedTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  meta: { fontSize: 13, marginBottom: 8, marginTop: 4 },
  notFoundHint: { fontSize: 13, marginTop: 6, textAlign: "center" },
  notFoundTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  readingHint: { fontSize: 12, lineHeight: 16, marginBottom: 14 },
  scroll: { flex: 1 },
  sourceItem: { fontSize: 12, lineHeight: 18 },
  sources: { borderTopWidth: 1, gap: 2, marginTop: 16, paddingTop: 12 },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  title: { fontSize: 22, fontWeight: "700", marginTop: 8 },
});
