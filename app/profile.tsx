import { useEffect } from "react";
import { StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useAchievementStore } from "@/store/useAchievementStore";
import { achievements, type AchievementDef } from "@/data/achievements";

const GAME_NAME_KEYS: Record<string, string> = {
	memory: "gameMemoryName",
	"tap-rush": "gameTapRushName",
	"sky-math": "gameSkyMathName",
	quiz: "gameQuizName",
	reaction: "gameReactionName",
	"runway-landing": "gameRunwayLandingName",
	"cabin-call": "gameCabinCallName",
	"air-traffic-control": "gameAirTrafficControlName",
	"flight-path": "gameFlightPathName",
	"sky-defense": "gameSkyDefenseName",
	"stack-sort": "gameStackSortName",
	"duel-tictactoe": "gameDuelTicTacToeName",
	"duel-dice": "gameDuelDiceName",
};

export default function ProfileScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const stats = useProfileStats();
	const unlockedIds = useAchievementStore((s) => s.unlockedIds);
	const clearNewUnlocked = useAchievementStore((s) => s.clearNewUnlocked);

	useEffect(() => {
		clearNewUnlocked();
	}, []);

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: theme.background }]}
			contentContainerStyle={styles.content}
		>
			{/* ── Stats Cards ── */}
			<Animated.View entering={FadeInDown.duration(400).springify()}>
				<Text style={[styles.sectionTitle, { color: theme.text }]}>
					{t("profileStats")}
				</Text>
				<View style={styles.statsGrid}>
					<StatCard
						icon="game-controller-outline"
						value={stats.totalGamesPlayed}
						label={t("profileGamesPlayed")}
						theme={theme}
					/>
					<StatCard
						icon="time-outline"
						value={stats.estimatedMinutes}
						label={t("profileMinutes")}
						theme={theme}
					/>
					<StatCard
						icon="flame-outline"
						value={stats.streakDays}
						label={t("profileStreak")}
						theme={theme}
					/>
					<StatCard
						icon="airplane-outline"
						value={stats.totalFlights}
						label={t("profileFlights")}
						theme={theme}
					/>
					<StatCard
						icon="book-outline"
						value={stats.articlesRead}
						label={t("profileArticles")}
						theme={theme}
					/>
					<StatCard
						icon="leaf-outline"
						value={stats.totalRelaxSessions}
						label={t("profileRelaxSessions")}
						theme={theme}
					/>
				</View>
			</Animated.View>

			{/* ── Achievements Grid ── */}
			<Animated.View entering={FadeInDown.delay(200).springify()}>
				<View
					style={styles.sectionHeader}
					lightColor="transparent"
					darkColor="transparent"
				>
					<Text style={[styles.sectionTitle, { color: theme.text }]}>
						{t("profileAchievements")}
					</Text>
					<Text style={[styles.counter, { color: theme.mutedText }]}>
						{stats.achievementsUnlocked}/{stats.achievementsTotal}
					</Text>
				</View>
				<View style={styles.achievementGrid}>
					{achievements.map((a, i) => (
						<AchievementBadge
							key={a.id}
							achievement={a}
							unlocked={unlockedIds.includes(a.id)}
							theme={theme}
							t={t}
							index={i}
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
					{stats.topScores.map((entry, i) => (
						<View
							key={entry.gameId}
							style={[
								styles.scoreRow,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
						>
							<Text style={[styles.rank, { color: theme.tint }]}>#{i + 1}</Text>
							<Text style={[styles.scoreName, { color: theme.text }]}>
								{t(GAME_NAME_KEYS[entry.gameId] as never)}
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
					<Ionicons name="heart" size={20} color={theme.tint} />
					<Text style={[styles.favoriteText, { color: theme.text }]}>
						{t("profileFavorite")}:{" "}
						{t(GAME_NAME_KEYS[stats.favoriteGameId] as never)}
					</Text>
				</View>
			)}
		</ScrollView>
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
			<Ionicons name={icon as never} size={24} color={theme.tint} />
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
				name={achievement.icon as never}
				size={28}
				color={unlocked ? theme.tint : theme.mutedText}
			/>
			<Text
				style={[
					styles.badgeTitle,
					{ color: unlocked ? theme.text : theme.mutedText },
				]}
				numberOfLines={2}
			>
				{t(achievement.titleKey)}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { padding: 16, paddingBottom: 40 },
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		marginTop: 20,
		marginBottom: 12,
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	counter: { fontSize: 14, fontWeight: "600" },
	statsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
	},
	statCard: {
		width: "31%",
		borderRadius: 12,
		borderWidth: 1,
		padding: 12,
		alignItems: "center",
		gap: 4,
	},
	statValue: { fontSize: 22, fontWeight: "800" },
	statLabel: { fontSize: 11, textAlign: "center" },
	achievementGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
	},
	badge: {
		width: "22%",
		aspectRatio: 1,
		borderRadius: 12,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 6,
	},
	badgeTitle: { fontSize: 9, textAlign: "center", marginTop: 4 },
	scoreRow: {
		flexDirection: "row",
		alignItems: "center",
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		marginBottom: 8,
	},
	rank: { fontSize: 16, fontWeight: "700", width: 32 },
	scoreName: { flex: 1, fontSize: 14, fontWeight: "600" },
	scoreValue: { fontSize: 16, fontWeight: "700" },
	favoriteCard: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
		borderRadius: 12,
		borderWidth: 1,
		marginTop: 16,
		gap: 8,
	},
	favoriteText: { fontSize: 14, fontWeight: "600" },
});
