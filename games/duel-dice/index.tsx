import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";

const ROUNDS = 7;
const { width: SCREEN_W } = Dimensions.get("window");
const DIE_SIZE = SCREEN_W * 0.72;
const PIP_SIZE = DIE_SIZE * 0.14;
const DIE_RADIUS = DIE_SIZE * 0.16;

const FACE_PIPS: Record<number, number[]> = {
	1: [4],
	2: [0, 8],
	3: [0, 4, 8],
	4: [0, 2, 6, 8],
	5: [0, 2, 4, 6, 8],
	6: [0, 2, 3, 5, 6, 8],
};

const PIP_KEYS = [
	"p0",
	"p1",
	"p2",
	"p3",
	"p4",
	"p5",
	"p6",
	"p7",
	"p8",
] as const;

function rollDie(): number {
	return Math.floor(Math.random() * 6) + 1;
}

export default function DuelDiceGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();

	const [round, setRound] = useState(1);
	const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
	const [playerOneTotal, setPlayerOneTotal] = useState(0);
	const [playerTwoTotal, setPlayerTwoTotal] = useState(0);
	const [playerOneRoundWins, setPlayerOneRoundWins] = useState(0);
	const [playerTwoRoundWins, setPlayerTwoRoundWins] = useState(0);
	const [currentRoundP1, setCurrentRoundP1] = useState<number | null>(null);
	const [rollingValue, setRollingValue] = useState<number | null>(null);
	const [isRolling, setIsRolling] = useState(false);
	const [roundResult, setRoundResult] = useState<string | null>(null);

	const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const roundTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const finalResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isFinished = round > ROUNDS;

	useEffect(() => {
		return () => {
			if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
			if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
			if (roundTransitionRef.current) clearTimeout(roundTransitionRef.current);
			if (finalResetRef.current) clearTimeout(finalResetRef.current);
		};
	}, []);

	const winnerText = useMemo(() => {
		if (!isFinished) return null;
		if (playerOneRoundWins === playerTwoRoundWins) {
			if (playerOneTotal === playerTwoTotal) return t("diceDraw");
			return playerOneTotal > playerTwoTotal
				? t("dicePlayerWins", { player: "1" })
				: t("dicePlayerWins", { player: "2" });
		}
		return playerOneRoundWins > playerTwoRoundWins
			? t("dicePlayerWins", { player: "1" })
			: t("dicePlayerWins", { player: "2" });
	}, [
		isFinished,
		playerOneRoundWins,
		playerTwoRoundWins,
		playerOneTotal,
		playerTwoTotal,
		t,
	]);

	const finalizePlayerRoll = (player: 1 | 2, finalRoll: number) => {
		setRollingValue(finalRoll);
		setIsRolling(false);

		if (player === 1) {
			setPlayerOneTotal((prev) => prev + finalRoll);
			setCurrentRoundP1(finalRoll);
			setActivePlayer(2);
			return;
		}

		const p1Roll = currentRoundP1;
		const nextPlayerOneTotal = playerOneTotal;
		const nextPlayerTwoTotal = playerTwoTotal + finalRoll;
		setPlayerTwoTotal(nextPlayerTwoTotal);

		let resultText = t("diceRoundDraw");

		if (p1Roll !== null) {
			if (p1Roll > finalRoll) {
				resultText = t("dicePlayerWinsRound", { player: "1" });
				setPlayerOneRoundWins((prev) => prev + 1);
			} else if (finalRoll > p1Roll) {
				resultText = t("dicePlayerWinsRound", { player: "2" });
				setPlayerTwoRoundWins((prev) => prev + 1);
			}
		}

		setRoundResult(resultText);

		const nextRound = round + 1;
		if (nextRound > ROUNDS) {
			const sessionScore = Math.max(nextPlayerOneTotal, nextPlayerTwoTotal);
			updateProgress("duel-dice", sessionScore);
		}

		roundTransitionRef.current = setTimeout(() => {
			setRound(nextRound);
			setActivePlayer(1);
			setCurrentRoundP1(null);
			setRoundResult(null);
			roundTransitionRef.current = null;
		}, 2000);
	};

	const handleRoll = (player: 1 | 2) => {
		if (isFinished || isRolling || player !== activePlayer) return;

		setIsRolling(true);
		setRollingValue(rollDie());

		rollingIntervalRef.current = setInterval(() => {
			setRollingValue(rollDie());
		}, 90);

		settleTimeoutRef.current = setTimeout(() => {
			if (rollingIntervalRef.current) {
				clearInterval(rollingIntervalRef.current);
				rollingIntervalRef.current = null;
			}
			finalizePlayerRoll(player, rollDie());
		}, 1100);
	};

	const resetMatch = useCallback(() => {
		if (rollingIntervalRef.current) {
			clearInterval(rollingIntervalRef.current);
			rollingIntervalRef.current = null;
		}
		if (settleTimeoutRef.current) {
			clearTimeout(settleTimeoutRef.current);
			settleTimeoutRef.current = null;
		}
		if (roundTransitionRef.current) {
			clearTimeout(roundTransitionRef.current);
			roundTransitionRef.current = null;
		}
		if (finalResetRef.current) {
			clearTimeout(finalResetRef.current);
			finalResetRef.current = null;
		}

		setRound(1);
		setActivePlayer(1);
		setPlayerOneTotal(0);
		setPlayerTwoTotal(0);
		setPlayerOneRoundWins(0);
		setPlayerTwoRoundWins(0);
		setCurrentRoundP1(null);
		setRollingValue(null);
		setIsRolling(false);
		setRoundResult(null);
	}, []);

	useEffect(() => {
		if (!winnerText) return;

		finalResetRef.current = setTimeout(() => {
			resetMatch();
			finalResetRef.current = null;
		}, 2000);

		return () => {
			if (finalResetRef.current) {
				clearTimeout(finalResetRef.current);
				finalResetRef.current = null;
			}
		};
	}, [winnerText, resetMatch]);

	const visiblePips =
		rollingValue && FACE_PIPS[rollingValue] ? FACE_PIPS[rollingValue] : [];

	const inRoundTransition = roundResult !== null;
	const p1Active =
		activePlayer === 1 && !isRolling && !isFinished && !inRoundTransition;
	const p2Active =
		activePlayer === 2 && !isRolling && !isFinished && !inRoundTransition;

	const p1Label = isFinished
		? t("diceWinsPts", { wins: playerOneRoundWins, pts: playerOneTotal })
		: p1Active
			? t("diceTapToRoll")
			: currentRoundP1 !== null
				? t("diceRolled", { value: currentRoundP1 })
				: t("diceWaiting");

	const p2Label = isFinished
		? t("diceWinsPts", { wins: playerTwoRoundWins, pts: playerTwoTotal })
		: p2Active
			? t("diceTapToRoll")
			: inRoundTransition
				? t("diceRolled", { value: rollingValue ?? "-" })
				: t("diceWaiting");

	return (
		<View style={styles.root}>
			{/* ─── Player 1 button ─── top, rotated 180° */}
			<Pressable
				style={[
					styles.playerBtn,
					styles.rotate180,
					{
						backgroundColor: p1Active ? theme.tint : theme.card,
						borderColor: p1Active ? theme.tint : theme.border,
					},
				]}
				onPress={() => handleRoll(1)}
			>
				<Text
					style={[
						styles.btnLabel,
						{ color: p1Active ? "#fff" : theme.mutedText },
					]}
				>
					{p1Label}
				</Text>
			</Pressable>

			{/* ─── Center: die + score strip ─── */}
			<View style={styles.center}>
				<View style={styles.scoreStrip}>
					<Text
						style={[
							styles.scorePlayer,
							{ color: theme.text, opacity: activePlayer === 1 ? 1 : 0.4 },
						]}
					>
						{t("diceP1")}
					</Text>
					<Text style={[styles.scoreValue, { color: theme.text }]}>
						{playerOneRoundWins} – {playerTwoRoundWins}
					</Text>
					<Text
						style={[
							styles.scorePlayer,
							{ color: theme.text, opacity: activePlayer === 2 ? 1 : 0.4 },
						]}
					>
						{t("diceP2")}
					</Text>
				</View>

				<View
					style={[
						styles.dieFace,
						{
							borderColor: isRolling ? theme.warning : theme.border,
							backgroundColor: theme.elevated,
						},
					]}
				>
					{Array.from({ length: 9 }).map((_, i) => (
						<View key={PIP_KEYS[i]} style={styles.pipCell}>
							{visiblePips.includes(i) ? (
								<View
									style={[
										styles.pip,
										{ backgroundColor: isRolling ? theme.warning : theme.text },
									]}
								/>
							) : null}
						</View>
					))}
				</View>

				<Text
					style={[
						styles.roundLabel,
						{ color: roundResult ? theme.tint : theme.mutedText },
					]}
				>
					{roundResult ??
						(isFinished
						? t("diceGameOver")
						: t("diceRoundOf", { round: Math.min(round, ROUNDS), total: ROUNDS }))}
				</Text>
			</View>

			{/* ─── Player 2 button ─── bottom */}
			<Pressable
				style={[
					styles.playerBtn,
					{
						backgroundColor: p2Active ? theme.tint : theme.card,
						borderColor: p2Active ? theme.tint : theme.border,
					},
				]}
				onPress={() => handleRoll(2)}
			>
				<Text
					style={[
						styles.btnLabel,
						{ color: p2Active ? "#fff" : theme.mutedText },
					]}
				>
					{p2Label}
				</Text>
			</Pressable>

			{/* ─── Winner overlay ─── */}
			{winnerText ? (
				<View style={[styles.overlay, { backgroundColor: theme.card + "ee" }]}>
					<Text style={[styles.winnerText, { color: theme.text }]}>
						{winnerText}
					</Text>
					<View style={styles.finalScores}>
						<Text style={[styles.finalLine, { color: theme.mutedText }]}>
						{t("diceRounds", { p1: playerOneRoundWins, p2: playerTwoRoundWins })}
					</Text>
					<Text style={[styles.finalLine, { color: theme.mutedText }]}>
						{t("diceTotal", { p1: playerOneTotal, p2: playerTwoTotal })}
					</Text>
				</View>
				<Text style={[styles.autoRestartText, { color: theme.mutedText }]}>
					{t("diceRestarting")}
					</Text>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: 0,
		paddingVertical: 8,
	},
	/* ── Player buttons ── */
	playerBtn: {
		marginHorizontal: 12,
		borderRadius: 16,
		borderWidth: 1.5,
		paddingVertical: 22,
		alignItems: "center",
		justifyContent: "center",
	},
	rotate180: {
		transform: [{ rotate: "180deg" }],
	},
	btnLabel: {
		fontSize: 18,
		fontWeight: "800",
		letterSpacing: 1.2,
		textTransform: "uppercase",
	},
	/* ── Center area ── */
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	scoreStrip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
	},
	scorePlayer: {
		fontSize: 14,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	scoreValue: {
		fontSize: 28,
		fontWeight: "900",
		letterSpacing: 2,
	},
	roundLabel: {
		fontSize: 13,
		fontWeight: "600",
	},
	/* ── Die ── */
	dieFace: {
		width: DIE_SIZE,
		height: DIE_SIZE,
		borderRadius: DIE_RADIUS,
		borderWidth: 2,
		padding: DIE_SIZE * 0.1,
		flexDirection: "row",
		flexWrap: "wrap",
		transform: [{ rotate: "90deg" }],
	},
	pipCell: {
		width: "33.33%",
		height: "33.33%",
		alignItems: "center",
		justifyContent: "center",
	},
	pip: {
		width: PIP_SIZE,
		height: PIP_SIZE,
		borderRadius: 999,
	},
	/* ── Winner overlay ── */
	overlay: {
		...StyleSheet.absoluteFillObject,
		alignItems: "center",
		justifyContent: "center",
		gap: 16,
		zIndex: 10,
	},
	winnerText: {
		fontSize: 32,
		fontWeight: "900",
		letterSpacing: 1,
	},
	finalScores: {
		alignItems: "center",
		gap: 4,
	},
	finalLine: {
		fontSize: 15,
		fontWeight: "600",
	},
	autoRestartText: {
		fontSize: 14,
		fontWeight: "700",
		marginTop: 8,
	},
});
