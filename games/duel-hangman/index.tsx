import { useState } from "react";
import {
	Pressable,
	View as RNView,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";

import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import {
	MatchResult,
	OptionChips,
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
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";
import { type Difficulty, pickWord } from "./words";

const GAME_ID = "duel-hangman";
const MAX_WRONG = 6;
const TOTAL_ROUNDS = 8;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const KEY_ROWS = [ALPHABET.slice(0, 9), ALPHABET.slice(9, 18), ALPHABET.slice(18, 26)];

const DIFF_LABELS: Record<Difficulty, TranslationKey> = {
	easy: "hmDiffEasy",
	medium: "hmDiffMedium",
	hard: "hmDiffHard",
};
const DIFF_HINTS: Record<Difficulty, TranslationKey> = {
	easy: "hmDiffEasyHint",
	medium: "hmDiffMediumHint",
	hard: "hmDiffHardHint",
};
const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

function getRoundDifficulty(base: Difficulty, round: number): Difficulty {
	const baseIndex = DIFFICULTY_ORDER.indexOf(base);
	const ramp = Math.floor((round - 1) / 3);
	return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, baseIndex + ramp)];
}

/* Hangman figure parts */
const PARTS: ((color: string) => React.ReactNode)[] = [
	(c) => (
		<RNView
			key="head"
			style={{ position: "absolute", top: 30, left: 44, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, borderColor: c }}
		/>
	),
	(c) => (
		<RNView key="body" style={{ position: "absolute", top: 54, left: 55, width: 2.5, height: 30, backgroundColor: c }} />
	),
	(c) => (
		<RNView key="larm" style={{ position: "absolute", top: 60, left: 40, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "30deg" }] }} />
	),
	(c) => (
		<RNView key="rarm" style={{ position: "absolute", top: 60, left: 57, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "-30deg" }] }} />
	),
	(c) => (
		<RNView key="lleg" style={{ position: "absolute", top: 82, left: 42, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "-30deg" }] }} />
	),
	(c) => (
		<RNView key="rleg" style={{ position: "absolute", top: 82, left: 54, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "30deg" }] }} />
	),
];

type Phase = "setup" | "handoff" | "playing" | "result";

