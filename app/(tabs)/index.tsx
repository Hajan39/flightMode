import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import DailyChallengeCard from "@/components/home/DailyChallengeCard";
import DestinationCard from "@/components/home/DestinationCard";
import FeaturedArticles, {
	type FeaturedArticle,
} from "@/components/home/FeaturedArticles";
import FlightCard from "@/components/home/FlightCard";
import GameCardRow, { type GameCardItem } from "@/components/home/GameCardRow";
import HomeCtaRow from "@/components/home/HomeCtaRow";
import HomeSection from "@/components/home/HomeSection";
import LandedCard from "@/components/home/LandedCard";
import StatsSnapshot from "@/components/home/StatsSnapshot";
import TravelToolsRow from "@/components/home/TravelToolsRow";
import WelcomeCard from "@/components/home/WelcomeCard";
import NewToTryRow from "@/components/NewToTryRow";
import { Spacing } from "@/constants/Spacing";
import { getDestinationById } from "@/data/destinations";
import {
	dailyChallengeGames,
	getGameById,
	playTogetherGames,
} from "@/data/games";
import { hasLanguage, useContentItems } from "@/hooks/useContentItems";
import { useFlightPhase } from "@/hooks/useFlightPhase";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useTabletLayout } from "@/hooks/useTabletLayout";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import {
	getChecklistProgress,
	getCurrentDestinationItemIds,
	useChecklistStore,
} from "@/store/useChecklistStore";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getRemainingMinutes, useFlightStore } from "@/store/useFlightStore";
import { useGameStore } from "@/store/useGameStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { GamePlayMode } from "@/types/game";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { pickFlightGames } from "@/utils/flightRecommendations";
import { cancelJetlagSleepReminder } from "@/utils/notifications";

function getPlayModeLabelKey(playMode?: GamePlayMode) {
	if (playMode === "passAndPlay") return "playTogetherPassAndPlay";
	if (playMode === "sharedScreen") return "playTogetherSharedScreen";
	if (playMode === "crossDevice") return "playTogetherCrossDevice";
	return "playTogetherBestOfMode";
}

function getDayOfYear(date: Date) {
	const start = new Date(date.getFullYear(), 0, 0);
	const diff = date.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);
}

