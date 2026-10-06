import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { type AchievementDef, achievements } from "@/data/achievements";
import { getGameById } from "@/data/games";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const stats = useProfileStats();
  const unlockedIds = useAchievementStore((s) => s.unlockedIds);
  const clearNewUnlocked = useAchievementStore((s) => s.clearNewUnlocked);

  useEffect(() => {
    clearNewUnlocked();
  }, [clearNewUnlocked]);

  useEffect(() => {
    captureAnalyticsEvent("profile_open", {
      achievements_unlocked: stats.achievementsUnlocked,
      articles_read: stats.articlesRead,
      games_played: stats.totalGamesPlayed,
    });
  }, [stats.totalGamesPlayed, stats.articlesRead, stats.achievementsUnlocked]);

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
      >
        {/* ── Stats Cards ── */}
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t("profileStats")}
          </Text>
          <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
            {t("profileStatsHint")}
          </Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="game-controller-outline"
              label={t("profileGamesPlayed")}
              theme={theme}
              value={stats.totalGamesPlayed}
            />
            <StatCard
              icon="time-outline"
              label={t("profileMinutes")}
              theme={theme}
              value={stats.estimatedMinutes}
            />
            <StatCard
              icon="grid-outline"
              label={t("profileGamesTried")}
              theme={theme}
              value={stats.uniqueGamesPlayed}
            />
            <StatCard
              icon="airplane-outline"
              label={t("profileFlights")}
              theme={theme}
              value={stats.totalFlights}
            />
            <StatCard
              icon="book-outline"
              label={t("profileArticles")}
              theme={theme}
              value={stats.articlesRead}
            />
            <StatCard
              icon="leaf-outline"
              label={t("profileRelaxSessions")}
              theme={theme}
              value={stats.totalRelaxSessions}
            />
          </View>
        </Animated.View>

        {/* ── Achievements Grid ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.sectionHeader}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("profileAchievements")}
            </Text>
            <Text style={[styles.counter, { color: theme.mutedText }]}>
              {stats.achievementsUnlocked}/{stats.achievementsTotal}
            </Text>
          </View>
          <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
            {t("profileAchievementsHint")}
          </Text>
          <View style={styles.achievementGrid}>
            {achievements.map((a, i) => (
              <AchievementBadge
                achievement={a}
                index={i}
                key={a.id}
                t={t}
                theme={theme}
                unlocked={unlockedIds.includes(a.id)}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── High Scores ── */}
        {stats.topScores.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("profileHighScores")}
            </Text>
            <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
              {t("profileHighScoresHint")}
            </Text>
            {stats.topScores.map((entry, i) => (
              <View
                key={entry.gameId}
                style={[
                  styles.scoreRow,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.rank, { color: theme.tint }]}>
                  #{i + 1}
                </Text>
                <Text style={[styles.scoreName, { color: theme.text }]}>
                  {t(getGameById(entry.gameId)?.titleKey ?? "stackGame")}
                </Text>
                <Text style={[styles.scoreValue, { color: theme.tint }]}>
                  {entry.highScore}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── Favorite Game ── */}
        {stats.favoriteGameId && (
          <View
            style={[
              styles.favoriteCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.tint} name="heart" size={20} />
            <Text style={[styles.favoriteText, { color: theme.text }]}>
              {t("profileFavorite")}:{" "}
              {t(getGameById(stats.favoriteGameId)?.titleKey ?? "stackGame")}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  value,
  label,
  theme,
}: {
  icon: string;
  value: number;
  label: string;
  theme: (typeof Colors)["light"];
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Ionicons color={theme.tint} name={icon as never} size={24} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.mutedText }]}>
        {label}
      </Text>
    </View>
  );
}

function AchievementBadge({
  achievement,
  unlocked,
  theme,
  t,
  index: _index,
}: {
  achievement: AchievementDef;
  unlocked: boolean;
  theme: (typeof Colors)["light"];
  t: (key: TranslationKey) => string;
  index: number;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: unlocked ? theme.card : theme.background,
          borderColor: unlocked ? theme.tint : theme.border,
          opacity: unlocked ? 1 : 0.4,
        },
      ]}
    >
      <Ionicons
        color={unlocked ? theme.tint : theme.mutedText}
        name={achievement.icon as never}
        size={26}
      />
      <Text
        numberOfLines={2}
        style={[
          styles.badgeTitle,
          { color: unlocked ? theme.text : theme.mutedText },
        ]}
      >
        {t(achievement.titleKey)}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.badgeDesc, { color: theme.mutedText }]}
      >
        {t(achievement.descriptionKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badge: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
    width: "46%",
  },
  badgeDesc: { fontSize: 11, lineHeight: 15, textAlign: "center" },
  badgeTitle: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  counter: { fontSize: 14, fontWeight: "600" },
  favoriteCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    padding: 14,
  },
  favoriteText: { fontSize: 14, fontWeight: "600" },
  rank: { fontSize: 16, fontWeight: "700", width: 32 },
  safeArea: { flex: 1 },
  scoreName: { flex: 1, fontSize: 14, fontWeight: "600" },
  scoreRow: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    padding: 12,
  },
  scoreValue: { fontSize: 16, fontWeight: "700" },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 20,
  },
  statCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
    width: "31%",
  },
  statLabel: { fontSize: 11, textAlign: "center" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
});
