import { useState } from "react";
import { Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Text, View } from "@/components/Themed";
import GameResult from "@/components/GameResult";
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

type Phase = "roll" | "bid" | "reveal" | "roundEnd" | "done";
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

	const [phase, setPhase] = useState<Phase>("roll");

	// Dice counts
	const [myDiceCount, setMyDiceCount] = useState(STARTING_DICE);
	const [oppDiceCount, setOppDiceCount] = useState(STARTING_DICE);

	// My dice (rolled secretly)
	const [myDice, setMyDice] = useState<number[]>([]);

	// Current bid
	const [currentBid, setCurrentBid] = useState<Bid | null>(null);
	const [iMadeLast, setIMadeLast] = useState(false);

	// Bid input
	const [bidQty, setBidQty] = useState(1);
	const [bidFace, setBidFace] = useState(2);

	// Reveal: enter opponent's dice to verify
	const [oppDiceInput, setOppDiceInput] = useState<number[]>([]);
	const [revealResult, setRevealResult] = useState<{
		liar: boolean;
		total: number;
		loser: "me" | "opp";
	} | null>(null);

	const [winner, setWinner] = useState<"me" | "opp" | null>(null);
	const [roundNum, setRoundNum] = useState(1);

	const totalDice = myDiceCount + oppDiceCount;

	// --- ROLL ---
	const doRoll = () => {
		setMyDice(rollDice(myDiceCount));
		setPhase("bid");
		setCurrentBid(null);
		setBidQty(1);
		setBidFace(2);
		setIMadeLast(false);
		haptic.tap();
	};

	// --- BID ---
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
		setIMadeLast(true);
		haptic.tap();
	};

	// Record opponent's bid (they said it aloud)
	const [oppBidQty, setOppBidQty] = useState(1);
	const [oppBidFace, setOppBidFace] = useState(2);

	const recordOppBid = () => {
		if (!isValidBid(oppBidQty, oppBidFace)) {
			haptic.error();
			return;
		}
		setCurrentBid({ qty: oppBidQty, face: oppBidFace });
		setIMadeLast(false);
		haptic.tap();
	};

	// --- CALL LIAR ---
	const callLiar = () => {
		if (!currentBid) return;
		setPhase("reveal");
		setOppDiceInput([]);
		setRevealResult(null);
		haptic.heavy();
	};

	// --- REVEAL ---
	const addOppDie = (face: number) => {
		if (oppDiceInput.length >= oppDiceCount) return;
		setOppDiceInput((prev) => [...prev, face]);
		haptic.tap();
	};

	const removeLastOppDie = () => {
		setOppDiceInput((prev) => prev.slice(0, -1));
	};

	const confirmReveal = () => {
		if (oppDiceInput.length !== oppDiceCount) return;
		if (!currentBid) return;

		const allDice = [...myDice, ...oppDiceInput];
		const total = allDice.filter((d) => d === currentBid.face).length;
		const bidWasTrue = total >= currentBid.qty;

		// Who called liar? The person who DIDN'T make the last bid.
		// If I made the last bid and opponent calls liar: opponent challenged my bid
		// If opponent made the last bid and I call liar: I challenged their bid
		// The caller loses if bid was true; bid-maker loses if bid was false
		const callerIsMe = !iMadeLast;
		const liar = !bidWasTrue; // the bid was a lie
		const loser: "me" | "opp" = liar
			? iMadeLast
				? "me"
				: "opp" // bidder loses
			: callerIsMe
				? "me"
				: "opp"; // caller loses

		setRevealResult({ liar, total, loser });
		(loser === "opp" ? haptic.success() : haptic.error());
	};

	const nextRound = () => {
		if (!revealResult) return;
		const { loser } = revealResult;

		let newMy = myDiceCount;
		let newOpp = oppDiceCount;
		if (loser === "me") newMy--;
		else newOpp--;

		if (newMy <= 0) {
			setMyDiceCount(0);
			setWinner("opp");
			setPhase("done");
			updateProgress("cross-liars-dice", roundNum * 5);
			return;
		}
		if (newOpp <= 0) {
			setOppDiceCount(0);
			setWinner("me");
			setPhase("done");
			updateProgress("cross-liars-dice", roundNum * 10);
			return;
		}

		setMyDiceCount(newMy);
		setOppDiceCount(newOpp);
		setRoundNum((r) => r + 1);
		setPhase("roll");
		setMyDice([]);
		setCurrentBid(null);
		setRevealResult(null);
		setOppDiceInput([]);
	};

	const restart = () => {
		setPhase("roll");
		setMyDiceCount(STARTING_DICE);
		setOppDiceCount(STARTING_DICE);
		setMyDice([]);
		setCurrentBid(null);
		setIMadeLast(false);
		setBidQty(1);
		setBidFace(2);
		setOppBidQty(1);
		setOppBidFace(2);
		setOppDiceInput([]);
		setRevealResult(null);
		setWinner(null);
		setRoundNum(1);
	};

	// --- DONE ---
	if (phase === "done") {
		return (
			<GameResult
				title={winner === "me" ? t("ldYouWin") : t("ldYouLose")}
				score={winner === "me" ? roundNum * 10 : 0}
				subtitle={`${t("ldRoundsPlayed")}: ${roundNum}`}
				onPlayAgain={restart}
			/>
		);
	}

	// --- ROLL PHASE ---
	if (phase === "roll") {
		return (
			<View style={styles.container}>
				<Animated.View
					entering={FadeInDown.duration(300)}
					style={styles.center}
				>
					<Text style={styles.title}>{t("ldTitle")}</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("ldRound", { n: roundNum })}
					</Text>

					<View style={styles.diceCountRow}>
						<View style={[styles.countBox, { borderColor: theme.border }]}>
							<Text style={styles.countLabel}>{t("ldYou")}</Text>
							<Text style={styles.countNum}>{myDiceCount} 🎲</Text>
						</View>
						<View style={[styles.countBox, { borderColor: theme.border }]}>
							<Text style={styles.countLabel}>{t("ldOpp")}</Text>
							<Text style={styles.countNum}>{oppDiceCount} 🎲</Text>
						</View>
					</View>

					<Pressable
						onPress={doRoll}
						style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
					>
						<Text style={styles.primaryBtnText}>{t("ldRoll")}</Text>
					</Pressable>
				</Animated.View>
			</View>
		);
	}

	// --- BID PHASE ---
	if (phase === "bid") {
		return (
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.scrollContent}
			>
				<View style={styles.container}>
					{/* My dice */}
					<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
						{t("ldYourDice")}
					</Text>
					<View style={styles.diceRow}>
						{myDice.map((d, i) => (
							<Animated.View
								key={i}
								entering={ZoomIn.delay(i * 80).duration(200)}
								style={[
									styles.dieBox,
									{ backgroundColor: theme.card, borderColor: theme.border },
								]}
							>
								<Text style={styles.dieText}>{DICE_EMOJI[d]}</Text>
							</Animated.View>
						))}
					</View>

					{/* Current bid */}
					<View style={styles.bidSection}>
						<Text style={[styles.bidLabel, { color: theme.mutedText }]}>
							{t("ldCurrentBid")}
						</Text>
						{currentBid ? (
							<Text style={styles.bidValue}>
								{currentBid.qty}× {DICE_EMOJI[currentBid.face]}{" "}
								{iMadeLast ? `(${t("ldYou")})` : `(${t("ldOpp")})`}
							</Text>
						) : (
							<Text style={[styles.bidValue, { color: theme.mutedText }]}>
								{t("ldNoBid")}
							</Text>
						)}
					</View>

					{/* Dice count info */}
					<Text style={[styles.diceInfo, { color: theme.mutedText }]}>
						{t("ldTotalDice", { total: totalDice })}
					</Text>

					{/* My bid controls */}
					<View
						style={[
							styles.bidCard,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
					>
						<Text style={styles.bidCardTitle}>{t("ldMyBid")}</Text>
						<View style={styles.spinnerRow}>
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
						</View>
						<View style={styles.faceRow}>
							{FACES.map((f) => (
								<Pressable
									key={f}
									onPress={() => setBidFace(f)}
									style={[
										styles.faceBtn,
										{
											backgroundColor:
												bidFace === f ? theme.tint : "transparent",
											borderColor: theme.border,
										},
									]}
								>
									<Text style={styles.faceBtnText}>{DICE_EMOJI[f]}</Text>
								</Pressable>
							))}
						</View>
						<Pressable
							onPress={placeBid}
							style={[
								styles.actionBtn,
								{
									backgroundColor: isValidBid(bidQty, bidFace)
										? theme.tint
										: theme.mutedText,
								},
							]}
						>
							<Text style={styles.actionBtnText}>{t("ldPlaceBid")}</Text>
						</Pressable>
					</View>

					{/* Record opponent's bid */}
					<View
						style={[
							styles.bidCard,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
					>
						<Text style={styles.bidCardTitle}>{t("ldOppBid")}</Text>
						<View style={styles.spinnerRow}>
							<Text style={styles.spinnerLabel}>{t("ldQuantity")}</Text>
							<Pressable
								onPress={() => setOppBidQty((q) => Math.max(1, q - 1))}
								style={[styles.spinnerBtn, { borderColor: theme.border }]}
							>
								<Text style={styles.spinnerBtnText}>−</Text>
							</Pressable>
							<Text style={styles.spinnerValue}>{oppBidQty}</Text>
							<Pressable
								onPress={() => setOppBidQty((q) => Math.min(totalDice, q + 1))}
								style={[styles.spinnerBtn, { borderColor: theme.border }]}
							>
								<Text style={styles.spinnerBtnText}>+</Text>
							</Pressable>
						</View>
						<View style={styles.faceRow}>
							{FACES.map((f) => (
								<Pressable
									key={f}
									onPress={() => setOppBidFace(f)}
									style={[
										styles.faceBtn,
										{
											backgroundColor:
												oppBidFace === f ? "#ff9800" : "transparent",
											borderColor: theme.border,
										},
									]}
								>
									<Text style={styles.faceBtnText}>{DICE_EMOJI[f]}</Text>
								</Pressable>
							))}
						</View>
						<Pressable
							onPress={recordOppBid}
							style={[
								styles.actionBtn,
								{
									backgroundColor: isValidBid(oppBidQty, oppBidFace)
										? "#ff9800"
										: theme.mutedText,
								},
							]}
						>
							<Text style={styles.actionBtnText}>{t("ldRecordBid")}</Text>
						</Pressable>
					</View>

					{/* Liar button */}
					{currentBid && !iMadeLast && (
						<Pressable
							onPress={callLiar}
							style={[styles.liarBtn, { backgroundColor: "#ef5350" }]}
						>
							<Text style={styles.liarBtnText}>{t("ldLiar")}</Text>
						</Pressable>
					)}

					{/* Hint: opponent can call liar */}
					{currentBid && iMadeLast && (
						<Pressable
							onPress={callLiar}
							style={[styles.liarHintBtn, { borderColor: "#ef5350" }]}
						>
							<Text style={[styles.liarHintText, { color: "#ef5350" }]}>
								{t("ldOppCalledLiar")}
							</Text>
						</Pressable>
					)}
				</View>
			</ScrollView>
		);
	}

	// --- REVEAL PHASE ---
	if (phase === "reveal") {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>{t("ldReveal")}</Text>

				{/* My dice */}
				<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
					{t("ldYourDice")}
				</Text>
				<View style={styles.diceRow}>
					{myDice.map((d, i) => (
						<View
							key={i}
							style={[
								styles.dieBox,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
						>
							<Text style={styles.dieText}>{DICE_EMOJI[d]}</Text>
						</View>
					))}
				</View>

				{/* Current bid reminder */}
				{currentBid && (
					<Text style={[styles.bidReminder, { color: theme.mutedText }]}>
						{t("ldBidWas", {
							qty: currentBid.qty,
							face: DICE_EMOJI[currentBid.face],
						})}
					</Text>
				)}

				{/* Enter opponent's dice */}
				{!revealResult && (
					<>
						<Text
							style={[
								styles.sectionLabel,
								{ color: theme.mutedText, marginTop: 14 },
							]}
						>
							{t("ldEnterOppDice", { count: oppDiceCount })}
						</Text>
						<View style={styles.diceRow}>
							{Array.from({ length: oppDiceCount }).map((_, i) => (
								<View
									key={i}
									style={[
										styles.dieBox,
										{
											backgroundColor:
												oppDiceInput[i] != null ? "#ff9800" : theme.card,
											borderColor: theme.border,
										},
									]}
								>
									<Text style={styles.dieText}>
										{oppDiceInput[i] != null
											? DICE_EMOJI[oppDiceInput[i]]
											: "?"}
									</Text>
								</View>
							))}
						</View>

						<View style={styles.faceRow}>
							{FACES.map((f) => (
								<Pressable
									key={f}
									onPress={() => addOppDie(f)}
									style={[styles.faceBtn, { borderColor: theme.border }]}
								>
									<Text style={styles.faceBtnText}>{DICE_EMOJI[f]}</Text>
								</Pressable>
							))}
						</View>

						<View style={styles.revealActions}>
							<Pressable
								onPress={removeLastOppDie}
								style={[styles.smallBtn, { borderColor: theme.border }]}
							>
								<Text style={{ fontWeight: "700", color: "#ef5350" }}>⌫</Text>
							</Pressable>
							{oppDiceInput.length === oppDiceCount && (
								<Pressable
									onPress={confirmReveal}
									style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
								>
									<Text style={styles.primaryBtnText}>{t("ldConfirm")}</Text>
								</Pressable>
							)}
						</View>
					</>
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
								{
									color: revealResult.loser === "opp" ? "#4caf50" : "#ef5350",
								},
							]}
						>
							{revealResult.loser === "me"
								? t("ldYouLoseDie")
								: t("ldTheyLoseDie")}
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
	// Dice counts
	diceCountRow: {
		flexDirection: "row",
		gap: 20,
		marginBottom: 20,
	},
	countBox: {
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 20,
		paddingVertical: 10,
		alignItems: "center",
	},
	countLabel: { fontSize: 13, fontWeight: "600" },
	countNum: { fontSize: 22, fontWeight: "800", marginTop: 2 },
	// Dice display
	sectionLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
	diceRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
	dieBox: {
		width: 48,
		height: 48,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	dieText: { fontSize: 26 },
	diceInfo: { fontSize: 12, marginBottom: 8 },
	// Bid section
	bidSection: { alignItems: "center", marginVertical: 8 },
	bidLabel: { fontSize: 13, fontWeight: "700" },
	bidValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },
	bidReminder: { fontSize: 14, fontWeight: "600", marginTop: 8 },
	// Bid card
	bidCard: {
		width: "90%",
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		marginTop: 10,
		alignItems: "center",
		gap: 8,
	},
	bidCardTitle: { fontSize: 15, fontWeight: "700" },
	// Spinner
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
	// Face selector
	faceRow: {
		flexDirection: "row",
		gap: 6,
		marginVertical: 6,
	},
	faceBtn: {
		width: 44,
		height: 44,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	faceBtnText: { fontSize: 24 },
	// Action buttons
	actionBtn: {
		paddingHorizontal: 24,
		paddingVertical: 10,
		borderRadius: 10,
	},
	actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
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
	},
	// Liar button
	liarBtn: {
		paddingHorizontal: 36,
		paddingVertical: 14,
		borderRadius: 14,
		marginTop: 16,
	},
	liarBtnText: { color: "#fff", fontSize: 20, fontWeight: "900" },
	liarHintBtn: {
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 2,
		marginTop: 16,
	},
	liarHintText: { fontSize: 15, fontWeight: "700" },
	// Reveal
	revealActions: {
		flexDirection: "row",
		gap: 12,
		alignItems: "center",
		marginTop: 8,
	},
	resultCard: {
		alignItems: "center",
		marginTop: 16,
		gap: 8,
	},
	resultTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
	resultText: { fontSize: 16, fontWeight: "800" },
});