export default function DuelHangmanGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t, language } = useTranslation();
	const haptic = useHaptic();
	const { width } = useWindowDimensions();

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [difficulty, setDifficulty] = useState<Difficulty>("medium");
	const [phase, setPhase] = useState<Phase>("setup");
	const [word, setWord] = useState("");
	const [guessed, setGuessed] = useState<Set<string>>(new Set());
	const [scores, setScores] = useState<number[]>([]);
	const [round, setRound] = useState(1);
	const [guesser, setGuesser] = useState(0);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	const solo = players.length === 1;
	const wrongCount = word ? [...guessed].filter((l) => !word.includes(l)).length : 0;
	const isWon = word ? word.split("").every((l) => guessed.has(l)) : false;
	const isLost = wrongCount >= MAX_WRONG;
	const gameOver = isWon || isLost;
	const current = players[Math.min(guesser, Math.max(0, players.length - 1))];
	const guesserColor = current?.color ?? theme.tint;
	const wordLetters = word.split("").map((letter, index) => ({
		id: `${letter}-${index + 1}-${word.length}`,
		letter,
	}));

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		setPlayers(matchPlayers);
		setScores(Array(matchPlayers.length).fill(0));
		setRound(1);
		setGuesser(0);
		setGuessed(new Set());
		setWord("");
		setProgress(undefined);
		// Solo: nothing to hide, skip the hand-off.
		if (matchPlayers.length === 1) {
			const diff = getRoundDifficulty(difficulty, 1);
			setWord(pickWord(language, diff));
			setPhase("playing");
		} else {
			setPhase("handoff");
		}
	};

	const startRound = () => {
		const diff = getRoundDifficulty(difficulty, round);
		setWord(pickWord(language, diff));
		setGuessed(new Set());
		setPhase("playing");
	};

	const handleGuess = (letter: string) => {
		if (gameOver || guessed.has(letter)) return;
		const next = new Set(guessed);
		next.add(letter);
		setGuessed(next);

		if (word.includes(letter)) haptic.success();
		else haptic.error();

		const won = word.split("").every((l) => next.has(l));
		const lost = [...next].filter((l) => !word.includes(l)).length >= MAX_WRONG;

		if (won) {
			setScores((prev) => prev.map((s, i) => (i === guesser ? s + 10 : s)));
		} else if (lost && !solo) {
			// Everyone else scores when the guesser fails.
			setScores((prev) => prev.map((s, i) => (i === guesser ? s : s + 5)));
		}
	};

	const nextRound = () => {
		haptic.tap();
		if (round >= TOTAL_ROUNDS) {
			if (solo) {
				setProgress(updateProgress(GAME_ID, scores[0], { won: scores[0] > 0 }));
			} else {
				setProgress(recordMatch(GAME_ID, scores.map((score) => ({ score }))));
			}
			setPhase("result");
			return;
		}
		const nextRoundNo = round + 1;
		setRound(nextRoundNo);
		setGuesser((g) => (g + 1) % players.length);
		setGuessed(new Set());
		if (solo) {
			setWord(pickWord(language, getRoundDifficulty(difficulty, nextRoundNo)));
			setPhase("playing");
		} else {
			setPhase("handoff");
		}
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameDuelHangmanName")}
				minPlayers={1}
				onStart={startMatch}
			>
				<OptionChips
					label={t("hmPickDifficulty")}
					value={difficulty}
					onChange={setDifficulty}
					options={DIFFICULTY_ORDER.map((d) => ({
						value: d,
						label: t(DIFF_LABELS[d]),
						hint: t(DIFF_HINTS[d]),
					}))}
				/>
			</PlayerSetup>
		);
	}

	const figureColor = theme.text;
	const screenW = Math.min(width, 520) - Spacing.lg * 2;
	const gap = word.length > 10 ? 4 : 8;
	const slotW = word.length
		? Math.min(32, (screenW - (word.length - 1) * gap) / word.length)
		: 32;
	const fontSize = slotW > 24 ? 24 : Math.max(14, slotW - 4);

	return (
		<View style={styles.root}>
			<RNView style={styles.topRow}>
				{current ? (
					<TurnBanner
						player={current}
						compact
						label={solo ? undefined : t("hmGuesserNamed", { player: current.name })}
						right={
							<Text style={[styles.roundChip, { color: theme.mutedText }]}>
								{t("mpRoundOf", { round, total: TOTAL_ROUNDS })}
							</Text>
						}
					/>
				) : null}
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			{!solo ? (
				<PlayerScoreStrip players={players} scores={scores} activeIndex={guesser} />
			) : (
				<Text style={[styles.soloScore, { color: theme.tint }]}>
					{scores[0] ?? 0} {t("mpPoints")}
				</Text>
			)}

			<RNView style={styles.gallowsBox}>
				<RNView style={[styles.gallowBase, { backgroundColor: figureColor }]} />
				<RNView style={[styles.gallowPole, { backgroundColor: figureColor }]} />
				<RNView style={[styles.gallowTop, { backgroundColor: figureColor }]} />
				<RNView style={[styles.gallowRope, { backgroundColor: figureColor }]} />
				{PARTS.slice(0, wrongCount).map((fn) => fn(figureColor))}
			</RNView>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.wordScrollContent}
				style={styles.wordScroll}
			>
				<RNView style={styles.wordRow}>
					{wordLetters.map(({ id, letter }) => (
						<RNView
							key={id}
							style={[
								styles.letterSlot,
								{
									width: slotW,
									marginHorizontal: gap / 2,
									borderBottomColor: gameOver
										? isWon
											? theme.successBorder
											: theme.danger
										: guesserColor,
								},
							]}
						>
							<Text
								style={[
									styles.letterChar,
									{
										fontSize,
										color: guessed.has(letter)
											? theme.text
											: gameOver
												? theme.danger
												: "transparent",
									},
								]}
							>
								{guessed.has(letter) || gameOver ? letter : "_"}
							</Text>
						</RNView>
					))}
				</RNView>
			</ScrollView>

			<Text style={[styles.wrongHint, { color: theme.mutedText }]}>
				{t("hmWrongCount", { count: wrongCount, max: MAX_WRONG })}
			</Text>

			{!gameOver ? (
				<RNView style={styles.keyboard}>
					{KEY_ROWS.map((row) => (
						<RNView key={`kr-${row.join("")}`} style={styles.keyRow}>
							{row.map((letter) => {
								const used = guessed.has(letter);
								const correct = used && word.includes(letter);
								const wrong = used && !word.includes(letter);
								return (
									<Pressable
										key={letter}
										style={[
											styles.key,
											{
												backgroundColor: correct
													? theme.successBorder
													: wrong
														? theme.danger
														: theme.elevated,
												opacity: used ? 0.5 : 1,
											},
										]}
										hitSlop={{ top: 3, bottom: 3, left: 2, right: 2 }}
										onPress={() => handleGuess(letter)}
										disabled={used}
										accessibilityRole="button"
										accessibilityLabel={letter}
									>
										<Text style={[styles.keyText, { color: used ? "#fff" : theme.text }]}>
											{letter}
										</Text>
									</Pressable>
								);
							})}
						</RNView>
					))}
				</RNView>
			) : (
				<RNView style={styles.gameOverRow}>
					<Text
						style={[
							styles.gameOverText,
							{ color: isWon ? theme.successBorder : theme.danger },
						]}
					>
						{isWon ? t("hmCorrect") : t("hmFailed", { word })}
					</Text>
					<Pressable
						style={[styles.btn, { backgroundColor: theme.tint }]}
						onPress={nextRound}
						accessibilityRole="button"
						accessibilityLabel={round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
					>
						<Text style={[styles.btnText, { color: theme.onTint }]}>
							{round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
						</Text>
					</Pressable>
				</RNView>
			)}

			{current ? (
				<PassDeviceOverlay
					visible={phase === "handoff"}
					toPlayer={current}
					secret
					hint={t("hmPassToGuesserHint")}
					onReady={startRound}
				/>
			) : null}

			{phase === "result" && solo ? (
				<GameResult
					title={t("gameDuelHangmanName")}
					score={scores[0]}
					isNewBest={progress?.isNewBest}
					best={progress?.best}
					last={progress?.previousBest}
					streak={progress?.currentStreak}
					onPlayAgain={() => startMatch(players)}
				/>
			) : null}
			{phase === "result" && !solo ? (
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
	root: { flex: 1, alignItems: "stretch", padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	roundChip: { ...TextStyle.chipLabel },
	soloScore: { ...TextStyle.statValueMedium, textAlign: "center" },
	gallowsBox: { width: 112, height: 120, position: "relative", alignSelf: "center", marginTop: Spacing.xs },
	gallowBase: { position: "absolute", bottom: 0, left: 10, width: 60, height: 3, borderRadius: 1.5 },
	gallowPole: { position: "absolute", bottom: 0, left: 25, width: 3, height: 110, borderRadius: 1.5 },
	gallowTop: { position: "absolute", top: 0, left: 25, width: 33, height: 3, borderRadius: 1.5 },
	gallowRope: { position: "absolute", top: 3, left: 55, width: 2.5, height: 27, borderRadius: 1 },
	wordRow: { flexDirection: "row", flexWrap: "nowrap", justifyContent: "center" },
	wordScroll: { maxWidth: "100%", flexGrow: 0 },
	wordScrollContent: { flexGrow: 1, justifyContent: "center" },
	letterSlot: { height: 40, alignItems: "center", justifyContent: "flex-end", borderBottomWidth: 3 },
	letterChar: { fontWeight: FontWeight.black },
	wrongHint: { ...TextStyle.hint, textAlign: "center" },
	keyboard: { gap: 6, width: "100%", marginTop: Spacing.xs },
	keyRow: { flexDirection: "row", gap: 4, justifyContent: "center" },
	key: { width: 34, height: 44, borderRadius: Radius.sm + 2, alignItems: "center", justifyContent: "center" },
	keyText: { fontSize: FontSize.md - 1, fontWeight: FontWeight.bold },
	gameOverRow: { alignItems: "center", gap: Spacing.md, marginTop: Spacing.sm },
	gameOverText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, textAlign: "center" },
	btn: { paddingHorizontal: Spacing["4xl"], paddingVertical: Spacing.lg, borderRadius: Radius.button },
	btnText: { ...TextStyle.buttonSecondary },
});
