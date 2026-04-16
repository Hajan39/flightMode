import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useTranslation } from "@/hooks/useTranslation";
import GameRules from "@/components/GameRules";
import type { TranslationKey } from "@/i18n/translations";

const GAME_META: Record<string, { titleKey: TranslationKey; rulesKey: TranslationKey }> = {
	memory: { titleKey: "gameMemoryName", rulesKey: "rulesMemory" },
	"tap-rush": { titleKey: "gameTapRushName", rulesKey: "rulesTouchdown" },
	"sky-math": { titleKey: "gameSkyMathName", rulesKey: "rulesSkyMath" },
	quiz: { titleKey: "gameQuizName", rulesKey: "rulesQuiz" },
	reaction: { titleKey: "gameReactionName", rulesKey: "rulesReaction" },
	"duel-tictactoe": { titleKey: "gameDuelTicTacToeName", rulesKey: "rulesTicTacToe" },
	"duel-dice": { titleKey: "gameDuelDiceName", rulesKey: "rulesDice" },
	"runway-landing": { titleKey: "gameRunwayLandingName", rulesKey: "rulesRunwayLanding" },
	"cabin-call": { titleKey: "gameCabinCallName", rulesKey: "rulesCabinCall" },
	"air-traffic-control": { titleKey: "gameAirTrafficControlName", rulesKey: "rulesAirTrafficControl" },
	"flight-path": { titleKey: "gameFlightPathName", rulesKey: "rulesFlightPath" },
	"sky-defense": { titleKey: "gameSkyDefenseName", rulesKey: "rulesSkyDefense" },
	"stack-sort": { titleKey: "gameStackSortName", rulesKey: "rulesStackSort" },
	"duel-connect4": { titleKey: "gameDuelConnect4Name", rulesKey: "rulesConnect4" },
	"duel-emoji-find": { titleKey: "gameDuelEmojiFindName", rulesKey: "rulesEmojiFind" },
	"duel-hangman": { titleKey: "gameDuelHangmanName", rulesKey: "rulesHangman" },
	"cross-air-radar": { titleKey: "gameCrossAirRadarName", rulesKey: "rulesAirRadar" },
	"cross-code-breaker": { titleKey: "gameCrossCodeBreakerName", rulesKey: "rulesCodeBreaker" },
	"cross-liars-dice": { titleKey: "gameCrossLiarsDiceName", rulesKey: "rulesLiarsDice" },
};

export default function GameScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { t } = useTranslation();
	const meta = id ? GAME_META[id] : undefined;

	const headerOptions = meta
		? {
				title: t(meta.titleKey),
				headerRight: () => (
					<GameRules
						titleKey={meta.titleKey}
						rulesKey={meta.rulesKey}
						inline
					/>
				),
			}
		: { title: t("stackGame") };

	const GAME_COMPONENTS: Record<string, () => React.ComponentType> = {
		memory: () => require("@/games/memory").default,
		"tap-rush": () => require("@/games/tap-rush").default,
		"sky-math": () => require("@/games/sky-math").default,
		quiz: () => require("@/games/quiz").default,
		reaction: () => require("@/games/reaction").default,
		"duel-tictactoe": () => require("@/games/duel-tictactoe").default,
		"duel-dice": () => require("@/games/duel-dice").default,
		"runway-landing": () => require("@/games/runway-landing").default,
		"cabin-call": () => require("@/games/cabin-call").default,
		"air-traffic-control": () => require("@/games/air-traffic-control").default,
		"flight-path": () => require("@/games/flight-path").default,
		"sky-defense": () => require("@/games/sky-defense").default,
		"stack-sort": () => require("@/games/stack-sort").default,
		"duel-connect4": () => require("@/games/duel-connect4").default,
		"duel-emoji-find": () => require("@/games/duel-emoji-find").default,
		"duel-hangman": () => require("@/games/duel-hangman").default,
		"cross-air-radar": () => require("@/games/cross-air-radar").default,
		"cross-code-breaker": () => require("@/games/cross-code-breaker").default,
		"cross-liars-dice": () => require("@/games/cross-liars-dice").default,
	};

	const GameComponent = id && GAME_COMPONENTS[id] ? GAME_COMPONENTS[id]() : null;

	if (!GameComponent) {
		return (
			<>
				<Stack.Screen options={headerOptions} />
				<View style={styles.container}>
					<Text>{t("gameNotFound", { id })}</Text>
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<GameComponent />
			</SafeAreaView>
		</>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
