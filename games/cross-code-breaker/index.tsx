import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View as RNView } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

const CODE_LEN = 4;
const MAX_GUESSES = 10;
const TOTAL_ROUNDS = 3;
const MAX_PLAYERS = 6;
const PLAYER_COLORS = ["#4FC3F7", "#FF8A65", "#81C784", "#CE93D8", "#FFD54F", "#4DD0E1"];

type Phase = "setup" | "handoff" | "playing" | "roundEnd" | "done";
type GuessEntry = { digits: number[]; bulls: number; cows: number };

function calcBullsCows(
	secret: number[],
	guess: number[],
): { bulls: number; cows: number } {
	let bulls = 0;
	let cows = 0;
	const sCount = Array(10).fill(0);
	const gCount = Array(10).fill(0);
	for (let i = 0; i < CODE_LEN; i++) {
		if (secret[i] === guess[i]) {
			bulls++;
		} else {
			sCount[secret[i]]++;
			gCount[guess[i]]++;
		}
	}
	for (let d = 0; d < 10; d++) cows += Math.min(sCount[d], gCount[d]);
	return { bulls, cows };
}

function generateSecret(): number[] {
	const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
	for (let i = digits.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[digits[i], digits[j]] = [digits[j], digits[i]];
	}
	return digits.slice(0, CODE_LEN);
}

