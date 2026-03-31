import { useState, useEffect } from "react";
import { StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, {
	FadeInDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedText } from "@/i18n/translations";
import {
	useFlightStore,
	getFlightProgress,
	getRemainingMinutes,
} from "@/store/useFlightStore";
import content from "@/data/content.json";
import type { ContentItem } from "@/types/content";

const articles = content as ContentItem[];
const dailyChallenges: {
	id: string;
	nameKey: TranslationKey;
	descriptionKey: TranslationKey;
	icon: string;
}[] = [
	{
		id: "runway-landing",
		nameKey: "gameRunwayLandingName",
		descriptionKey: "gameRunwayLandingDescription",
		icon: "airplane-outline",
	},
	{
		id: "cabin-call",
		nameKey: "gameCabinCallName",
		descriptionKey: "gameCabinCallDescription",
		icon: "megaphone-outline",
	},
	{
		id: "reaction",
		nameKey: "gameReactionName",
		descriptionKey: "gameReactionDescription",
		icon: "flash-outline",
	},
	{
		id: "quiz",
		nameKey: "gameQuizName",
		descriptionKey: "gameQuizDescription",
		icon: "help-circle-outline",
	},
];

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
	const [, setTick] = useState(0);

	// Re-render every 30s to update progress
	useEffect(() => {
		if (!flight) return;
		const interval = setInterval(() => setTick((t) => t + 1), 30000);
		return () => clearInterval(interval);
	}, [flight]);

	const progress = flight ? getFlightProgress(flight) : 0;
	const remaining = flight ? getRemainingMinutes(flight) : 0;
	const remainingH = Math.floor(remaining / 60);
	const remainingM = Math.round(remaining % 60);
	const preferredCategories =
		remaining > 120
			? ["Relax", "Health"]
			: remaining > 30
				? ["Travel Tips", "Health"]
				: ["Travel Tips", "Relax"];

	const featuredArticles = articles
		.map((item) => ({
			...item,
			titleText: getLocalizedText(item.title, language),
			categoryText: getLocalizedText(item.category, language),
		}))
		.filter((item) => preferredCategories.includes(item.categoryText))
		.slice(0, 2);
	const challengeOfDay =
		dailyChallenges[getDayOfYear(new Date()) % dailyChallenges.length];

	return (
		<ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
			{/* Flight section */}
			{flight ? (
				<Animated.View
					entering={FadeInDown.duration(500).springify()}
					style={[styles.flightCard, { backgroundColor: theme.accentSoft }]}
				>
					<View style={styles.flightHeader}>
						<Ionicons name="airplane" size={22} color={theme.tint} />
						<Text style={styles.flightTitle}>
							{flight.flightNumber ?? t("yourFlight")}
						</Text>
						<Pressable onPress={clearFlight}>
							<Ionicons
								name="close-circle-outline"
								size={22}
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

					{/* Recommendation */}
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
				</Animated.View>
			) : (
				<AnimatedPressable
					style={[
						styles.addFlightCard,
						{ borderColor: theme.border, backgroundColor: theme.card },
					]}
					onPress={() => router.push("/flight/edit")}
				>
					<Ionicons name="airplane-outline" size={40} color={theme.tint} />
					<Text style={styles.addFlightTitle}>{t("addYourFlight")}</Text>
					<Text style={[styles.addFlightSubtitle, { color: theme.mutedText }]}>
						{t("trackFlightRecommendation")}
					</Text>
				</AnimatedPressable>
			)}

			{/* Quick Actions */}
			<Text style={styles.sectionTitle}>{t("quickActions")}</Text>
			<View style={styles.actions}>
				<Animated.View entering={FadeInDown.delay(100).springify()}>
					<AnimatedPressable
						style={[
							styles.actionButton,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => router.push("/(tabs)/games")}
					>
						<Ionicons
							name="game-controller-outline"
							size={28}
							color={theme.tint}
						/>
						<Text style={styles.actionLabel}>{t("play")}</Text>
					</AnimatedPressable>
				</Animated.View>

				<Animated.View entering={FadeInDown.delay(200).springify()}>
					<AnimatedPressable
						style={[
							styles.actionButton,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => router.push("/(tabs)/explore")}
					>
						<Ionicons name="compass-outline" size={28} color={theme.tint} />
						<Text style={styles.actionLabel}>{t("explore")}</Text>
					</AnimatedPressable>
				</Animated.View>

				<Animated.View entering={FadeInDown.delay(300).springify()}>
					<AnimatedPressable
						style={[
							styles.actionButton,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => router.push("/(tabs)/relax")}
					>
						<Ionicons name="leaf-outline" size={28} color={theme.tint} />
						<Text style={styles.actionLabel}>{t("relax")}</Text>
					</AnimatedPressable>
				</Animated.View>
			</View>

			<Animated.View entering={FadeInDown.delay(350).springify()}>
				<Text style={styles.sectionTitle}>{t("dailyChallenge")}</Text>
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
								{t(challengeOfDay.nameKey)}
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

			<Text style={styles.sectionTitle}>{t("playTogether")}</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.playTogetherRow}
				contentContainerStyle={styles.playTogetherRowContent}
			>
				<AnimatedPressable
					style={[
						styles.playTogetherCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push("/game/duel-tictactoe")}
				>
					<Ionicons name="people-outline" size={22} color={theme.tint} />
					<Text style={styles.playTogetherTitle}>
						{t("gameDuelTicTacToeName")}
					</Text>
					<Text style={[styles.playTogetherMeta, { color: theme.mutedText }]}>
						{t("playTogetherBestOfMode")}
					</Text>
				</AnimatedPressable>

				<AnimatedPressable
					style={[
						styles.playTogetherCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push("/game/duel-dice")}
				>
					<Ionicons name="dice-outline" size={22} color={theme.tint} />
					<Text style={styles.playTogetherTitle}>{t("gameDuelDiceName")}</Text>
					<Text style={[styles.playTogetherMeta, { color: theme.mutedText }]}>
						{t("playTogetherPassAndPlay")}
					</Text>
				</AnimatedPressable>

				<AnimatedPressable
					style={[
						styles.playTogetherCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push("/game/duel-connect4")}
				>
					<Ionicons name="apps-outline" size={22} color={theme.tint} />
					<Text style={styles.playTogetherTitle}>
						{t("gameDuelConnect4Name")}
					</Text>
					<Text style={[styles.playTogetherMeta, { color: theme.mutedText }]}>
						{t("playTogetherBestOfMode")}
					</Text>
				</AnimatedPressable>

				<AnimatedPressable
					style={[
						styles.playTogetherCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push("/game/duel-emoji-find")}
				>
					<Ionicons name="search-outline" size={22} color={theme.tint} />
					<Text style={styles.playTogetherTitle}>
						{t("gameDuelEmojiFindName")}
					</Text>
					<Text style={[styles.playTogetherMeta, { color: theme.mutedText }]}>
						{t("playTogetherSharedScreen")}
					</Text>
				</AnimatedPressable>

				<AnimatedPressable
					style={[
						styles.playTogetherCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push("/game/duel-hangman")}
				>
					<Ionicons name="text-outline" size={22} color={theme.tint} />
					<Text style={styles.playTogetherTitle}>
						{t("gameDuelHangmanName")}
					</Text>
					<Text style={[styles.playTogetherMeta, { color: theme.mutedText }]}>
						{t("playTogetherPassAndPlay")}
					</Text>
				</AnimatedPressable>
			</ScrollView>

			<Text style={styles.sectionTitle}>{t("featuredForFlight")}</Text>
			{featuredArticles.map((article) => (
				<AnimatedPressable
					key={article.id}
					style={[
						styles.featuredCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => router.push(`/content/${article.id}` as never)}
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
					<Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
				</AnimatedPressable>
			))}
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
	}, [progress]);

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
		padding: 32,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: "#ddd",
		borderStyle: "dashed",
		marginBottom: 24,
	},
	addFlightTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
	addFlightSubtitle: {
		fontSize: 13,
		color: "#999",
		marginTop: 4,
		textAlign: "center",
	},

	// Quick actions
	sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
	actions: { flexDirection: "row", gap: 12 },
	actionButton: {
		flex: 1,
		alignItems: "center",
		padding: 20,
		borderRadius: 16,
		borderWidth: 1,
	},
	actionLabel: { fontSize: 14, fontWeight: "600", marginTop: 8 },
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
