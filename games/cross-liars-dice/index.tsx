import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	View as RNView,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

const STARTING_DICE = 5;
const FACES = [1, 2, 3, 4, 5, 6] as const;
const DICE_EMOJI: Record<number, string> = {
	1: "⚀",
	2: "⚁",
	3: "⚂",
	4: "⚃",
	5: "⚄",
	6: "⚅",
};
const MAX_PLAYERS = 6;
const PLAYER_COLORS = [
	"#4FC3F7",
	"#FF8A65",
	"#81C784",
	"#CE93D8",
	"#FFD54F",
	"#4DD0E1",
];

type Phase = "setup" | "peek" | "bid" | "reveal" | "done";
type Bid = { qty: number; face: number };

function rollDice(count: number): number[] {
	return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export default function CrossLiarsDiceGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	/* setup */
	const [playerCount, setPlayerCount] = useState(2);
	const [phase, setPhase] = useState<Phase>("setup");

	/* round state */
	const [diceCounts, setDiceCounts] = useState<number[]>([]);
	const [allDice, setAllDice] = useState<number[][]>([]);
	const [roundNum, setRoundNum] = useState(1);

	/* peek */
	const [currentPeeker, setCurrentPeeker] = useState(0);
	const [showingDice, setShowingDice] = useState(false);
	const [peekStartIndex, setPeekStartIndex] = useState(0);

	/* bid */
	const [currentBidder, setCurrentBidder] = useState(0);
	const [currentBid, setCurrentBid] = useState<Bid | null>(null);
	const [lastBidder, setLastBidder] = useState(-1);
	const [bidQty, setBidQty] = useState(1);
	const [bidFace, setBidFace] = useState(2);

	/* reveal */
	const [revealResult, setRevealResult] = useState<{
		liar: boolean;
		total: number;
		loser: number;
	} | null>(null);

	const totalDice = diceCounts.reduce((a, b) => a + b, 0);

	function nextActive(from: number, counts?: number[]): number {
		const dc = counts ?? diceCounts;
		let idx = from;
		for (let i = 0; i < playerCount; i++) {
			idx = (idx + 1) % playerCount;
			if (dc[idx] > 0) return idx;
		}
		return from;
	}

	function firstActive(counts?: number[]): number {
		const dc = counts ?? diceCounts;
		return dc.findIndex((c) => c > 0);
	}

	/* actions */
	const startGame = () => {
		const counts = Array(playerCount).fill(STARTING_DICE);
		setDiceCounts(counts);
		setAllDice(counts.map((c) => rollDice(c)));
		setRoundNum(1);
		setCurrentPeeker(0);
		setPeekStartIndex(0);
		setShowingDice(false);
		setCurrentBid(null);
		setLastBidder(-1);
		setBidQty(1);
		setBidFace(2);
		setRevealResult(null);
		setPhase("peek");
	};

	const peekDone = () => {
		setShowingDice(false);
		const next = nextActive(currentPeeker);
		if (next === peekStartIndex) {
			/* everyone has peeked — start bidding */
			setCurrentBidder(peekStartIndex);
			setPhase("bid");
		} else {
			setCurrentPeeker(next);
		}
	};

	const isValidBid = (qty: number, face: number): boolean => {
		if (!currentBid) return true;
		if (qty > currentBid.qty) return true;
		if (qty === currentBid.qty && face > currentBid.face) return true;
		return false;
	};

	const placeBid = () => {
		if (!isValidBid(bidQty, bidFace)) {
			haptic.error();
			return;
		}
		setCurrentBid({ qty: bidQty, face: bidFace });
		setLastBidder(currentBidder);
		const next = nextActive(currentBidder);
		setCurrentBidder(next);
		haptic.tap();
	};

	const callLiar = () => {
		if (!currentBid || lastBidder < 0) return;

		const flat = allDice.flat();
		const total = flat.filter((d) => d === currentBid.face).length;
		const bidWasTrue = total >= currentBid.qty;
		const loser = bidWasTrue ? currentBidder : lastBidder;

		setRevealResult({ liar: !bidWasTrue, total, loser });
		setPhase("reveal");
		loser === currentBidder ? haptic.error() : haptic.success();
	};

	const nextRound = () => {
		if (!revealResult) return;
		const { loser } = revealResult;

		const newCounts = [...diceCounts];
		newCounts[loser]--;

		const remaining = newCounts.filter((c) => c > 0).length;
		if (remaining <= 1) {
			setDiceCounts(newCounts);
			updateProgress("cross-liars-dice", roundNum * 10);
			setPhase("done");
			return;
		}

		setDiceCounts(newCounts);
		setAllDice(newCounts.map((c) => (c > 0 ? rollDice(c) : [])));
		setRoundNum((r) => r + 1);
		setCurrentBid(null);
		setLastBidder(-1);
		setBidQty(1);
		setBidFace(2);
		setRevealResult(null);

		/* loser peeks first (or next active if eliminated) */
		const fp = newCounts[loser] > 0 ? loser : nextActive(loser, newCounts);
		setCurrentPeeker(fp);
		setPeekStartIndex(fp);
		setShowingDice(false);
		setPhase("peek");
	};

	const restart = () => {
		setPhase("setup");
		setPlayerCount(2);
	};

	/* SETUP */
	if (phase === "setup") {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>{t("ldTitle")}</Text>
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
								style={[
									styles.countBtnText,
									{ color: playerCount === n ? "#fff" : theme.text },
								]}
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

	/* PEEK */
	if (phase === "peek") {
		const pColor = PLAYER_COLORS[currentPeeker];
		const myDice = allDice[currentPeeker] ?? [];
		return (
			<View style={styles.container}>
				<Animated.View
					entering={FadeInDown.duration(300)}
					style={styles.center}
				>
					<Text style={{ fontSize: 48, marginBottom: 12 }}>🎲</Text>
					<Text style={styles.title}>
						{t("mpPlayerN", { n: currentPeeker + 1 })}
					</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("ldDiceRolledHint")}
					</Text>

					{!showingDice ? (
						<Pressable
							onPress={() => {
								setShowingDice(true);
								haptic.tap();
							}}
							style={[styles.primaryBtn, { backgroundColor: pColor }]}
						>
							<Text style={styles.primaryBtnText}>{t("ldPeek")}</Text>
						</Pressable>
					) : (
						<>
							<RNView style={styles.diceRow}>
								{myDice.map((d, i) => (
									<Animated.View
										key={i}
										entering={ZoomIn.delay(i * 80).duration(200)}
										style={[
											styles.dieBox,
											{ backgroundColor: theme.card, borderColor: pColor },
										]}
									>
										<Text style={styles.dieText}>{DICE_EMOJI[d]}</Text>
									</Animated.View>
								))}
							</RNView>
							<Pressable
								onPress={peekDone}
								style={[
									styles.primaryBtn,
									{ backgroundColor: pColor, marginTop: 20 },
								]}
							>
								<Text style={styles.primaryBtnText}>{t("passPhoneReady")}</Text>
							</Pressable>
						</>
					)}
				</Animated.View>
			</View>
		);
	}

	/* BID */
	if (phase === "bid") {
		const bColor = PLAYER_COLORS[currentBidder];
		return (
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.scrollContent}
			>
				<View style={styles.container}>
					<Text style={styles.title}>{t("ldTitle")}</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("ldRound", { n: roundNum })}
					</Text>

					{/* Player dice counts */}
					<RNView style={styles.diceCountRow}>
						{diceCounts.map((c, i) =>
							c > 0 ? (
								<RNView
									key={i}
									style={[
										styles.countBox,
										{
											borderColor:
												i === currentBidder ? PLAYER_COLORS[i] : theme.border,
											borderWidth: i === currentBidder ? 2 : 1,
										},
									]}
								>
									<RNView
										style={[
											styles.playerDot,
											{ backgroundColor: PLAYER_COLORS[i] },
										]}
									/>
									<Text style={styles.countNum}>{c}🎲</Text>
								</RNView>
							) : (
								<RNView
									key={i}
									style={[
										styles.countBox,
										{ borderColor: theme.border, opacity: 0.3 },
									]}
								>
									<RNView
										style={[
											styles.playerDot,
											{ backgroundColor: PLAYER_COLORS[i] },
										]}
									/>
									<Text style={styles.countNum}>💀</Text>
								</RNView>
							),
						)}
					</RNView>

					<Text style={[styles.diceInfo, { color: theme.mutedText }]}>
						{t("ldTotalDice", { total: totalDice })}
					</Text>

					{/* Current bid */}
					<RNView style={styles.bidSection}>
						<Text style={[styles.bidLabel, { color: theme.mutedText }]}>
							{t("ldCurrentBid")}
						</Text>
						{currentBid ? (
							<Text style={styles.bidValue}>
								{currentBid.qty}× {DICE_EMOJI[currentBid.face]} (
								{t("mpPlayerN", { n: lastBidder + 1 })})
							</Text>
						) : (
							<Text style={[styles.bidValue, { color: theme.mutedText }]}>
								{t("ldNoBid")}
							</Text>
						)}
					</RNView>

					{/* Active bidder indicator */}
					<RNView
						style={[
							styles.bidderTag,
							{ backgroundColor: bColor + "22", borderColor: bColor },
						]}
					>
						<Text style={[styles.bidderTagText, { color: bColor }]}>
							{t("mpPlayerN", { n: currentBidder + 1 })} — {t("ldMyBid")}
						</Text>
					</RNView>

					{/* Bid controls */}
					<RNView
						style={[
							styles.bidCard,
							{ backgroundColor: theme.card, borderColor: bColor },
						]}
					>
						<RNView style={styles.spinnerRow}>
							<Text style={styles.spinnerLabel}>{t("ldQuantity")}</Text>
							<Pressable
								onPress={() => setBidQty((q) => Math.max(1, q - 1))}
								style={[styles.spinnerBtn, { borderColor: theme.border }]}
							>
								<Text style={styles.spinnerBtnText}>−</Text>
							</Pressable>
							<Text style={styles.spinnerValue}>{bidQty}</Text>
							<Pressable
								onPress={() => setBidQty((q) => Math.min(totalDice, q + 1))}
								style={[styles.spinnerBtn, { borderColor: theme.border }]}
							>
								<Text style={styles.spinnerBtnText}>+</Text>
							</Pressable>
						</RNView>
						<RNView style={styles.faceRow}>
							{FACES.map((f) => (
								<Pressable
									key={f}
									onPress={() => setBidFace(f)}
									style={[
										styles.faceBtn,
										{
											backgroundColor: bidFace === f ? bColor : "transparent",
											borderColor: theme.border,
										},
									]}
								>
									<Text style={styles.faceBtnText}>{DICE_EMOJI[f]}</Text>
								</Pressable>
							))}
						</RNView>
						<Pressable
							onPress={placeBid}
							style={[
								styles.actionBtn,
								{
									backgroundColor: isValidBid(bidQty, bidFace)
										? bColor
										: theme.mutedText,
								},
							]}
						>
							<Text style={styles.actionBtnText}>{t("ldPlaceBid")}</Text>
						</Pressable>
					</RNView>

					{/* Liar button */}
					{currentBid && lastBidder >= 0 && (
						<Pressable
							onPress={callLiar}
							style={[styles.liarBtn, { backgroundColor: "#ef5350" }]}
						>
							<Text style={styles.liarBtnText}>🤥 {t("ldLiar")}</Text>
						</Pressable>
					)}
				</View>
			</ScrollView>
		);
	}

	/* REVEAL */
	if (phase === "reveal") {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>{t("ldTitle")}</Text>

				{/* All dice revealed */}
				{allDice.map((dice, i) =>
					dice.length > 0 ? (
						<RNView key={i} style={styles.revealPlayerRow}>
							<RNView
								style={[
									styles.playerDot,
									{ backgroundColor: PLAYER_COLORS[i] },
								]}
							/>
							<Text
								style={[styles.revealPlayerName, { color: PLAYER_COLORS[i] }]}
							>
								{t("mpPlayerN", { n: i + 1 })}
							</Text>
							<RNView style={styles.diceRow}>
								{dice.map((d, j) => (
									<RNView
										key={j}
										style={[
											styles.dieBoxSmall,
											{
												backgroundColor:
													d === currentBid?.face ? "#ff9800" : theme.card,
												borderColor: theme.border,
											},
										]}
									>
										<Text style={styles.dieTextSmall}>{DICE_EMOJI[d]}</Text>
									</RNView>
								))}
							</RNView>
						</RNView>
					) : null,
				)}

				{/* Bid reminder */}
				{currentBid && (
					<Text style={[styles.bidReminder, { color: theme.mutedText }]}>
						{t("ldBidWas", {
							qty: currentBid.qty,
							face: DICE_EMOJI[currentBid.face],
						})}
					</Text>
				)}

				{/* Result */}
				{revealResult && (
					<Animated.View
						entering={ZoomIn.duration(300)}
						style={styles.resultCard}
					>
						<Text style={styles.resultTitle}>
							{revealResult.liar ? "🤥 " : "😤 "}
							{currentBid
								? `${currentBid.qty}× ${DICE_EMOJI[currentBid.face]} → ${t("ldActual")}: ${revealResult.total}`
								: ""}
						</Text>
						<Text
							style={[
								styles.resultText,
								{ color: PLAYER_COLORS[revealResult.loser] },
							]}
						>
							{t("mpPlayerN", { n: revealResult.loser + 1 })} {t("ldLosesDie")}
						</Text>
						<Pressable
							onPress={nextRound}
							style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
						>
							<Text style={styles.primaryBtnText}>{t("ldNextRound")}</Text>
						</Pressable>
					</Animated.View>
				)}
			</View>
		);
	}

	/* DONE */
	if (phase === "done") {
		const winner = diceCounts.findIndex((c) => c > 0);
		return (
			<View style={styles.container}>
				<Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
				<Text style={styles.title}>
					{t("dicePlayerWins", { player: String(winner + 1) })}
				</Text>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("ldRoundsPlayed")}: {roundNum}
				</Text>

				<RNView style={styles.finalTable}>
					{diceCounts.map((c, i) => (
						<RNView
							key={i}
							style={[styles.finalRow, { borderColor: theme.border + "44" }]}
						>
							<RNView
								style={[
									styles.playerDot,
									{ backgroundColor: PLAYER_COLORS[i] },
								]}
							/>
							<Text style={[styles.finalName, { color: theme.text }]}>
								{t("mpPlayerN", { n: i + 1 })}
							</Text>
							<Text
								style={[
									styles.finalStatus,
									{ color: c > 0 ? "#66bb6a" : "#ef5350" },
								]}
							>
								{c > 0 ? "🏆" : "💀"}
							</Text>
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

	return null;
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", paddingTop: 10 },
	scrollContent: { alignItems: "center", paddingBottom: 30 },
	center: { alignItems: "center" },
	title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
	subtitle: {
		fontSize: 14,
		textAlign: "center",
		marginTop: 2,
		marginBottom: 12,
	},
	/* setup */
	countRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
	countBtn: {
		width: 48,
		height: 48,
		borderRadius: 12,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	countBtnText: { fontSize: 20, fontWeight: "800" },
	/* dice counts */
	diceCountRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 8,
		flexWrap: "wrap",
		justifyContent: "center",
	},
	countBox: {
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 6,
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
	},
	countNum: { fontSize: 16, fontWeight: "800" },
	playerDot: { width: 10, height: 10, borderRadius: 5 },
	diceInfo: { fontSize: 12, marginBottom: 8 },
	/* dice display */
	diceRow: { flexDirection: "row", gap: 8, marginBottom: 4, flexWrap: "wrap" },
	dieBox: {
		width: 48,
		height: 48,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	dieText: { fontSize: 26 },
	dieBoxSmall: {
		width: 36,
		height: 36,
		borderRadius: 8,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	dieTextSmall: { fontSize: 20 },
	/* bid */
	bidSection: { alignItems: "center", marginVertical: 8 },
	bidLabel: { fontSize: 13, fontWeight: "700" },
	bidValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },
	bidReminder: { fontSize: 14, fontWeight: "600", marginTop: 10 },
	bidderTag: {
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: 10,
		borderWidth: 1.5,
		marginBottom: 8,
	},
	bidderTagText: { fontSize: 14, fontWeight: "800" },
	bidCard: {
		width: "90%",
		borderWidth: 1.5,
		borderRadius: 12,
		padding: 12,
		alignItems: "center",
		gap: 8,
	},
	spinnerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
	spinnerLabel: { fontSize: 13, fontWeight: "600" },
	spinnerBtn: {
		width: 36,
		height: 36,
		borderRadius: 8,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	spinnerBtnText: { fontSize: 20, fontWeight: "700" },
	spinnerValue: {
		fontSize: 22,
		fontWeight: "800",
		minWidth: 30,
		textAlign: "center",
	},
	faceRow: { flexDirection: "row", gap: 6, marginVertical: 6 },
	faceBtn: {
		width: 44,
		height: 44,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	faceBtnText: { fontSize: 24 },
	actionBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
	actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
	primaryBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 12,
		marginTop: 8,
	},
	primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
	/* liar */
	liarBtn: {
		paddingHorizontal: 36,
		paddingVertical: 14,
		borderRadius: 14,
		marginTop: 16,
	},
	liarBtnText: { color: "#fff", fontSize: 20, fontWeight: "900" },
	/* reveal */
	revealPlayerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginVertical: 4,
		flexWrap: "wrap",
	},
	revealPlayerName: { fontSize: 14, fontWeight: "700", minWidth: 70 },
	resultCard: { alignItems: "center", marginTop: 16, gap: 8 },
	resultTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
	resultText: { fontSize: 16, fontWeight: "800" },
	/* done */
	finalTable: {
		width: "100%",
		gap: 6,
		marginBottom: 16,
		paddingHorizontal: 16,
	},
	finalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderBottomWidth: 1,
	},
	finalName: { fontSize: 16, fontWeight: "700", flex: 1 },
	finalStatus: { fontSize: 24 },
});
