import { useState } from "react";
import { Pressable, View as RNView, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import {
	MatchResult,
	PassDeviceOverlay,
	PlayerScoreStrip,
	PlayerSetup,
	TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useAnimatedPress } from "@/hooks/useAnimatedPress";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "cross-code-breaker";
const CODE_LEN = 4;
const MAX_GUESSES = 10;
const TOTAL_ROUNDS = 3;

type Phase = "setup" | "handoff" | "playing" | "roundEnd" | "done";
type GuessEntry = { digits: number[]; bulls: number; cows: number };

function calcBullsCows(secret: number[], guess: number[]): { bulls: number; cows: number } {
	let bulls = 0;
	let cows = 0;
	const sCount = Array(10).fill(0);
	const gCount = Array(10).fill(0);
	for (let i = 0; i < CODE_LEN; i++) {
		if (secret[i] === guess[i]) bulls++;
		else {
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

const SLOT_KEYS = ["s0", "s1", "s2", "s3"] as const;
const PEG_KEYS = ["p0", "p1", "p2", "p3"] as const;

export default function CrossCodeBreakerGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const submitPress = useAnimatedPress(0.93);

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [secret, setSecret] = useState<number[]>([]);
	const [round, setRound] = useState(1);
	const [currentPlayer, setCurrentPlayer] = useState(0);
	const [histories, setHistories] = useState<GuessEntry[][]>([]);
	const [scores, setScores] = useState<number[]>([]);
	const [roundWinner, setRoundWinner] = useState<number | null>(null);
	const [guessInput, setGuessInput] = useState<number[]>([]);
	const [lastResult, setLastResult] = useState<{ bulls: number; cows: number } | null>(null);
	const [pendingNext, setPendingNext] = useState<number | null>(null);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	const current = players[Math.min(currentPlayer, Math.max(0, players.length - 1))];
	const pColor = current?.color ?? theme.tint;

	const startNewRound = (count: number) => {
		setSecret(generateSecret());
		setHistories(Array.from({ length: count }, () => []));
		setCurrentPlayer(0);
		setRoundWinner(null);
		setGuessInput([]);
		setLastResult(null);
		setPendingNext(null);
		setPhase("handoff");
	};

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		setPlayers(matchPlayers);
		setScores(Array(matchPlayers.length).fill(0));
		setRound(1);
		setProgress(undefined);
		startNewRound(matchPlayers.length);
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
		const newHistories = histories.map((h, i) =>
			i === currentPlayer ? [...h, { digits: [...guessInput], ...result }] : h,
		);
		setHistories(newHistories);
		setLastResult(result);

		if (result.bulls === CODE_LEN) {
			haptic.success();
			setRoundWinner(currentPlayer);
			const guessCount = newHistories[currentPlayer].length;
			setScores((prev) =>
				prev.map((s, i) =>
					i === currentPlayer ? s + Math.max(10, (MAX_GUESSES - guessCount + 1) * 10) : s,
				),
			);
			return;
		}

		haptic.tap();
		const allMaxed = newHistories.every((h) => h.length >= MAX_GUESSES);
		if (allMaxed) {
			setPendingNext(null);
			return;
		}
		let next = (currentPlayer + 1) % players.length;
		while (newHistories[next].length >= MAX_GUESSES) next = (next + 1) % players.length;
		setPendingNext(next);
	};

	const continueToNextPlayer = () => {
		if (pendingNext === null) return;
		haptic.tap();
		setCurrentPlayer(pendingNext);
		setGuessInput([]);
		setLastResult(null);
		setPendingNext(null);
		setPhase("handoff");
	};

	const confirmRoundEnd = () => {
		haptic.tap();
		setLastResult(null);
		setPhase("roundEnd");
	};

	const nextRound = () => {
		haptic.tap();
		if (round >= TOTAL_ROUNDS) {
			setProgress(recordMatch(GAME_ID, scores.map((score) => ({ score }))));
			setPhase("done");
			return;
		}
		setRound((r) => r + 1);
		startNewRound(players.length);
	};

	const renderCode = (digits: number[], highlight: string) => (
		<RNView style={styles.codeRow}>
			{SLOT_KEYS.map((key, i) => (
				<RNView
					key={key}
					style={[
						styles.codeSlot,
						{
							backgroundColor: digits[i] != null ? highlight : theme.card,
							borderColor: theme.border,
						},
					]}
				>
					<Text
						style={[styles.codeDigit, { color: digits[i] != null ? "#0b1620" : theme.mutedText }]}
					>
						{digits[i] != null ? digits[i] : "—"}
					</Text>
				</RNView>
			))}
		</RNView>
	);

	const renderPegs = (bulls: number, cows: number, animate = false) => {
		const pegs: ("bull" | "cow" | "miss")[] = [];
		for (let i = 0; i < bulls; i++) pegs.push("bull");
		for (let i = 0; i < cows; i++) pegs.push("cow");
		while (pegs.length < CODE_LEN) pegs.push("miss");
		return (
			<RNView style={styles.pegRow}>
				{pegs.map((p, i) => (
					<Animated.View
						key={PEG_KEYS[i]}
						entering={animate ? ZoomIn.delay(i * 40).duration(150) : undefined}
						style={[
							styles.peg,
							{
								backgroundColor:
									p === "bull" ? theme.successBorder : p === "cow" ? theme.warning : theme.border,
							},
						]}
					/>
				))}
			</RNView>
		);
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameCrossCodeBreakerName")}
				subtitle={t("cbSecretHint")}
				minPlayers={2}
				onStart={startMatch}
			/>
		);
	}

	const myHistory = histories[currentPlayer] ?? [];

	return (
		<View style={styles.container}>
			<RNView style={styles.topRow}>
				<TurnBanner
					player={current}
					compact
					label={
						phase === "roundEnd"
							? roundWinner != null
								? t("mpWinsRound", { player: players[roundWinner].name })
								: t("cbNobodyCracked")
							: `${current.name} · ${myHistory.length}/${MAX_GUESSES}`
					}
					right={
						<Text style={[styles.roundChip, { color: theme.mutedText }]}>
							{t("mpRoundOf", { round, total: TOTAL_ROUNDS })}
						</Text>
					}
				/>
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			<PlayerScoreStrip
				players={players}
				scores={scores}
				activeIndex={phase === "playing" ? currentPlayer : undefined}
				detail={(i) => `${histories[i]?.length ?? 0}/${MAX_GUESSES}`}
			/>

			{phase === "roundEnd" ? (
				<RNView style={styles.roundEnd}>
					<Text style={[styles.secretLabel, { color: theme.mutedText }]}>{t("cbSecretWas")}</Text>
					{renderCode(secret, roundWinner != null ? players[roundWinner].color : theme.tint)}
					<Pressable
						onPress={nextRound}
						accessibilityRole="button"
						accessibilityLabel={round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
						style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
					>
						<Text style={[styles.primaryBtnText, { color: theme.onTint }]}>
							{round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
						</Text>
					</Pressable>
				</RNView>
			) : (
				<ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
					{renderCode(guessInput, pColor)}

					<RNView style={styles.numpad}>
						{[
							[1, 2, 3, 4, 5],
							[6, 7, 8, 9, 0],
						].map((row) => (
							<RNView key={`row-${row[0]}`} style={styles.numRow}>
								{row.map((d) => (
									<Pressable
										key={d}
										onPress={() => addDigit(d)}
										disabled={lastResult !== null}
										accessibilityRole="button"
										accessibilityLabel={String(d)}
										style={[
											styles.numKey,
											{
												backgroundColor: guessInput.includes(d) ? `${pColor}33` : theme.card,
												borderColor: theme.border,
											},
										]}
									>
										<Text style={styles.numKeyText}>{d}</Text>
									</Pressable>
								))}
							</RNView>
						))}
						<Pressable
							onPress={() => {
								haptic.tap();
								setGuessInput((p) => p.slice(0, -1));
							}}
							disabled={lastResult !== null}
							accessibilityRole="button"
							accessibilityLabel={t("a11yBackspace")}
							style={[styles.deleteKey, { backgroundColor: theme.card, borderColor: theme.border }]}
						>
							<Text style={[styles.numKeyText, { color: theme.danger }]}>⌫</Text>
						</Pressable>
					</RNView>

					{guessInput.length === CODE_LEN && !lastResult ? (
						<Animated.View entering={ZoomIn.duration(200)} style={submitPress.animatedStyle}>
							<Pressable
								onPress={submitGuess}
								onPressIn={submitPress.onPressIn}
								onPressOut={submitPress.onPressOut}
								accessibilityRole="button"
								accessibilityLabel={t("cbCheck")}
								style={[styles.primaryBtn, { backgroundColor: pColor }]}
							>
								<Text style={styles.primaryBtnText}>{t("cbCheck")}</Text>
							</Pressable>
						</Animated.View>
					) : null}

					{lastResult ? (
						<Animated.View entering={ZoomIn.duration(200)} style={styles.resultBox}>
							{renderPegs(lastResult.bulls, lastResult.cows, true)}
							<Text style={[styles.resultSubtext, { color: theme.mutedText }]}>
								{lastResult.bulls}🎯 {lastResult.cows}🐄
							</Text>
							{roundWinner !== null ? (
								<Text style={[styles.cracked, { color: theme.successBorder }]}>{t("cbYouCracked")}</Text>
							) : null}
							{pendingNext !== null && roundWinner === null ? (
								<Pressable
									onPress={continueToNextPlayer}
									accessibilityRole="button"
									accessibilityLabel={t("passPhone")}
									style={[styles.primaryBtn, { backgroundColor: pColor }]}
								>
									<Text style={styles.primaryBtnText}>{t("passPhone")}</Text>
								</Pressable>
							) : (
								<Pressable
									onPress={confirmRoundEnd}
									accessibilityRole="button"
									accessibilityLabel={t("hmSeeResult")}
									style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
								>
									<Text style={[styles.primaryBtnText, { color: theme.onTint }]}>{t("hmSeeResult")}</Text>
								</Pressable>
							)}
						</Animated.View>
					) : null}

					{myHistory.length > 0 ? (
						<RNView style={styles.historySection}>
							<Text style={[styles.historyTitle, { color: theme.mutedText }]}>{t("cbMyGuesses")}</Text>
							{myHistory.map((entry, idx) => (
								<Animated.View
									key={`${entry.digits.join("")}-${idx}`}
									entering={FadeInDown.duration(200)}
									style={[styles.historyRow, { backgroundColor: theme.card, borderColor: theme.border }]}
								>
									<Text style={[styles.historyIdx, { color: theme.mutedText }]}>{idx + 1}.</Text>
									<Text style={styles.historyDigits}>{entry.digits.join(" ")}</Text>
									{renderPegs(entry.bulls, entry.cows)}
								</Animated.View>
							))}
						</RNView>
					) : null}
				</ScrollView>
			)}

			<PassDeviceOverlay
				visible={phase === "handoff"}
				toPlayer={current}
				secret
				hint={`${t("cbHandoffHint")} · ${t("cbGuessesUsed")}: ${myHistory.length}/${MAX_GUESSES}`}
				onReady={() => {
					setPhase("playing");
					setGuessInput([]);
					setLastResult(null);
				}}
			/>

			{phase === "done" ? (
				<MatchResult
					standings={players.map((p, i) => ({ player: p, score: scores[i] }))}
					winnerIndex={getSoleWinnerIndex(scores.map((score) => ({ score })))}
					scoreLabel={t("mpPoints")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "stretch", paddingTop: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.sm },
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	roundChip: { ...TextStyle.chipLabel },
	codeRow: { flexDirection: "row", gap: Spacing.sm + 2, marginVertical: Spacing.sm + 2, justifyContent: "center" },
	codeSlot: { width: 52, height: 58, borderRadius: Radius.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
	codeDigit: { fontSize: FontSize["3xl"] - 2, fontWeight: FontWeight.extrabold },
	numpad: { alignItems: "center", gap: 6, marginVertical: Spacing.sm },
	numRow: { flexDirection: "row", gap: 6 },
	numKey: { width: 52, height: 46, borderRadius: Radius.sm + 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
	numKeyText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
	deleteKey: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.sm + 2, borderWidth: 1, alignSelf: "flex-end" },
	primaryBtn: { paddingHorizontal: Spacing["3xl"], paddingVertical: Spacing.md, borderRadius: Radius.card, marginTop: Spacing.sm, alignSelf: "center" },
	primaryBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
	pegRow: { flexDirection: "row", gap: 4 },
	peg: { width: 14, height: 14, borderRadius: 7 },
	resultBox: { alignItems: "center", marginVertical: Spacing.sm, gap: 6 },
	resultSubtext: { ...TextStyle.hint },
	cracked: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
	historySection: { alignSelf: "stretch", marginTop: Spacing.md, gap: 4 },
	historyTitle: { ...TextStyle.statLabel, marginBottom: 4 },
	historyRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: Radius.sm + 2, paddingHorizontal: Spacing.sm + 2, paddingVertical: 6, gap: Spacing.sm },
	historyIdx: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, width: 24 },
	historyDigits: { fontSize: FontSize.md, fontWeight: FontWeight.bold, flex: 1, letterSpacing: 4 },
	roundEnd: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
	secretLabel: { ...TextStyle.statLabel },
	scrollArea: { flex: 1 },
	scrollContent: { alignItems: "center", paddingBottom: Spacing.xl },
});
