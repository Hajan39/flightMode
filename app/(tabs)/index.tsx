import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, {
	Easing,
	FadeInDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { dailyChallengeGames, playTogetherGames } from "@/data/games";
import { useContentItems } from "@/hooks/useContentItems";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import {
	getFlightProgress,
	getRemainingMinutes,
	useFlightStore,
} from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

function getDayOfYear(date: Date) {
	const start = new Date(date.getFullYear(), 0, 0);
	const diff = date.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);
}

export default function HomeScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { language, t } = useTranslation();
	const flight = useFlightStore((s) => s.flight);
	const clearFlight = useFlightStore((s) => s.clearFlight);
	const stats = useProfileStats();
	const articles = useContentItems();
	const [, setTick] = useState(0);

	// Re-render every 30s to update progress
	useEffect(() => {
		if (!flight) return;
		const interval = setInterval(() => setTick((t) => t + 1), 30000);
		return () => clearInterval(interval);
	}, [flight]);

	const progress = flight ? getFlightProgress(flight) : 0;
	const remaining = flight ? getRemainingMinutes(flight) : 0;
	const remainingRounded = Math.round(remaining);
	const remainingH = Math.floor(remainingRounded / 60);
	const remainingM = remainingRounded % 60;
	const arrivalTime = flight
		? new Date(flight.departureTime + flight.duration * 60000).toLocaleTimeString(
				[],
				{ hour: "2-digit", minute: "2-digit" },
			)
		: null;
	const preferredCategoriesEn =
		remaining > 120
			? ["Relax", "Health"]
			: remaining > 30
				? ["Travel Tips", "Health"]
				: ["Travel Tips", "Relax"];

	const languageReadyArticles = articles.filter((item) =>
		language === "en"
			? true
			: Boolean(
					item.title[language] &&
						item.category[language] &&
						item.body[language],
				),
	);

	const featuredArticles = languageReadyArticles
		.map((item) => ({
			...item,
			titleText: getLocalizedText(item.title, language),
			categoryText: getLocalizedText(item.category, language),
		}))
		.filter((item) => preferredCategoriesEn.includes(item.category.en))
		.slice(0, 2);
	const challengeOfDay =
		dailyChallengeGames[getDayOfYear(new Date()) % dailyChallengeGames.length];

	const openHomeAction = (target: "games" | "explore" | "relax" | "profile") => {
		captureAnalyticsEvent("home_action_open", { target });
		router.push(
			target === "profile" ? "/profile" : (`/(tabs)/${target}` as never),
		);
	};

	const openHomeRecommendation = (articleId: string, category: string) => {
		captureAnalyticsEvent("home_recommendation_open", {
			article_id: articleId,
			category,
		});
		router.push(`/content/${articleId}` as never);
	};

	return (
		<ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
			<Animated.View entering={FadeInDown.delay(80).springify()}>
				<Text style={styles.sectionTitle}>{t("yourFlight")}</Text>
				<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
					{t("homeFlightHint")}
				</Text>
				{flight ? (
					<View
						style={[styles.flightCard, { backgroundColor: theme.accentSoft }]}
					>
						<View style={styles.flightHeader}>
							<Ionicons name="airplane" size={20} color={theme.tint} />
							<Text style={styles.flightTitle}>
								{flight.flightNumber ?? t("yourFlight")}
							</Text>
							<Pressable onPress={clearFlight}>
								<Ionicons
									name="close-circle-outline"
									size={20}
									color={theme.mutedText}
								/>
							</Pressable>
						</View>

						<View
							style={[
								styles.progressBar,
								{ backgroundColor: theme.progressTrack },
							]}
						>
							<AnimatedProgressFill progress={progress} color={theme.tint} />
						</View>
						<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
							{Math.round(progress * 100)}% —{" "}
							{t("remainingTime", {
								hours: remainingH,
								minutes: remainingM,
							})}
						</Text>
						{arrivalTime && (
							<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
								{t("arrivalTime", { time: arrivalTime })}
							</Text>
						)}

						<View style={styles.recommendation}>
							<Ionicons name="bulb-outline" size={16} color={theme.warning} />
							<Text
								style={[styles.recommendationText, { color: theme.mutedText }]}
							>
								{remaining > 120
									? t("recommendationLong")
									: remaining > 30
										? t("recommendationMid")
										: t("recommendationShort")}
							</Text>
						</View>
					</View>
				) : (
					<AnimatedPressable
						style={[
							styles.addFlightCard,
							{ borderColor: theme.border, backgroundColor: theme.card },
						]}
						onPress={() => router.push("/flight/edit")}
					>
						<Ionicons name="airplane-outline" size={30} color={theme.tint} />
						<Text style={styles.addFlightTitle}>{t("addYourFlight")}</Text>
						<Text
							style={[styles.addFlightSubtitle, { color: theme.mutedText }]}
						>
							{t("trackFlightRecommendation")}
						</Text>
					</AnimatedPressable>
				)}
			</Animated.View>

			{/* Quick Actions */}
			<Text style={styles.sectionTitle}>{t("quickActions")}</Text>
			<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
				{t("homeQuickActionsHint")}
			</Text>
			<View style={styles.actions}>
				<Animated.View
					entering={FadeInDown.delay(100).springify()}
					style={styles.actionCol}
				>
					<AnimatedPressable
						style={[
							styles.actionButton,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => openHomeAction("games")}
					>
						<Ionicons
							name="game-controller-outline"
							size={28}
							color={theme.tint}
						/>
						<Text style={styles.actionLabel}>{t("play")}</Text>
					</AnimatedPressable>
				</Animated.View>

				<Animated.View
					entering={FadeInDown.delay(200).springify()}
					style={styles.actionCol}
				>
					<AnimatedPressable
						style={[
							styles.actionButton,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => openHomeAction("explore")}
					>
						<Ionicons name="compass-outline" size={28} color={theme.tint} />
						<Text style={styles.actionLabel}>{t("explore")}</Text>
					</AnimatedPressable>
				</Animated.View>

				<Animated.View
					entering={FadeInDown.delay(300).springify()}
					style={styles.actionCol}
				>
					<AnimatedPressable
						style={[
							styles.actionButton,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => openHomeAction("relax")}
					>
						<Ionicons name="leaf-outline" size={28} color={theme.tint} />
						<Text style={styles.actionLabel}>{t("relax")}</Text>
					</AnimatedPressable>
				</Animated.View>
			</View>

			<Animated.View entering={FadeInDown.delay(330).springify()}>
				<Text style={styles.sectionTitle}>{t("profileStats")}</Text>
				<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
					{t("homeProgressHint")}
				</Text>
				<View
					style={[
						styles.progressSnapshotCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
				>
					<View
						style={styles.progressSnapshotStats}
						lightColor="transparent"
						darkColor="transparent"
					>
						<View
							style={styles.progressStatItem}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Text style={[styles.progressStatValue, { color: theme.text }]}>
								{stats.totalGamesPlayed}
							</Text>
							<Text
								style={[styles.progressStatLabel, { color: theme.mutedText }]}
							>
								{t("profileGamesPlayed")}
							</Text>
						</View>
						<View
							style={styles.progressStatItem}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Text style={[styles.progressStatValue, { color: theme.text }]}>
								{stats.streakDays}
							</Text>
							<Text
								style={[styles.progressStatLabel, { color: theme.mutedText }]}
							>
								{t("profileStreak")}
							</Text>
						</View>
						<View
							style={styles.progressStatItem}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Text style={[styles.progressStatValue, { color: theme.text }]}>
								{stats.achievementsUnlocked}/{stats.achievementsTotal}
							</Text>
							<Text
								style={[styles.progressStatLabel, { color: theme.mutedText }]}
							>
								{t("profileAchievements")}
							</Text>
						</View>
					</View>
					<AnimatedPressable
						style={[styles.profileCta, { borderColor: theme.border }]}
						onPress={() => openHomeAction("profile")}
					>
						<Ionicons
							name="person-circle-outline"
							size={18}
							color={theme.tint}
						/>
						<Text style={[styles.profileCtaText, { color: theme.tint }]}>
							{t("stackProfile")}
						</Text>
					</AnimatedPressable>
				</View>
			</Animated.View>

			<Animated.View entering={FadeInDown.delay(350).springify()}>
				<Text style={styles.sectionTitle}>{t("dailyChallenge")}</Text>
				<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
					{t("homeDailyChallengeHint")}
				</Text>
				<AnimatedPressable
					style={[
						styles.challengeCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push(`/game/${challengeOfDay.id}` as never)}
				>
					<View
						style={styles.challengeBody}
						lightColor="transparent"
						darkColor="transparent"
					>
						<View
							style={styles.challengeTop}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Ionicons
								name={challengeOfDay.icon as never}
								size={22}
								color={theme.tint}
							/>
							<Text style={styles.challengeTitle}>
								{t(challengeOfDay.titleKey)}
							</Text>
						</View>
						<Text
							style={[styles.challengeDescription, { color: theme.mutedText }]}
						>
							{t(challengeOfDay.descriptionKey)}
						</Text>
						<View
							style={styles.challengeCtaRow}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Text style={[styles.challengeCta, { color: theme.tint }]}>
								{t("dailyChallengeCta")}
							</Text>
							<Ionicons name="arrow-forward" size={16} color={theme.tint} />
						</View>
					</View>
				</AnimatedPressable>
			</Animated.View>

			<Animated.View entering={FadeInDown.delay(400).springify()}>
				<Text style={styles.sectionTitle}>{t("playTogether")}</Text>
				<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
					{t("homePlayTogetherHint")}
				</Text>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={styles.playTogetherRow}
					contentContainerStyle={styles.playTogetherRowContent}
				>
					{playTogetherGames.map((game) => (
						<AnimatedPressable
							key={game.id}
							style={[
								styles.playTogetherCard,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
							onPress={() => router.push(`/game/${game.id}` as never)}
						>
							<Ionicons
								name={game.icon as never}
								size={22}
								color={theme.tint}
							/>
							<Text style={styles.playTogetherTitle}>{t(game.titleKey)}</Text>
							<Text
								style={[styles.playTogetherMeta, { color: theme.mutedText }]}
							>
								{game.id === "duel-dice" || game.id === "duel-hangman"
									? t("playTogetherPassAndPlay")
									: game.id === "duel-emoji-find"
										? t("playTogetherSharedScreen")
										: game.id.startsWith("cross-")
											? t("playTogetherCrossDevice")
											: t("playTogetherBestOfMode")}
							</Text>
						</AnimatedPressable>
					))}
				</ScrollView>
			</Animated.View>

			<Animated.View entering={FadeInDown.delay(450).springify()}>
				<Text style={styles.sectionTitle}>{t("featuredForFlight")}</Text>
				{featuredArticles.map((article) => (
					<AnimatedPressable
						key={article.id}
						style={[
							styles.featuredCard,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() =>
							openHomeRecommendation(article.id, article.category.en)
						}
					>
						<View
							lightColor="transparent"
							darkColor="transparent"
							style={styles.featuredBody}
						>
							<Text style={[styles.featuredCategory, { color: theme.tint }]}>
								{article.categoryText}
							</Text>
							<Text style={styles.featuredTitle}>{article.titleText}</Text>
							<Text style={[styles.featuredMeta, { color: theme.mutedText }]}>
								~{t("minutesShort", { minutes: article.readTime })}
							</Text>
						</View>
						<Ionicons
							name="chevron-forward"
							size={20}
							color={theme.mutedText}
						/>
					</AnimatedPressable>
				))}
			</Animated.View>
		</ScrollView>
	);
}

function AnimatedProgressFill({
	progress,
	color,
}: {
	progress: number;
	color: string;
}) {
	const width = useSharedValue(0);

	useEffect(() => {
		width.value = withTiming(Math.round(progress * 100), {
			duration: 800,
			easing: Easing.out(Easing.cubic),
		});
	}, [progress, width]);

	const fillStyle = useAnimatedStyle(() => ({
		width: `${width.value}%`,
		height: "100%",
		backgroundColor: color,
		borderRadius: 4,
	}));

	return <Animated.View style={fillStyle} />;
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	container: { padding: 20, paddingBottom: 40 },

	// Flight card (active flight)
	flightCard: {
		padding: 20,
		borderRadius: 16,
		backgroundColor: "#f0f8ff",
		marginBottom: 24,
	},
	flightHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 16,
		backgroundColor: "transparent",
	},
	flightTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
	progressBar: {
		height: 8,
		borderRadius: 4,
		backgroundColor: "#ddd",
		overflow: "hidden",
		marginBottom: 8,
	},
	progressFill: {
		height: "100%",
		backgroundColor: "#2f95dc",
		borderRadius: 4,
	},
	progressLabel: { fontSize: 13, color: "#666" },
	recommendation: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 12,
		backgroundColor: "transparent",
	},
	recommendationText: { fontSize: 13, color: "#666", flex: 1 },

	// Add flight card (no flight)
	addFlightCard: {
		alignItems: "center",
		padding: 24,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: "#ddd",
		borderStyle: "dashed",
		marginBottom: 6,
	},
	addFlightTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
	addFlightSubtitle: {
		fontSize: 13,
		color: "#999",
		marginTop: 4,
		textAlign: "center",
	},

	// Quick actions
	sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
	sectionHint: {
		fontSize: 12,
		lineHeight: 16,
		marginBottom: 10,
	},
	actions: { flexDirection: "row", gap: 12 },
	actionCol: { flex: 1 },
	actionButton: {
		flex: 1,
		alignItems: "center",
		padding: 20,
		borderRadius: 16,
		borderWidth: 1,
	},
	actionLabel: { fontSize: 14, fontWeight: "600", marginTop: 8 },
	progressSnapshotCard: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 14,
		gap: 12,
		marginBottom: 6,
	},
	progressSnapshotStats: {
		flexDirection: "row",
		gap: 10,
	},
	progressStatItem: {
		flex: 1,
		alignItems: "center",
	},
	progressStatValue: {
		fontSize: 18,
		fontWeight: "800",
	},
	progressStatLabel: {
		fontSize: 11,
		textAlign: "center",
		marginTop: 2,
	},
	profileCta: {
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: 6,
	},
	profileCtaText: {
		fontSize: 13,
		fontWeight: "700",
	},
	challengeCard: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 16,
		marginBottom: 4,
	},
	challengeBody: {
		gap: 8,
	},
	challengeTop: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	challengeTitle: {
		fontSize: 17,
		fontWeight: "700",
	},
	challengeDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
	challengeCtaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 2,
	},
	challengeCta: {
		fontSize: 13,
		fontWeight: "700",
	},
	playTogetherRow: {
		marginBottom: 4,
	},
	playTogetherRowContent: {
		gap: 10,
	},
	playTogetherCard: {
		width: 130,
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		gap: 6,
	},
	playTogetherTitle: {
		fontSize: 14,
		fontWeight: "700",
	},
	playTogetherMeta: {
		fontSize: 12,
	},
	featuredCard: {
		marginTop: 10,
		borderWidth: 1,
		borderRadius: 12,
		padding: 14,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	featuredBody: {
		flex: 1,
	},
	featuredCategory: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
	},
	featuredTitle: {
		fontSize: 15,
		fontWeight: "700",
		marginTop: 4,
	},
	featuredMeta: {
		fontSize: 12,
		marginTop: 4,
	},
});
