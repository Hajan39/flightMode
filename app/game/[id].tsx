import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useTranslation } from "@/hooks/useTranslation";

export default function GameScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { t } = useTranslation();

	if (id === "memory") {
		const MemoryGame = require("@/games/memory").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<MemoryGame />
			</SafeAreaView>
		);
	}

	if (id === "tap-rush") {
		const TapRushGame = require("@/games/tap-rush").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<TapRushGame />
			</SafeAreaView>
		);
	}

	if (id === "sky-math") {
		const SkyMathGame = require("@/games/sky-math").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<SkyMathGame />
			</SafeAreaView>
		);
	}

	if (id === "quiz") {
		const QuizGame = require("@/games/quiz").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<QuizGame />
			</SafeAreaView>
		);
	}

	if (id === "reaction") {
		const ReactionGame = require("@/games/reaction").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<ReactionGame />
			</SafeAreaView>
		);
	}

	if (id === "duel-tictactoe") {
		const DuelTicTacToe = require("@/games/duel-tictactoe").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<DuelTicTacToe />
			</SafeAreaView>
		);
	}

	if (id === "duel-dice") {
		const DuelDice = require("@/games/duel-dice").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<DuelDice />
			</SafeAreaView>
		);
	}

	if (id === "runway-landing") {
		const RunwayLanding = require("@/games/runway-landing").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<RunwayLanding />
			</SafeAreaView>
		);
	}

	if (id === "cabin-call") {
		const CabinCall = require("@/games/cabin-call").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<CabinCall />
			</SafeAreaView>
		);
	}

	if (id === "air-traffic-control") {
		const AirTrafficControl = require("@/games/air-traffic-control").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<AirTrafficControl />
			</SafeAreaView>
		);
	}

	if (id === "flight-path") {
		const FlightPath = require("@/games/flight-path").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<FlightPath />
			</SafeAreaView>
		);
	}

	if (id === "sky-defense") {
		const SkyDefense = require("@/games/sky-defense").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<SkyDefense />
			</SafeAreaView>
		);
	}

	if (id === "stack-sort") {
		const StackSort = require("@/games/stack-sort").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<StackSort />
			</SafeAreaView>
		);
	}

	if (id === "duel-connect4") {
		const DuelConnect4 = require("@/games/duel-connect4").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<DuelConnect4 />
			</SafeAreaView>
		);
	}

	if (id === "duel-emoji-find") {
		const DuelEmojiFind = require("@/games/duel-emoji-find").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<DuelEmojiFind />
			</SafeAreaView>
		);
	}

	if (id === "duel-hangman") {
		const DuelHangman = require("@/games/duel-hangman").default;
		return (
			<SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
				<DuelHangman />
			</SafeAreaView>
		);
	}

	return (
		<View style={styles.container}>
			<Text>{t("gameNotFound", { id })}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
