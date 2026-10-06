import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import LanguageBadge from "@/components/LanguageBadge";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { hasLanguage, useContentItems } from "@/hooks/useContentItems";
import { useTabletLayout } from "@/hooks/useTabletLayout";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import { captureAnalyticsEvent } from "@/utils/analytics";

type SortMode = "recommended" | "read-short" | "read-long" | "title";

export default function ExploreScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { language, t } = useTranslation();
  const articles = useContentItems();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const { capStyle } = useTabletLayout();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    captureAnalyticsEvent("content_search_changed", {
      has_query: value.trim().length > 0,
      query_length: value.trim().length,
    });
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    captureAnalyticsEvent("content_filter_changed", {
      filter_type: category === t("exploreAll") ? "all" : "category",
    });
  };

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    captureAnalyticsEvent("content_sort_changed", { sort_mode: mode });
  };

  // Articles missing the active language fall back to English (with a badge)
  // instead of disappearing — 9 of 12 UI languages have no localized articles.
  const localizedArticles = useMemo(
    () =>
      articles.map((item) => ({
        ...item,
        categoryText: getLocalizedText(item.category, language),
        isFallback: !hasLanguage(item, language),
        titleText: getLocalizedText(item.title, language),
      })),
    [articles, language]
  );

  const categories = useMemo(
    () => [
      t("exploreAll"),
      ...Array.from(new Set(localizedArticles.map((a) => a.categoryText))),
    ],
    [localizedArticles, t]
  );

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
      <View style={[styles.tabletCap, capStyle]}>
        <View style={styles.topTools}>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.mutedText} name="search" size={16} />
            <TextInput
              onChangeText={handleSearchChange}
              placeholder={t("exploreSearchPlaceholder")}
              placeholderTextColor={theme.mutedText}
              style={[styles.searchInput, { color: theme.text }]}
              value={search}
            />
          </View>
          <Text style={[styles.toolsHint, { color: theme.mutedText }]}>
            {t("exploreToolsHint")}
          </Text>
          <ScrollView
            contentContainerStyle={styles.categoryRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRowScroll}
          >
            {categories.map((category) => (
              <Pressable
                key={category}
                onPress={() => handleCategoryChange(category)}
                style={[
                  styles.categoryChip,
                  category !== categories.at(-1) && styles.chipSpacing,
                  {
                    backgroundColor:
                      activeCategory === category ? theme.tint : theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    activeCategory === category && { color: theme.onTint },
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView
            contentContainerStyle={styles.sortRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRowScroll}
          >
            {[
              {
                key: "recommended",
                labelKey: "exploreSortRecommended" as const,
              },
              {
                key: "read-short",
                labelKey: "exploreSortShortestRead" as const,
              },
              { key: "read-long", labelKey: "exploreSortLongestRead" as const },
              { key: "title", labelKey: "exploreSortTitle" as const },
            ].map((item) => (
              <Pressable
                key={item.key}
                onPress={() => handleSortChange(item.key as SortMode)}
                style={[
                  styles.sortChip,
                  item.key !== "title" && styles.chipSpacing,
                  {
                    backgroundColor:
                      sortMode === item.key ? theme.tint : theme.elevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortMode === item.key && { color: theme.onTint },
                  ]}
                >
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <FlatList
          contentContainerStyle={[
            styles.list,
            filteredArticles.length === 0 && styles.emptyList,
          ]}
          data={filteredArticles}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                color={theme.mutedText}
                name="search-outline"
                size={48}
              />
              <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                {t("exploreNoResults")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => router.push(`/content/${item.id}` as never)}
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.cardBody}
              >
                <View
                  darkColor="transparent"
                  lightColor="transparent"
                  style={styles.cardCategoryRow}
                >
                  <Text style={[styles.category, { color: theme.tint }]}>
                    {item.categoryText}
                  </Text>
                  {item.isFallback ? <LanguageBadge /> : null}
                </View>
                <Text style={styles.title}>{item.titleText}</Text>
                <Text style={[styles.meta, { color: theme.mutedText }]}>
                  {t("minutesRead", { minutes: item.readTime })}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={20}
              />
            </AnimatedPressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 16,
  },
  cardBody: { flex: 1 },
  cardCategoryRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  category: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  categoryRow: {
    alignItems: "center",
    paddingRight: 16,
  },
  chipRowScroll: {
    flexGrow: 0,
    minHeight: 40,
  },
  chipSpacing: {
    marginRight: 8,
  },
  container: { flex: 1 },
  emptyList: { flex: 1 },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  list: { padding: 16 },
  meta: { color: "#999", fontSize: 12, marginTop: 4 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  searchWrap: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sortRow: {
    alignItems: "center",
    paddingRight: 16,
  },
  tabletCap: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  toolsHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -2,
  },
  topTools: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