export default function HomeScreen() {
	const router = useRouter();
	const { language, t } = useTranslation();
	const flight = useFlightStore((s) => s.flight);
	const clearFlight = useFlightStore((s) => s.clearFlight);
	const stats = useProfileStats();
	const articles = useContentItems();
	const gameProgress = useGameStore((s) => s.progress);
	const preferredCategories = useSettingsStore((s) => s.preferredCategories);
	const markGameSeen = useDiscoveryStore((s) => s.markGameSeen);
	const checklistChecked = useChecklistStore((s) => s.checkedIds);
	const checklistCustom = useChecklistStore((s) => s.customItems);
	const checklistProgress = getChecklistProgress(
		{ checkedIds: checklistChecked, customItems: checklistCustom },
		getCurrentDestinationItemIds(),
	);
	const { capStyle } = useTabletLayout();
	const [tick, setTick] = useState(0);
	// `tick` only exists to re-render every 30 s; read it so the clock lines refresh.
	const nowMs = Date.now() + tick * 0;

	// Re-render every 30s to update progress
	useEffect(() => {
		if (!flight) return;
		const interval = setInterval(() => setTick((prev) => prev + 1), 30000);
		return () => clearInterval(interval);
	}, [flight]);

	const remaining = flight ? getRemainingMinutes(flight) : 0;
	const flightDestination = flight?.destinationId
		? getDestinationById(flight.destinationId)
		: undefined;
	const phase = useFlightPhase(nowMs);
	const landed = phase === "landed";

	useEffect(() => {
		captureAnalyticsEvent("home_phase_shown", { phase });
	}, [phase]);

	const clearFlightAndReminder = () => {
		clearFlight();
		void cancelJetlagSleepReminder();
	};

	const openGame = (gameId: string) => {
		captureAnalyticsEvent("home_action_open", { target: "games" });
		router.push(`/game/${gameId}` as never);
	};

	const openHomeAction = (
		target: "games" | "explore" | "relax" | "profile" | "phrasebook" | "converter",
		href?: string,
	) => {
		captureAnalyticsEvent("home_action_open", { target });
		if (href) {
			router.push(href as never);
			return;
		}
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

	// Games sized to the remaining flight time.
	const flightGameItems: GameCardItem[] =
		flight && remaining > 0
			? pickFlightGames(remaining, preferredCategories).map((def) => ({
					id: def.id,
					icon: def.icon,
					title: t(def.titleKey),
					meta: t("minutesShort", { minutes: def.estimatedTime }),
				}))
			: [];

	// Recently played games, most recent first.
	const recentGameItems: GameCardItem[] = Object.values(gameProgress)
		.filter((p) => p.timesPlayed > 0)
		.sort((a, b) => b.lastPlayed - a.lastPlayed)
		.slice(0, 4)
		.map((p) => ({ def: getGameById(p.gameId), progress: p }))
		.filter(
			(x): x is { def: NonNullable<typeof x.def>; progress: typeof x.progress } =>
				Boolean(x.def),
		)
		.map(({ def, progress }) => ({
			id: def.id,
			icon: def.icon,
			title: t(def.titleKey),
			meta:
				progress.highScore > 0
					? t("homeBestScore", { score: progress.highScore })
					: t(def.descriptionKey),
		}));

	const playTogetherItems: GameCardItem[] = playTogetherGames.map((game) => ({
		id: game.id,
		icon: game.icon,
		title: t(game.titleKey),
		meta: t(getPlayModeLabelKey(game.playMode)),
	}));

	const preferredCategoriesEn =
		remaining > 120
			? ["Relax", "Health"]
			: remaining > 30
				? ["Travel Tips", "Health"]
				: ["Travel Tips", "Relax"];

	const featuredArticles: FeaturedArticle[] = articles
		.filter((item) => preferredCategoriesEn.includes(item.category.en))
		.slice(0, 2)
		.map((item) => ({
			id: item.id,
			titleText: getLocalizedText(item.title, language),
			categoryText: getLocalizedText(item.category, language),
			categoryEn: item.category.en,
			readTime: item.readTime,
			isFallback: !hasLanguage(item, language),
		}));

	const challengeOfDay =
		dailyChallengeGames[getDayOfYear(new Date()) % dailyChallengeGames.length];

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.container, capStyle]}
		>
			{/* After landing the screen is about the destination, not the flight. */}
			{landed && flightDestination ? (
				<HomeSection
					delay={80}
					title={t("homeLandedSection")}
					hint={t("homeLandedHint")}
					first
				>
					<LandedCard
						destination={flightDestination}
						nowMs={nowMs}
						onClear={clearFlightAndReminder}
						onOpenPhrasebook={() =>
							openHomeAction(
								"phrasebook",
								`/phrasebook?lang=${flightDestination.phraseLanguage}&source=landed`,
							)
						}
						onOpenConverter={() =>
							openHomeAction(
								"converter",
								`/converter?currency=${flightDestination.currencyCode}&source=landed`,
							)
						}
						onOpenTips={() =>
							router.push(`/destinations?focus=${flightDestination.id}` as never)
						}
					/>
					<HomeCtaRow
						icon="checkbox-outline"
						label={t("homeChecklistCta", {
							done: checklistProgress.done,
							total: checklistProgress.total,
						})}
						onPress={() => {
							captureAnalyticsEvent("checklist_open", { source: "home" });
							router.push("/checklist" as never);
						}}
					/>
				</HomeSection>
			) : (
				<HomeSection delay={80} title={t("yourFlight")} hint={t("homeFlightHint")} first>
					<FlightCard
						flight={flight}
						destination={flightDestination}
						nowMs={nowMs}
						landed={landed}
						onClear={clearFlightAndReminder}
						onAddFlight={() => router.push("/flight/edit")}
					/>
					<HomeCtaRow
						icon="shield-checkmark-outline"
						label={t("homePreflightCta")}
						onPress={() => router.push("/preflight")}
					/>
					<HomeCtaRow
						icon="checkbox-outline"
						label={t("homeChecklistCta", {
							done: checklistProgress.done,
							total: checklistProgress.total,
						})}
						onPress={() => {
							captureAnalyticsEvent("checklist_open", { source: "home" });
							router.push("/checklist" as never);
						}}
					/>
				</HomeSection>
			)}

			{/* Landed: travel tools and destination tips come before the games. */}
			{landed ? (
				<>
					<HomeSection delay={100} title={t("homeToolsTitle")} hint={t("homeToolsHint")}>
						<TravelToolsRow
							destination={flightDestination}
							onOpenPhrasebook={(href) => openHomeAction("phrasebook", href)}
							onOpenConverter={(href) => openHomeAction("converter", href)}
						/>
					</HomeSection>
					<HomeSection
						delay={120}
						title={t("homeDestinationsTitle")}
						hint={t("homeDestinationsHint")}
					>
						<DestinationCard
							destination={flightDestination}
							onPress={() =>
								router.push(
									flightDestination
										? (`/destinations?focus=${flightDestination.id}` as never)
										: ("/destinations" as never),
								)
							}
						/>
					</HomeSection>
				</>
			) : null}

			<HomeSection
				delay={350}
				title={t("dailyChallenge")}
				hint={t("homeDailyChallengeHint")}
			>
				<DailyChallengeCard
					game={challengeOfDay}
					onPress={() => router.push(`/game/${challengeOfDay.id}` as never)}
				/>
			</HomeSection>

			{flightGameItems.length > 0 && (
				<HomeSection
					delay={85}
					title={t("homeGamesForFlight")}
					hint={t("homeGamesForFlightHint")}
				>
					<GameCardRow items={flightGameItems} onOpenGame={openGame} />
				</HomeSection>
			)}

			{recentGameItems.length > 0 && (
				<HomeSection
					delay={90}
					title={t("homeJumpBackIn")}
					hint={t("homeJumpBackInHint")}
				>
					<GameCardRow items={recentGameItems} onOpenGame={openGame} />
				</HomeSection>
			)}

			{stats.totalGamesPlayed === 0 && (
				<HomeSection delay={320}>
					<WelcomeCard onPress={() => router.push("/(tabs)/games" as never)} />
				</HomeSection>
			)}

			<HomeSection
				delay={330}
				title={t("profileStats")}
				hint={t("homeProgressHint")}
			>
				<StatsSnapshot
					gamesPlayed={stats.totalGamesPlayed}
					flights={stats.totalFlights}
					achievementsUnlocked={stats.achievementsUnlocked}
					achievementsTotal={stats.achievementsTotal}
					onOpenProfile={() => openHomeAction("profile")}
				/>
			</HomeSection>

			<HomeSection delay={370}>
				<NewToTryRow
					title={t("homeNewToTry")}
					renderTitle={t}
					onOpenGame={(gameId) => {
						markGameSeen(gameId);
						openGame(gameId);
					}}
				/>
			</HomeSection>

			<HomeSection
				delay={400}
				title={t("playTogether")}
				hint={t("homePlayTogetherHint")}
			>
				<GameCardRow
					items={playTogetherItems}
					onOpenGame={(gameId) => router.push(`/game/${gameId}` as never)}
				/>
			</HomeSection>

			{landed ? null : (
			<HomeSection
				delay={430}
				title={t("homeDestinationsTitle")}
				hint={t("homeDestinationsHint")}
			>
				<DestinationCard
					destination={flightDestination}
					onPress={() =>
						router.push(
							flightDestination
								? (`/destinations?focus=${flightDestination.id}` as never)
								: ("/destinations" as never),
						)
					}
				/>
			</HomeSection>
			)}

			{landed ? null : (
			<HomeSection delay={440} title={t("homeToolsTitle")} hint={t("homeToolsHint")}>
				<TravelToolsRow
					destination={flightDestination}
					onOpenPhrasebook={(href) => openHomeAction("phrasebook", href)}
					onOpenConverter={(href) => openHomeAction("converter", href)}
				/>
			</HomeSection>
			)}

			<HomeSection delay={450} title={t("featuredForFlight")}>
				<FeaturedArticles
					articles={featuredArticles}
					onOpenArticle={openHomeRecommendation}
				/>
			</HomeSection>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	container: { padding: Spacing["2xl"], paddingBottom: Spacing["4xl"] + 16 },
});
