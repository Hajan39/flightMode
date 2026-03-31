import { useState, useMemo } from "react";
import {
	Dimensions,
	Pressable,
	StyleSheet,
	View as RNView,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";
import { pickWord, type Difficulty } from "./words";
import type { TranslationKey } from "@/i18n/translations";

const MAX_WRONG = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const KEY_ROWS = [
	ALPHABET.slice(0, 9),
	ALPHABET.slice(9, 18),
	ALPHABET.slice(18, 26),
];

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
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

/* ── Hangman figure parts ── */
const PARTS: ((color: string) => React.ReactNode)[] = [
	// head
	(c) => (
		<RNView
			key="head"
			style={{
				position: "absolute",
				top: 30,
				left: 44,
				width: 24,
				height: 24,
				borderRadius: 12,
				borderWidth: 2.5,
				borderColor: c,
			}}
		/>
	),
	// body
	(c) => (
		<RNView
			key="body"
			style={{
				position: "absolute",
				top: 54,
				left: 55,
				width: 2.5,
				height: 30,
				backgroundColor: c,
			}}
		/>
	),
	// left arm
	(c) => (
		<RNView
			key="larm"
			style={{
				position: "absolute",
				top: 60,
				left: 40,
				width: 16,
				height: 2.5,
				backgroundColor: c,
				transform: [{ rotate: "30deg" }],
			}}
		/>
	),
	// right arm
	(c) => (
		<RNView
			key="rarm"
			style={{
				position: "absolute",
				top: 60,
				left: 57,
				width: 16,
				height: 2.5,
				backgroundColor: c,
				transform: [{ rotate: "-30deg" }],
			}}
		/>
	),
	// left leg
	(c) => (
		<RNView
			key="lleg"
			style={{
				position: "absolute",
				top: 82,
				left: 42,
				width: 16,
				height: 2.5,
				backgroundColor: c,
				transform: [{ rotate: "-30deg" }],
			}}
		/>
	),
	// right leg
	(c) => (
		<RNView
			key="rleg"
			style={{
				position: "absolute",
				top: 82,
				left: 54,
				width: 16,
				height: 2.5,
				backgroundColor: c,
				transform: [{ rotate: "30deg" }],
			}}
		/>
	),
];

export default function DuelHangmanGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t, language } = useTranslation();
	const haptic = useHaptic();

	const [difficulty, setDifficulty] = useState<Difficulty>("medium");
	const [word, setWord] = useState(() => pickWord(language, "medium"));
	const [guessed, setGuessed] = useState<Set<string>>(new Set());
	const [scoreP1, setScoreP1] = useState(0);
	const [scoreP2, setScoreP2] = useState(0);
	const [round, setRound] = useState(1);
	const [guesser, setGuesser] = useState<1 | 2>(2); // P1 picks first, P2 guesses
	const [phase, setPhase] = useState<"difficulty" | "playing" | "result">(
		"difficulty",
	);

	const wrongCount = useMemo(
		() => [...guessed].filter((l) => !word.includes(l)).length,
		[guessed, word],
	);

	const isWon = useMemo(
		() => word.split("").every((l) => guessed.has(l)),
		[word, guessed],
	);
	const isLost = wrongCount >= MAX_WRONG;
	const gameOver = isWon || isLost;

	const handleGuess = (letter: string) => {
		if (gameOver || guessed.has(letter)) return;
		const next = new Set(guessed);
		next.add(letter);
		setGuessed(next);

		if (word.includes(letter)) {
			haptic.success();
		} else {
			haptic.error();
		}

		// Check if that guess ended the game
		const won = word.split("").every((l) => next.has(l));
		const lost = [...next].filter((l) => !word.includes(l)).length >= MAX_WRONG;

		if (won) {
			// Guesser gets points
			if (guesser === 1) setScoreP1((s) => s + 10);
			else setScoreP2((s) => s + 10);
		} else if (lost) {
			// Word picker gets points
			if (guesser === 1) setScoreP2((s) => s + 10);
			else setScoreP1((s) => s + 10);
		}
	};

	const nextRound = () => {
		if (round >= 6) {
			updateProgress("duel-hangman", Math.max(scoreP1, scoreP2));
			setPhase("result");
			return;
		}
		setRound((r) => r + 1);
		setGuesser(guesser === 1 ? 2 : 1);
		setWord(pickWord(language, difficulty));
		setGuessed(new Set());
	};

	const restart = () => {
		setScoreP1(0);
		setScoreP2(0);
		setRound(1);
		setGuesser(2);
		setPhase("difficulty");
		setGuessed(new Set());
	};

	const startGame = (d: Difficulty) => {
		setDifficulty(d);
		setWord(pickWord(language, d));
		setGuessed(new Set());
		setPhase("playing");
	};

	// Difficulty selector
	if (phase === "difficulty") {
		return (
			<View style={styles.root}>
				<Text style={styles.title}>{t("gameDuelHangmanName")}</Text>
				<Text style={[styles.diffHint, { color: theme.mutedText }]}>
					{t("hmPickDifficulty")}
				</Text>
				<RNView style={styles.diffRow}>
					{DIFFICULTIES.map((d) => (
						<Pressable
							key={d}
							onPress={() => startGame(d)}
							style={[
								styles.diffBtn,
								{
									backgroundColor: theme.card,
									borderColor: theme.border,
								},
							]}
						>
							<Text style={[styles.diffEmoji]}>
								{d === "easy" ? "✈️" : d === "medium" ? "🛩️" : "🚀"}
							</Text>
							<Text style={[styles.diffLabel, { color: theme.text }]}>
							{t(DIFF_LABELS[d])}
						</Text>
						<Text style={[styles.diffMeta, { color: theme.mutedText }]}>
							{t(DIFF_HINTS[d])}
							</Text>
						</Pressable>
					))}
				</RNView>
			</View>
		);
	}

	// Final result
	if (phase === "result") {
		const winner =
			scoreP1 > scoreP2
				? t("c4Player1")
				: scoreP2 > scoreP1
					? t("c4Player2")
					: null;
		return (
			<View style={styles.root}>
				<Text style={styles.title}>
					{winner ? t("hmWins", { player: winner }) : t("hmDraw")}
				</Text>
				<RNView style={styles.finalRow}>
					<RNView style={styles.finalBlock}>
						<Text style={[styles.finalLabel, { color: theme.mutedText }]}>
							{t("c4Player1")}
						</Text>
						<Text style={[styles.finalNum, { color: "#ef5350" }]}>
							{scoreP1}
						</Text>
					</RNView>
					<Text style={[styles.finalVs, { color: theme.mutedText }]}>vs</Text>
					<RNView style={styles.finalBlock}>
						<Text style={[styles.finalLabel, { color: theme.mutedText }]}>
							{t("c4Player2")}
						</Text>
						<Text style={[styles.finalNum, { color: "#ffd54f" }]}>
							{scoreP2}
						</Text>
					</RNView>
				</RNView>
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={restart}
				>
					<Text style={styles.btnText}>{t("playAgain")}</Text>
				</Pressable>
			</View>
		);
	}

	const figureColor = colorScheme === "dark" ? "#fff" : "#1a1a2e";

	return (
		<View style={styles.root}>
			{/* HUD */}
			<RNView style={styles.hud}>
				<RNView style={styles.hudSide}>
					<RNView style={[styles.hudDot, { backgroundColor: "#ef5350" }]} />
					<Text style={[styles.hudNum, { color: "#ef5350" }]}>{scoreP1}</Text>
				</RNView>
				<RNView style={styles.hudCenter}>
					<Text style={[styles.roundText, { color: theme.mutedText }]}>
						{t("hmRound", { round, total: 6 })}
					</Text>
					<Text style={[styles.guesserHint, { color: theme.tint }]}>
						{t("hmGuesser", { player: String(guesser) })}
					</Text>
				</RNView>
				<RNView style={styles.hudSide}>
					<RNView style={[styles.hudDot, { backgroundColor: "#ffd54f" }]} />
					<Text style={[styles.hudNum, { color: "#ffd54f" }]}>{scoreP2}</Text>
				</RNView>
			</RNView>

			{/* Gallows + figure */}
			<RNView style={styles.gallowsBox}>
				{/* Gallows frame */}
				<RNView style={[styles.gallowBase, { backgroundColor: figureColor }]} />
				<RNView style={[styles.gallowPole, { backgroundColor: figureColor }]} />
				<RNView style={[styles.gallowTop, { backgroundColor: figureColor }]} />
				<RNView style={[styles.gallowRope, { backgroundColor: figureColor }]} />
				{/* Body parts revealed by wrong guesses */}
				{PARTS.slice(0, wrongCount).map((fn) => fn(figureColor))}
			</RNView>

			{/* Word display */}
			<RNView style={styles.wordRow}>
				{word.split("").map((letter, i) => {
					const screenW = Dimensions.get("window").width - 32;
					const gap = word.length > 10 ? 4 : 8;
					const slotW = Math.min(32, (screenW - (word.length - 1) * gap) / word.length);
					const fontSize = slotW > 24 ? 24 : Math.max(14, slotW - 4);
					return (
					<RNView
						key={`w-${i}`}
						style={[
							styles.letterSlot,
							{
								width: slotW,
								marginHorizontal: gap / 2,
								borderBottomColor: gameOver
									? isWon
										? "#66bb6a"
										: "#ef5350"
									: theme.tint,
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
											? "#ef5350"
											: "transparent",
								},
							]}
						>
							{guessed.has(letter) || gameOver ? letter : "_"}
						</Text>
					</RNView>
					);
				})}
			</RNView>

			{/* Wrong guesses count */}
			<Text style={[styles.wrongHint, { color: theme.mutedText }]}>
				{t("hmWrongCount", { count: wrongCount, max: MAX_WRONG })}
			</Text>

			{/* Keyboard */}
			{!gameOver ? (
				<RNView style={styles.keyboard}>
					{KEY_ROWS.map((row, ri) => (
						<RNView key={`kr-${ri}`} style={styles.keyRow}>
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
													? "#66bb6a"
													: wrong
														? "#ef5350"
														: theme.elevated,
												opacity: used ? 0.5 : 1,
											},
										]}
										onPress={() => handleGuess(letter)}
										disabled={used}
									>
										<Text
											style={[
												styles.keyText,
												{ color: used ? "#fff" : theme.text },
											]}
										>
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
							{ color: isWon ? "#66bb6a" : "#ef5350" },
						]}
					>
						{isWon ? t("hmCorrect") : t("hmFailed", { word })}
					</Text>
					<Pressable
						style={[styles.btn, { backgroundColor: theme.tint }]}
						onPress={nextRound}
					>
						<Text style={styles.btnText}>
							{round >= 6 ? t("hmSeeResult") : t("hmNextRound")}
						</Text>
					</Pressable>
				</RNView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, alignItems: "center", padding: 16, paddingTop: 8 },
	title: { fontSize: 24, fontWeight: "900", marginBottom: 8 },
	hud: {
		flexDirection: "row",
		width: "100%",
		alignItems: "center",
		marginBottom: 4,
	},
	hudSide: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	hudDot: { width: 10, height: 10, borderRadius: 5 },
	hudNum: { fontSize: 24, fontWeight: "900" },
	hudCenter: { alignItems: "center" },
	roundText: { fontSize: 11, fontWeight: "700" },
	guesserHint: { fontSize: 13, fontWeight: "800" },
	gallowsBox: {
		width: 112,
		height: 120,
		position: "relative",
		marginBottom: 8,
	},
	gallowBase: {
		position: "absolute",
		bottom: 0,
		left: 10,
		width: 60,
		height: 3,
		borderRadius: 1.5,
	},
	gallowPole: {
		position: "absolute",
		bottom: 0,
		left: 25,
		width: 3,
		height: 110,
		borderRadius: 1.5,
	},
	gallowTop: {
		position: "absolute",
		top: 0,
		left: 25,
		width: 33,
		height: 3,
		borderRadius: 1.5,
	},
	gallowRope: {
		position: "absolute",
		top: 3,
		left: 55,
		width: 2.5,
		height: 27,
		borderRadius: 1,
	},
	wordRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		marginBottom: 8,
	},
	letterSlot: {
		height: 40,
		alignItems: "center",
		justifyContent: "flex-end",
		borderBottomWidth: 3,
	},
	letterChar: { fontWeight: "900" },
	wrongHint: { fontSize: 12, fontWeight: "600", marginBottom: 10 },
	keyboard: { gap: 6, width: "100%" },
	keyRow: { flexDirection: "row", gap: 4, justifyContent: "center" },
	key: {
		width: 34,
		height: 40,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	keyText: { fontSize: 15, fontWeight: "700" },
	gameOverRow: { alignItems: "center", gap: 12, marginTop: 8 },
	gameOverText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
	btn: {
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 12,
	},
	btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
	finalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 20,
		marginTop: 8,
		marginBottom: 4,
	},
	finalBlock: { alignItems: "center", gap: 2 },
	finalLabel: { fontSize: 12, fontWeight: "700" },
	finalNum: { fontSize: 36, fontWeight: "900" },
	finalVs: { fontSize: 16, fontWeight: "700" },
	// Difficulty screen
	diffHint: { fontSize: 14, textAlign: "center", marginBottom: 16 },
	diffRow: { flexDirection: "row", gap: 12, marginTop: 4 },
	diffBtn: {
		flex: 1,
		alignItems: "center",
		gap: 6,
		padding: 14,
		borderWidth: 1,
		borderRadius: 14,
	},
	diffEmoji: { fontSize: 28 },
	diffLabel: { fontSize: 15, fontWeight: "800" },
	diffMeta: { fontSize: 11, textAlign: "center" },
});