export default function CrossCodeBreakerGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	/* setup */
	const [playerCount, setPlayerCount] = useState(2);
	const [phase, setPhase] = useState<Phase>("setup");

	/* round state */
	const [secret, setSecret] = useState<number[]>([]);
	const [round, setRound] = useState(1);
	const [currentPlayer, setCurrentPlayer] = useState(0);
	const [histories, setHistories] = useState<GuessEntry[][]>([]);
	const [scores, setScores] = useState<number[]>([]);
	const [roundWinner, setRoundWinner] = useState<number | null>(null);

	/* input */
	const [guessInput, setGuessInput] = useState<number[]>([]);
	const [lastResult, setLastResult] = useState<{ bulls: number; cows: number } | null>(null);

	const pColor = PLAYER_COLORS[currentPlayer];

	const startGame = () => {
		setScores(Array(playerCount).fill(0));
		setRound(1);
		startNewRound(playerCount);
	};

	const startNewRound = (pc: number) => {
		setSecret(generateSecret());
		setHistories(Array.from({ length: pc }, () => []));
		setCurrentPlayer(0);
		setRoundWinner(null);
		setGuessInput([]);
		setLastResult(null);
		setPhase("handoff");
	};

	const addDigit = (d: number) => {
		if (guessInput.length >= CODE_LEN) return;
		if (guessInput.includes(d)) {
			haptic.error();
			return;
		}
		setGuessInput((prev) => [...prev, d]);
		haptic.tap();
	};

	const submitGuess = () => {
		if (guessInput.length !== CODE_LEN) return;
		const result = calcBullsCows(secret, guessInput);
		setLastResult(result);

		const newHistories = histories.map((h, i) =>
			i === currentPlayer ? [...h, { digits: [...guessInput], ...result }] : h,
		);
		setHistories(newHistories);

		if (result.bulls === CODE_LEN) {
			haptic.success();
			setRoundWinner(currentPlayer);
			const guessCount = newHistories[currentPlayer].length;
			setScores((prev) => {
				const next = [...prev];
				next[currentPlayer] += Math.max(10, (MAX_GUESSES - guessCount + 1) * 10);
				return next;
			});
			setPhase("roundEnd");
			return;
		}

		haptic.tap();

		/* Check if all players have used all guesses */
		const allMaxed = newHistories.every((h) => h.length >= MAX_GUESSES);
		if (allMaxed) {
			setPhase("roundEnd");
			return;
		}

		/* Next player who still has guesses left */
		let next = (currentPlayer + 1) % playerCount;
		while (newHistories[next].length >= MAX_GUESSES) {
			next = (next + 1) % playerCount;
		}
		setCurrentPlayer(next);
		setGuessInput([]);
		setLastResult(null);
		setPhase("handoff");
	};

	const nextRound = () => {
		if (round >= TOTAL_ROUNDS) {
			updateProgress("cross-code-breaker", Math.max(...scores));
			setPhase("done");
			return;
		}
		setRound((r) => r + 1);
		startNewRound(playerCount);
	};

	const restart = () => {
		setPhase("setup");
		setPlayerCount(2);
	};

	/* â”€â”€ render helpers â”€â”€ */
	const renderCode = (digits: number[], highlight: string) => (
		<RNView style={styles.codeRow}>
			{Array.from({ length: CODE_LEN }).map((_, i) => (
				<RNView
					key={i}
					style={[
						styles.codeSlot,
						{
							backgroundColor: digits[i] != null ? highlight : theme.card,
							borderColor: theme.border,
						},
					]}
				>
					<Text
						style={[
							styles.codeDigit,
							{ color: digits[i] != null ? "#fff" : theme.mutedText },
						]}
					>
						{digits[i] != null ? digits[i] : "â€”"}
					</Text>
				</RNView>
			))}
		</RNView>
	);

	const renderPegs = (bulls: number, cows: number) => {
		const pegs: ("bull" | "cow" | "miss")[] = [];
		for (let i = 0; i < bulls; i++) pegs.push("bull");
		for (let i = 0; i < cows; i++) pegs.push("cow");
		while (pegs.length < CODE_LEN) pegs.push("miss");
		return (
			<RNView style={styles.pegRow}>
				{pegs.map((p, i) => (
					<RNView
						key={i}
						style={[
							styles.peg,
							{
								backgroundColor:
									p === "bull" ? "#4caf50" : p === "cow" ? "#ff9800" : theme.border,
							},
						]}
					/>
				))}
			</RNView>
		);
	};

	/* â”€â”€ SETUP â”€â”€ */
	if (phase === "setup") {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>{t("gameCrossCodeBreakerName")}</Text>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("mpSelectPlayers")}
				</Text>
				<RNView style={styles.countRow}>
					{Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
						<Pressable
							key={n}
							style={[
								styles.countBtn,
								{
									backgroundColor: playerCount === n ? theme.tint : theme.card,
									borderColor: playerCount === n ? theme.tint : theme.border,
								},
							]}
							onPress={() => setPlayerCount(n)}
						>
							<Text
								style={[styles.countBtnText, { color: playerCount === n ? "#fff" : theme.text }]}
							>
								{n}
							</Text>
						</Pressable>
					))}
				</RNView>
				<Pressable
					onPress={startGame}
					style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
				>
					<Text style={styles.primaryBtnText}>{t("start")}</Text>
				</Pressable>
			</View>
		);
	}

	/* â”€â”€ HANDOFF â”€â”€ */
	if (phase === "handoff") {
		return (
			<View style={styles.container}>
				<Animated.View entering={FadeInDown.duration(300)} style={styles.center}>
					<Text style={{ fontSize: 48, marginBottom: 12 }}>đź”’</Text>
					<Text style={[styles.title, { color: pColor }]}>
						{t("mpPlayerN", { n: currentPlayer + 1 })}
					</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("cbHandoffHint")}
					</Text>
					<Text style={[styles.guessCount, { color: theme.mutedText }]}>
						{t("cbGuessesUsed")}: {histories[currentPlayer]?.length ?? 0}/{MAX_GUESSES}
					</Text>
					<Pressable
						onPress={() => { setPhase("playing"); setGuessInput([]); setLastResult(null); }}
						style={[styles.primaryBtn, { backgroundColor: pColor, marginTop: 20 }]}
					>
						<Text style={styles.primaryBtnText}>{t("passPhoneReady")}</Text>
					</Pressable>
				</Animated.View>
			</View>
		);
	}

	/* â”€â”€ ROUND END â”€â”€ */
	if (phase === "roundEnd") {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>
					{roundWinner != null
						? t("dicePlayerWins", { player: String(roundWinner + 1) })
						: t("cbNobodyCracked")}
				</Text>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("cbSecretWas")}: {secret.join(" ")}
				</Text>

				{/* Scores */}
				<RNView style={styles.scoreTable}>
					{scores.map((s, i) => (
						<RNView key={i} style={[styles.scoreRow, { borderColor: theme.border + "44" }]}>
							<RNView style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[i] }]} />
							<Text style={[styles.scoreName, { color: theme.text }]}>
								{t("mpPlayerN", { n: i + 1 })}
							</Text>
							<Text style={[styles.scoreNum, { color: PLAYER_COLORS[i] }]}>{s}</Text>
						</RNView>
					))}
				</RNView>

				<Pressable
					onPress={nextRound}
					style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
				>
					<Text style={styles.primaryBtnText}>
						{round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
					</Text>
				</Pressable>
			</View>
		);
	}

	/* â”€â”€ DONE â”€â”€ */
	if (phase === "done") {
		const maxScore = Math.max(...scores);
		const winners = scores.map((s, i) => (s === maxScore ? i : -1)).filter((i) => i >= 0);
		const winnerName =
			winners.length === 1
				? t("dicePlayerWins", { player: String(winners[0] + 1) })
				: t("diceDraw");
		return (
			<View style={styles.container}>
				<Text style={{ fontSize: 48, marginBottom: 12 }}>đźŹ†</Text>
				<Text style={styles.title}>{winnerName}</Text>

				<RNView style={styles.scoreTable}>
					{scores.map((s, i) => (
						<RNView key={i} style={[styles.scoreRow, { borderColor: theme.border + "44" }]}>
							<RNView style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[i] }]} />
							<Text style={[styles.scoreName, { color: theme.text }]}>
								{t("mpPlayerN", { n: i + 1 })}
							</Text>
							<Text style={[styles.scoreNum, { color: PLAYER_COLORS[i] }]}>{s}</Text>
						</RNView>
					))}
				</RNView>

				<Pressable
					onPress={restart}
					style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
				>
					<Text style={styles.primaryBtnText}>{t("playAgain")}</Text>
				</Pressable>
			</View>
		);
	}

	/* â”€â”€ PLAYING â”€â”€ */
	const myHistory = histories[currentPlayer] ?? [];

	return (
		<View style={styles.container}>

			{/* HUD */}
			<RNView style={styles.hud}>
				<RNView style={styles.hudScores}>
					{scores.map((s, i) => (
						<RNView
							key={i}
							style={[
								styles.hudChip,
								i === currentPlayer && { borderColor: PLAYER_COLORS[i], borderWidth: 1.5 },
							]}
						>
							<RNView style={[styles.hudDot, { backgroundColor: PLAYER_COLORS[i] }]} />
							<Text style={[styles.hudNum, { color: PLAYER_COLORS[i] }]}>{s}</Text>
						</RNView>
					))}
				</RNView>
				<Text style={[styles.roundLabel, { color: theme.mutedText }]}>
					{t("hmRound", { round, total: TOTAL_ROUNDS })}
				</Text>
				<Text style={[styles.guesserLabel, { color: pColor }]}>
					{t("mpPlayerN", { n: currentPlayer + 1 })} â€” {myHistory.length}/{MAX_GUESSES}
				</Text>
			</RNView>

			<ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
				{/* Guess input */}
				{renderCode(guessInput, pColor)}

				{/* Numpad */}
				<RNView style={styles.numpad}>
					{[[1, 2, 3, 4, 5], [6, 7, 8, 9, 0]].map((row, ri) => (
						<RNView key={ri} style={styles.numRow}>
							{row.map((d) => (
								<Pressable
									key={d}
									onPress={() => addDigit(d)}
									style={[
										styles.numKey,
										{ backgroundColor: theme.card, borderColor: theme.border },
									]}
								>
									<Text style={styles.numKeyText}>{d}</Text>
								</Pressable>
							))}
						</RNView>
					))}
					<Pressable
						onPress={() => setGuessInput((p) => p.slice(0, -1))}
						style={[styles.deleteKey, { backgroundColor: theme.card, borderColor: theme.border }]}
					>
						<Text style={[styles.numKeyText, { color: "#ef5350" }]}>âŚ«</Text>
					</Pressable>
				</RNView>

				{guessInput.length === CODE_LEN && !lastResult && (
					<Animated.View entering={ZoomIn.duration(200)}>
						<Pressable
							onPress={submitGuess}
							style={[styles.primaryBtn, { backgroundColor: pColor }]}
						>
							<Text style={styles.primaryBtnText}>{t("cbCheck")}</Text>
						</Pressable>
					</Animated.View>
				)}

				{/* Last result */}
				{lastResult && (
					<Animated.View entering={ZoomIn.duration(200)} style={styles.resultBox}>
						{renderPegs(lastResult.bulls, lastResult.cows)}
						<Text style={[styles.resultSubtext, { color: theme.mutedText }]}>
							{lastResult.bulls}đźŽŻ {lastResult.cows}đź”„
						</Text>
					</Animated.View>
				)}

				{/* History */}
				{myHistory.length > 0 && (
					<RNView style={styles.historySection}>
						<Text style={[styles.historyTitle, { color: theme.mutedText }]}>
							{t("cbHistory")}
						</Text>
						{myHistory.map((entry, idx) => (
							<RNView
								key={idx}
								style={[styles.historyRow, { backgroundColor: theme.card, borderColor: theme.border }]}
							>
								<Text style={styles.historyIdx}>{idx + 1}.</Text>
								<Text style={styles.historyDigits}>{entry.digits.join(" ")}</Text>
								{renderPegs(entry.bulls, entry.cows)}
							</RNView>
						))}
					</RNView>
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", paddingTop: 10 },
	center: { alignItems: "center" },
	title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
	subtitle: { fontSize: 14, textAlign: "center", marginTop: 4, marginBottom: 12 },
	/* setup */
	countRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
	countBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
	countBtnText: { fontSize: 20, fontWeight: "800" },
	/* hud */
	hud: { width: "100%", alignItems: "center", marginBottom: 4, gap: 2 },
	hudScores: { flexDirection: "row", gap: 8, justifyContent: "center" },
	hudChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
	hudDot: { width: 8, height: 8, borderRadius: 4 },
	hudNum: { fontSize: 18, fontWeight: "900" },
	roundLabel: { fontSize: 11, fontWeight: "700" },
	guesserLabel: { fontSize: 13, fontWeight: "800" },
	guessCount: { fontSize: 13, fontWeight: "600" },
	/* code */
	codeRow: { flexDirection: "row", gap: 10, marginVertical: 10 },
	codeSlot: { width: 50, height: 56, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
	codeDigit: { fontSize: 26, fontWeight: "800" },
	/* numpad */
	numpad: { alignItems: "center", gap: 6, marginVertical: 8 },
	numRow: { flexDirection: "row", gap: 6 },
	numKey: { width: 50, height: 44, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
	numKeyText: { fontSize: 20, fontWeight: "700" },
	deleteKey: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignSelf: "flex-end" },
	/* buttons */
	primaryBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
	primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
	/* pegs */
	pegRow: { flexDirection: "row", gap: 4 },
	peg: { width: 14, height: 14, borderRadius: 7 },
	/* result */
	resultBox: { alignItems: "center", marginVertical: 8, gap: 6 },
	resultSubtext: { fontSize: 13, fontWeight: "600" },
	/* history */
	historySection: { width: "90%", marginTop: 14, gap: 4 },
	historyTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
	historyRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
	historyIdx: { fontSize: 13, fontWeight: "600", width: 24 },
	historyDigits: { fontSize: 16, fontWeight: "700", flex: 1, letterSpacing: 4 },
	/* scores */
	playerDot: { width: 10, height: 10, borderRadius: 5 },
	scoreTable: { width: "100%", gap: 6, marginBottom: 16, paddingHorizontal: 16 },
	scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
	scoreName: { fontSize: 16, fontWeight: "700", flex: 1 },
	scoreNum: { fontSize: 24, fontWeight: "900" },
	/* scroll */
	scrollArea: { flex: 1, width: "100%" },
	scrollContent: { alignItems: "center", paddingBottom: 20 },
});
