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
import Animated, { FadeInDown } from "react-native-reanimated";
import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { gameRegistry } from "@/data/games";
import { useTabletLayout } from "@/hooks/useTabletLayout";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameCategory, GameConfig, GamePlayMode } from "@/types/game";

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
      icon: "swap-horizontal-outline",
      labelKey: "playTogetherPassAndPlay",
    };
  }
  if (playMode === "sharedScreen") {
    return {
      icon: "phone-portrait-outline",
      labelKey: "playTogetherSharedScreen",
    };
  }
  if (playMode === "crossDevice") {
    return {
      icon: "phone-landscape-outline",
      labelKey: "playTogetherCrossDevice",
    };
  }
  return { icon: "ribbon-outline", labelKey: "playTogetherBestOfMode" };
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
    "all"
  );
  const [activeIntent, setActiveIntent] = useState<GameIntent>("all");
  const [search, setSearch] = useState("");
  const { capStyle } = useTabletLayout();

  const hasActiveFilter =
    activeIntent !== "all" ||
    activeCategory !== "all" ||
    search.trim().length > 0;

  const intentFilters: Array<{
    key: GameIntent;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { icon: "grid-outline", key: "all", label: t("categoryFilter_all") },
    {
      icon: "flash-outline",
      key: "quick",
      label: `≤ ${t("minutesShort", { minutes: 3 })}`,
    },
    {
      icon: "people-outline",
      key: "together",
      label: t("categoryFilter_multiplayer"),
    },
    {
      icon: "layers-outline",
      key: "deep",
      label: `7+ ${t("minutesShort", { minutes: 7 }).replace("7 ", "")}`,
    },
  ];

  const games: GameListItem[] = useMemo(
    () =>
      gameRegistry.map((game) => ({
        category: game.category,
        description: t(game.descriptionKey),
        difficulty: game.difficulty,
        estimatedTime: game.estimatedTime,
        icon: game.icon,
        id: game.id,
        isDailyChallenge: Boolean(game.isDailyChallenge),
        isPlayTogether: Boolean(game.isPlayTogether),
        name: t(game.titleKey),
        playMode: game.playMode,
      })),
    [t]
  );

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    const inIntent = games.filter((game) => {
      if (activeIntent === "quick") {
        return game.estimatedTime <= 3;
      }
      if (activeIntent === "together") {
        return game.isPlayTogether;
      }
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
              game.description.toLowerCase().includes(query)
          );

    return [...searchedGames].sort((a, b) => {
      const aProgress = progress[a.id];
      const bProgress = progress[b.id];

      if (aProgress && !bProgress) {
        return -1;
      }
      if (!aProgress && bProgress) {
        return 1;
      }

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
      <View style={[styles.tabletCap, capStyle]}>
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons color={theme.mutedText} name="search" size={16} />
          <TextInput
            onChangeText={setSearch}
            placeholder={t("gamesSearchPlaceholder")}
            placeholderTextColor={theme.mutedText}
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.intentBar}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.intentBarScroll}
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
                  intent.key !== intentFilters.at(-1)?.key &&
                    styles.chipSpacing,
                  {
                    backgroundColor: isActive ? theme.tint : theme.card,
                    borderColor: isActive ? theme.tint : theme.border,
                  },
                ]}
              >
                <Ionicons
                  color={isActive ? theme.onTint : theme.mutedText}
                  name={intent.icon}
                  size={14}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? theme.onTint : theme.text },
                  ]}
                >
                  {intent.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
        <ScrollView
          contentContainerStyle={styles.filterBar}
          horizontal
          showsHorizontalScrollIndicator={false}
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
                  cat !== CATEGORIES.at(-1) && styles.chipSpacing,
                  {
                    backgroundColor: isActive ? theme.tint : theme.card,
                    borderColor: isActive ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? theme.onTint : theme.text },
                  ]}
                >
                  {t(`categoryFilter_${cat}`)}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
        <FlatList
          contentContainerStyle={styles.list}
          data={filteredGames}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View
              darkColor="transparent"
              lightColor="transparent"
              style={[styles.emptyState, { borderColor: theme.border }]}
            >
              <Text style={styles.emptyTitle}>
                {hasActiveFilter
                  ? t("gamesFilteredEmpty")
                  : t("gamesEmptyTitle")}
              </Text>
              {!hasActiveFilter && (
                <Text style={[styles.emptyHint, { color: theme.mutedText }]}>
                  {t("gamesEmptyHint")}
                </Text>
              )}
              {hasActiveFilter ? (
                <Pressable
                  onPress={() => {
                    setSearch("");
                    setActiveCategory("all");
                    setActiveIntent("all");
                  }}
                  style={[
                    styles.clearFiltersBtn,
                    { backgroundColor: theme.tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.clearFiltersBtnText,
                      { color: theme.onTint },
                    ]}
                  >
                    {t("gamesClearFilters")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => {
            const gameProgress = progress[item.id];
            const playModeMeta = getPlayModeMeta(item.playMode);
            return (
              <Animated.View
                entering={FadeInDown.delay(index * 60).springify()}
              >
                <AnimatedPressable
                  onPress={() => router.push(`/game/${item.id}` as never)}
                  style={[
                    styles.card,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <View
                    darkColor="transparent"
                    lightColor="transparent"
                    style={[
                      styles.cardAccent,
                      {
                        backgroundColor: item.isDailyChallenge
                          ? theme.tint
                          : theme.border,
                      },
                    ]}
                  />
                  <Ionicons
                    color={theme.mutedText}
                    name={item.icon as never}
                    size={32}
                  />
                  <View
                    darkColor="transparent"
                    lightColor="transparent"
                    style={styles.cardContent}
                  >
                    <View
                      darkColor="transparent"
                      lightColor="transparent"
                      style={styles.cardTitleRow}
                    >
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      {item.isDailyChallenge ? (
                        <View
                          darkColor="transparent"
                          lightColor="transparent"
                          style={[
                            styles.iconBadge,
                            { backgroundColor: theme.accentSoft },
                          ]}
                        >
                          <Ionicons color={theme.tint} name="flash" size={11} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.cardDesc, { color: theme.mutedText }]}>
                      {item.description}
                    </Text>
                    <View
                      darkColor="transparent"
                      lightColor="transparent"
                      style={styles.metaRow}
                    >
                      <View
                        darkColor="transparent"
                        lightColor="transparent"
                        style={[
                          styles.metaChip,
                          { backgroundColor: theme.surface },
                        ]}
                      >
                        <Ionicons
                          color={theme.mutedText}
                          name="time-outline"
                          size={12}
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
                        darkColor="transparent"
                        lightColor="transparent"
                        style={[
                          styles.metaChip,
                          { backgroundColor: theme.surface },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metaChipText,
                            { color: theme.mutedText },
                          ]}
                        >
                          {t(
                            `difficulty${item.difficulty.charAt(0).toUpperCase()}${item.difficulty.slice(1)}` as never
                          )}
                        </Text>
                      </View>
                      {item.isPlayTogether ? (
                        <View
                          darkColor="transparent"
                          lightColor="transparent"
                          style={[
                            styles.metaChip,
                            { backgroundColor: theme.surface },
                          ]}
                        >
                          <Ionicons
                            color={theme.mutedText}
                            name={playModeMeta.icon}
                            size={12}
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
                          darkColor="transparent"
                          lightColor="transparent"
                          style={[
                            styles.metaChip,
                            { backgroundColor: theme.surface },
                          ]}
                        >
                          <Ionicons
                            color={theme.mutedText}
                            name="trophy-outline"
                            size={12}
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
                      <Text
                        style={[styles.cardMeta, { color: theme.mutedText }]}
                      >
                        {t("bestScorePlayed", {
                          score: gameProgress.highScore,
                          times: gameProgress.timesPlayed,
                        })}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    color={theme.mutedText}
                    name="chevron-forward"
                    size={20}
                  />
                </AnimatedPressable>
              </Animated.View>
            );
          }}
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
    overflow: "hidden",
    padding: 16,
  },
  cardAccent: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  cardContent: { flex: 1, marginLeft: 12 },
  cardDesc: { color: "#666", fontSize: 14, marginTop: 2 },
  cardMeta: { color: "#999", fontSize: 12, marginTop: 4 },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipSpacing: { marginRight: 8 },
  clearFiltersBtn: {
    alignSelf: "flex-start",
    borderRadius: 20,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  clearFiltersBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  container: { flex: 1 },
  emptyHint: {
    fontSize: 13,
    marginTop: 4,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  filterBar: {
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  filterBarScroll: { flexGrow: 0, marginBottom: 4, minHeight: 42 },
  filterChip: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    includeFontPadding: false,
    lineHeight: 18,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  intentBar: {
    alignItems: "center",
    paddingBottom: 6,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  intentBarScroll: { flexGrow: 0, marginBottom: 6, minHeight: 42 },
  intentChip: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  list: { padding: 16 },
  metaChip: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  searchWrap: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tabletCap: { flex: 1 },
});
