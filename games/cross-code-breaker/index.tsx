import { useState, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Text, View } from "@/components/Themed";
import GameResult from "@/components/GameResult";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

const CODE_LEN = 4;
const MAX_GUESSES = 10;
type Phase = "setSecret" | "play" | "done";

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

type GuessEntry = { digits: number[]; bulls: number; cows: number };

export default function CrossCodeBreakerGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("setSecret");

	// Secret code (this player's secret, judged locally)
	const [secret, setSecret] = useState<number[]>([]);
	const [secretInput, setSecretInput] = useState<number[]>([]);

	// Judge tab: opponent's guesses checked against my secret
	const [judgeInput, setJudgeInput] = useState<number[]>([]);
	const [judgeHistory, setJudgeHistory] = useState<GuessEntry[]>([]);
	const [judgeResult, setJudgeResult] = useState<{
		bulls: number;
		cows: number;
	} | null>(null);

	// Notes tab: my guesses + results I manually log
	const [noteInput, setNoteInput] = useState<number[]>([]);
	const [noteBulls, setNoteBulls] = useState(0);
	const [noteCows, setNoteCows] = useState(0);
	const [noteHistory, setNoteHistory] = useState<GuessEntry[]>([]);

	const [activeTab, setActiveTab] = useState<"judge" | "notes">("judge");
	const [winner, setWinner] = useState<"me" | "opp" | null>(null);

	// Secret input
	const addSecretDigit = (d: number) => {
		if (secretInput.length >= CODE_LEN) return;
		if (secretInput.includes(d)) {
			haptic.error();
			return;
		}
		setSecretInput((prev) => [...prev, d]);
		haptic.tap();
	};

	const removeSecretDigit = () => {
		setSecretInput((prev) => prev.slice(0, -1));
	};

	const confirmSecret = () => {
		if (secretInput.length !== CODE_LEN) return;
		setSecret([...secretInput]);
		setPhase("play");
		haptic.success();
	};

	// Judge: enter opponent's guess
	const addJudgeDigit = (d: number) => {
		if (judgeInput.length >= CODE_LEN) return;
		setJudgeInput((prev) => [...prev, d]);
		haptic.tap();
	};

	const checkJudge = () => {
		if (judgeInput.length !== CODE_LEN) return;
		const result = calcBullsCows(secret, judgeInput);
		setJudgeResult(result);
		setJudgeHistory((prev) => [
			...prev,
			{ digits: [...judgeInput], ...result },
		]);
		(result.bulls === CODE_LEN ? haptic.error() : haptic.tap());

		if (result.bulls === CODE_LEN) {
			// Opponent cracked my code
			setWinner("opp");
			setPhase("done");
			updateProgress("cross-code-breaker", noteHistory.length * 5);
		}
	};

	const clearJudge = () => {
		setJudgeInput([]);
		setJudgeResult(null);
	};

	// Notes: log my guess + opponent's response
	const addNoteDigit = (d: number) => {
		if (noteInput.length >= CODE_LEN) return;
		setNoteInput((prev) => [...prev, d]);
		haptic.tap();
	};

	const logNote = () => {
		if (noteInput.length !== CODE_LEN) return;
		setNoteHistory((prev) => [
			...prev,
			{ digits: [...noteInput], bulls: noteBulls, cows: noteCows },
		]);

		if (noteBulls === CODE_LEN) {
			setWinner("me");
			setPhase("done");
			updateProgress(
				"cross-code-breaker",
				Math.max(10, (MAX_GUESSES - noteHistory.length) * 10),
			);
		}

		setNoteInput([]);
		setNoteBulls(0);
		setNoteCows(0);
		haptic.tap();
	};

	const restart = () => {
		setPhase("setSecret");
		setSecret([]);
		setSecretInput([]);
		setJudgeInput([]);
		setJudgeHistory([]);
		setJudgeResult(null);
		setNoteInput([]);
		setNoteBulls(0);
		setNoteCows(0);
		setNoteHistory([]);
		setActiveTab("judge");
		setWinner(null);
	};

	// --- Numpad ---
	const renderNumpad = (onDigit: (d: number) => void, onDelete: () => void) => (
		<View style={styles.numpad}>
			{[
				[1, 2, 3, 4, 5],
				[6, 7, 8, 9, 0],
			].map((row, ri) => (
				<View key={ri} style={styles.numRow}>
					{row.map((d) => (
						<Pressable
							key={d}
							onPress={() => onDigit(d)}
							style={[
								styles.numKey,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
						>
							<Text style={styles.numKeyText}>{d}</Text>
						</Pressable>
					))}
				</View>
			))}
			<Pressable
				onPress={onDelete}
				style={[
					styles.deleteKey,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.numKeyText, { color: "#ef5350" }]}>⌫</Text>
			</Pressable>
		</View>
	);

	// --- Code display ---
	const renderCode = (digits: number[], length: number) => (
		<View style={styles.codeRow}>
			{Array.from({ length }).map((_, i) => (
				<View
					key={i}
					style={[
						styles.codeSlot,
						{
							backgroundColor: digits[i] != null ? theme.tint : theme.card,
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
						{digits[i] != null ? digits[i] : "—"}
					</Text>
				</View>
			))}
		</View>
	);

	// --- Guess history row ---
	const renderHistoryRow = (entry: GuessEntry, idx: number) => (
		<View
			key={idx}
			style={[
				styles.historyRow,
				{ backgroundColor: theme.card, borderColor: theme.border },
			]}
		>
			<Text style={styles.historyIdx}>{idx + 1}.</Text>
			<Text style={styles.historyDigits}>{entry.digits.join(" ")}</Text>
			<View style={styles.historyResult}>
				<Text style={[styles.historyBull, { color: "#4caf50" }]}>
					{entry.bulls}🎯
				</Text>
				<Text style={[styles.historyCow, { color: "#ff9800" }]}>
					{entry.cows}🔄
				</Text>
			</View>
		</View>
	);

	// --- PHASE: SET SECRET ---
	if (phase === "setSecret") {
		return (
			<View style={styles.container}>
				<Animated.View entering={FadeInDown.duration(300)}>
					<Text style={styles.title}>{t("cbSetSecret")}</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("cbSecretHint")}
					</Text>
				</Animated.View>

				{renderCode(secretInput, CODE_LEN)}

				{renderNumpad(addSecretDigit, removeSecretDigit)}

				{secretInput.length === CODE_LEN && (
					<Animated.View entering={ZoomIn.duration(200)}>
						<Pressable
							onPress={confirmSecret}
							style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
						>
							<Text style={styles.primaryBtnText}>{t("cbConfirm")}</Text>
						</Pressable>
					</Animated.View>
				)}
			</View>
		);
	}

	// --- PHASE: DONE ---
	if (phase === "done") {
		return (
			<GameResult
				title={winner === "me" ? t("cbYouCracked") : t("cbTheyCracked")}
				score={
					winner === "me"
						? Math.max(10, (MAX_GUESSES - noteHistory.length) * 10)
						: 0
				}
				subtitle={`${t("cbGuessesUsed")}: ${winner === "me" ? noteHistory.length : judgeHistory.length}`}
				onPlayAgain={restart}
			/>
		);
	}

	// --- PHASE: PLAY ---
	return (
		<View style={styles.container}>
			{/* Secret indicator */}
			<Text style={[styles.secretLabel, { color: theme.mutedText }]}>
				{t("cbYourSecret")}: ● ● ● ●
			</Text>

			{/* Tab bar */}
			<View style={styles.tabBar}>
				{(["judge", "notes"] as const).map((tb) => (
					<Pressable
						key={tb}
						onPress={() => setActiveTab(tb)}
						style={[
							styles.tabBtn,
							{
								backgroundColor: activeTab === tb ? theme.tint : theme.card,
								borderColor: activeTab === tb ? theme.tint : theme.border,
							},
						]}
					>
						<Text
							style={[
								styles.tabBtnText,
								{ color: activeTab === tb ? "#fff" : theme.text },
							]}
						>
							{tb === "judge" ? t("cbJudgeTab") : t("cbNotesTab")}
						</Text>
					</Pressable>
				))}
			</View>

			{activeTab === "judge" ? (
				<ScrollView
					style={styles.scrollArea}
					contentContainerStyle={styles.scrollContent}
				>
					<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
						{t("cbJudgeHint")}
					</Text>

					{renderCode(judgeInput, CODE_LEN)}

					{judgeResult ? (
						<Animated.View
							entering={ZoomIn.duration(200)}
							style={styles.resultBox}
						>
							<Text style={styles.resultText}>
								{t("cbAnnounce")}:{" "}
								<Text style={{ color: "#4caf50" }}>{judgeResult.bulls}🎯</Text>{" "}
								<Text style={{ color: "#ff9800" }}>{judgeResult.cows}🔄</Text>
							</Text>
							<Pressable
								onPress={clearJudge}
								style={[
									styles.smallBtn,
									{ backgroundColor: theme.card, borderColor: theme.border },
								]}
							>
								<Text style={{ fontWeight: "700" }}>{t("cbNext")}</Text>
							</Pressable>
						</Animated.View>
					) : (
						<View style={styles.checkRow}>
							{renderNumpad(addJudgeDigit, () =>
								setJudgeInput((p) => p.slice(0, -1)),
							)}
							{judgeInput.length === CODE_LEN && (
								<Pressable
									onPress={checkJudge}
									style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
								>
									<Text style={styles.primaryBtnText}>{t("cbCheck")}</Text>
								</Pressable>
							)}
						</View>
					)}

					{judgeHistory.length > 0 && (
						<View style={styles.historySection}>
							<Text style={[styles.historyTitle, { color: theme.mutedText }]}>
								{t("cbHistory")}
							</Text>
							{judgeHistory.map(renderHistoryRow)}
						</View>
					)}
				</ScrollView>
			) : (
				<ScrollView
					style={styles.scrollArea}
					contentContainerStyle={styles.scrollContent}
				>
					<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
						{t("cbNotesHint")}
					</Text>

					{renderCode(noteInput, CODE_LEN)}

					{renderNumpad(addNoteDigit, () =>
						setNoteInput((p) => p.slice(0, -1)),
					)}

					{noteInput.length === CODE_LEN && (
						<View style={styles.bcInputRow}>
							<View style={styles.bcSelector}>
								<Text style={{ fontWeight: "600" }}>🎯</Text>
								{[0, 1, 2, 3, 4].map((n) => (
									<Pressable
										key={n}
										onPress={() => {
											setNoteBulls(n);
											// Ensure bulls + cows <= CODE_LEN
											if (n + noteCows > CODE_LEN) setNoteCows(CODE_LEN - n);
										}}
										style={[
											styles.bcChip,
											{
												backgroundColor:
													noteBulls === n ? "#4caf50" : theme.card,
												borderColor: theme.border,
											},
										]}
									>
										<Text
											style={{
												color: noteBulls === n ? "#fff" : theme.text,
												fontWeight: "700",
											}}
										>
											{n}
										</Text>
									</Pressable>
								))}
							</View>
							<View style={styles.bcSelector}>
								<Text style={{ fontWeight: "600" }}>🔄</Text>
								{[0, 1, 2, 3, 4].map((n) => (
									<Pressable
										key={n}
										onPress={() => {
											setNoteCows(n);
											if (noteBulls + n > CODE_LEN) setNoteBulls(CODE_LEN - n);
										}}
										style={[
											styles.bcChip,
											{
												backgroundColor:
													noteCows === n ? "#ff9800" : theme.card,
												borderColor: theme.border,
											},
										]}
									>
										<Text
											style={{
												color: noteCows === n ? "#fff" : theme.text,
												fontWeight: "700",
											}}
										>
											{n}
										</Text>
									</Pressable>
								))}
							</View>
							<Pressable
								onPress={logNote}
								style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
							>
								<Text style={styles.primaryBtnText}>{t("cbLog")}</Text>
							</Pressable>
						</View>
					)}

					{noteHistory.length > 0 && (
						<View style={styles.historySection}>
							<Text style={[styles.historyTitle, { color: theme.mutedText }]}>
								{t("cbMyGuesses")}
							</Text>
							{noteHistory.map(renderHistoryRow)}
						</View>
					)}
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", paddingTop: 10 },
	title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
	subtitle: {
		fontSize: 14,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 12,
	},
	// Code slots
	codeRow: { flexDirection: "row", gap: 10, marginVertical: 12 },
	codeSlot: {
		width: 50,
		height: 56,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	codeDigit: { fontSize: 26, fontWeight: "800" },
	// Numpad
	numpad: { alignItems: "center", gap: 6, marginVertical: 8 },
	numRow: { flexDirection: "row", gap: 6 },
	numKey: {
		width: 50,
		height: 44,
		borderRadius: 8,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	numKeyText: { fontSize: 20, fontWeight: "700" },
	deleteKey: {
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		alignSelf: "flex-end",
	},
	// Buttons
	primaryBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 12,
		marginTop: 8,
	},
	primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
	smallBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		marginTop: 6,
	},
	// Tab bar
	secretLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
	tabBar: { flexDirection: "row", gap: 10, marginBottom: 6, width: "90%" },
	tabBtn: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: "center",
	},
	tabBtnText: { fontSize: 14, fontWeight: "700" },
	// Scroll
	scrollArea: { flex: 1, width: "100%" },
	scrollContent: { alignItems: "center", paddingBottom: 20 },
	sectionHint: {
		fontSize: 13,
		textAlign: "center",
		marginBottom: 6,
		paddingHorizontal: 16,
	},
	// Check row
	checkRow: { alignItems: "center" },
	// Result box
	resultBox: { alignItems: "center", marginVertical: 8 },
	resultText: { fontSize: 18, fontWeight: "700" },
	// BC input
	bcInputRow: { alignItems: "center", gap: 8, marginTop: 8 },
	bcSelector: { flexDirection: "row", gap: 6, alignItems: "center" },
	bcChip: {
		width: 34,
		height: 34,
		borderRadius: 8,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	// History
	historySection: { width: "90%", marginTop: 14, gap: 4 },
	historyTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
	historyRow: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
		gap: 8,
	},
	historyIdx: { fontSize: 13, fontWeight: "600", width: 24 },
	historyDigits: { fontSize: 16, fontWeight: "700", flex: 1, letterSpacing: 4 },
	historyResult: { flexDirection: "row", gap: 8 },
	historyBull: { fontSize: 14, fontWeight: "700" },
	historyCow: { fontSize: 14, fontWeight: "700" },
});
