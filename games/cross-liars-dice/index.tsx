import { useState } from "react";
import { Pressable, View as RNView, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
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
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "cross-liars-dice";
const STARTING_DICE = 5;
const FACES = [1, 2, 3, 4, 5, 6] as const;
const DICE_EMOJI: Record<number, string> = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

type Phase = "setup" | "passPeek" | "peek" | "bid" | "reveal" | "done";
type Bid = { qty: number; face: number };

function rollDice(count: number): number[] {
	return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export default function CrossLiarsDiceGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [diceCounts, setDiceCounts] = useState<number[]>([]);
	const [allDice, setAllDice] = useState<number[][]>([]);
	const [roundNum, setRoundNum] = useState(1);
	const [currentPeeker, setCurrentPeeker] = useState(0);
	const [peekStartIndex, setPeekStartIndex] = useState(0);
	const [currentBidder, setCurrentBidder] = useState(0);
	const [currentBid, setCurrentBid] = useState<Bid | null>(null);
	const [lastBidder, setLastBidder] = useState(-1);
	const [bidQty, setBidQty] = useState(1);
	const [bidFace, setBidFace] = useState(2);
	const [revealResult, setRevealResult] = useState<{ liar: boolean; total: number; loser: number } | null>(null);
	const [winner, setWinner] = useState<number | null>(null);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	const totalDice = diceCounts.reduce((a, b) => a + b, 0);
	const count = players.length;

	function nextActive(from: number, counts?: number[]): number {
		const dc = counts ?? diceCounts;
		let idx = from;
		for (let i = 0; i < count; i++) {
			idx = (idx + 1) % count;
			if (dc[idx] > 0) return idx;
		}
		return from;
	}

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		const counts = Array(matchPlayers.length).fill(STARTING_DICE) as number[];
		setPlayers(matchPlayers);
		setDiceCounts(counts);
		setAllDice(counts.map((c) => rollDice(c)));
		setRoundNum(1);
		setCurrentPeeker(0);
		setPeekStartIndex(0);
		setCurrentBid(null);
		setLastBidder(-1);
		setBidQty(1);
		setBidFace(2);
		setRevealResult(null);
		setWinner(null);
		setProgress(undefined);
		setPhase("passPeek");
	};

	const peekDone = () => {
		haptic.tap();
		const next = nextActive(currentPeeker);
		if (next === peekStartIndex) {
			setCurrentBidder(peekStartIndex);
			setPhase("bid");
		} else {
			setCurrentPeeker(next);
			setPhase("passPeek");
		}
	};

	const isValidBid = (qty: number, face: number): boolean => {
		if (!currentBid) return true;
		if (qty > currentBid.qty) return true;
		return qty === currentBid.qty && face > currentBid.face;
	};

	const placeBid = () => {
		if (!isValidBid(bidQty, bidFace)) {
			haptic.error();
			return;
		}
		setCurrentBid({ qty: bidQty, face: bidFace });
		setLastBidder(currentBidder);
		setCurrentBidder(nextActive(currentBidder));
		haptic.tap();
	};

	const callLiar = () => {
		if (!currentBid || lastBidder < 0) return;
		const total = allDice.flat().filter((d) => d === currentBid.face).length;
		const bidWasTrue = total >= currentBid.qty;
		const loser = bidWasTrue ? currentBidder : lastBidder;
		setRevealResult({ liar: !bidWasTrue, total, loser });
		setPhase("reveal");
		if (loser === currentBidder) haptic.error();
		else haptic.success();
	};

	const nextRound = () => {
		if (!revealResult) return;
		haptic.tap();
		const { loser } = revealResult;
		const newCounts = [...diceCounts];
		newCounts[loser]--;

		const alive = newCounts.filter((c) => c > 0).length;
		if (alive <= 1) {
			const winnerIdx = newCounts.findIndex((c) => c > 0);
			setDiceCounts(newCounts);
			setWinner(winnerIdx);
			setProgress(
				recordMatch(
					GAME_ID,
					newCounts.map((c) => ({ score: c })),
					{ bonusIfWon: 10 },
				),
			);
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
		const fp = newCounts[loser] > 0 ? loser : nextActive(loser, newCounts);
		setCurrentPeeker(fp);
		setPeekStartIndex(fp);
		setPhase("passPeek");
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("ldTitle")}
				subtitle={t("ldDiceRolledHint")}
				minPlayers={2}
				onStart={startMatch}
			/>
		);
	}

	const peeker = players[currentPeeker];
	const bidder = players[currentBidder];

	return (
		<View style={styles.container}>
			<RNView style={styles.topRow}>
				<TurnBanner
					player={phase === "peek" || phase === "passPeek" ? peeker : bidder}
					compact
					label={
						phase === "peek" || phase === "passPeek"
							? `${peeker.name} · ${t("ldYourDice")}`
							: phase === "reveal" && revealResult
								? `${players[revealResult.loser].name} ${t("ldLosesDie")}`
								: undefined
					}
					right={
						<Text style={[styles.roundChip, { color: theme.mutedText }]}>
							{t("ldRound", { n: roundNum })}
						</Text>
					}
				/>
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			<PlayerScoreStrip
				players={players}
				scores={diceCounts}
				activeIndex={phase === "bid" ? currentBidder : undefined}
				format={(v) => (v > 0 ? `${v} 🎲` : "💀")}
			/>

			{phase === "peek" ? (
				<Animated.View entering={FadeInDown.duration(240)} style={styles.center}>
					<Text style={[styles.hint, { color: theme.mutedText }]}>{t("ldDiceRolledHint")}</Text>
					<RNView style={styles.diceRow}>
						{(allDice[currentPeeker] ?? []).map((d, i) => (
							<Animated.View
								key={`${currentPeeker}-${roundNum}-${i}`}
								entering={ZoomIn.delay(i * 80).duration(200)}
								style={[styles.dieBox, { backgroundColor: theme.card, borderColor: peeker.color }]}
								accessibilityLabel={t("a11yDieFace", { n: d })}
							>
								<Text style={styles.dieText}>{DICE_EMOJI[d]}</Text>
							</Animated.View>
						))}
					</RNView>
					<Pressable
						onPress={peekDone}
						accessibilityRole="button"
						accessibilityLabel={t("passPhoneReady")}
						style={[styles.primaryBtn, { backgroundColor: peeker.color }]}
					>
						<Text style={styles.primaryBtnText}>{t("passPhoneReady")}</Text>
					</Pressable>
				</Animated.View>
			) : null}

			{phase === "bid" ? (
				<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
					<Text style={[styles.diceInfo, { color: theme.mutedText }]}>
						{t("ldTotalDice", { total: totalDice })}
					</Text>

					<RNView style={styles.bidSection}>
						<Text style={[styles.bidLabel, { color: theme.mutedText }]}>{t("ldCurrentBid")}</Text>
						{currentBid ? (
							<Text style={styles.bidValue}>
								{currentBid.qty}× {DICE_EMOJI[currentBid.face]} · {players[lastBidder]?.name}
							</Text>
						) : (
							<Text style={[styles.bidValue, { color: theme.mutedText }]}>{t("ldNoBid")}</Text>
						)}
					</RNView>

					<RNView style={[styles.bidCard, { backgroundColor: theme.card, borderColor: bidder.color }]}>
						<RNView style={styles.spinnerRow}>
							<Text style={styles.spinnerLabel}>{t("ldQuantity")}</Text>
							<Pressable
								onPress={() => {
									haptic.tap();
									setBidQty((q) => Math.max(1, q - 1));
								}}
								accessibilityRole="button"
								accessibilityLabel={t("a11yDecreaseQty")}
								style={[styles.spinnerBtn, { borderColor: theme.border }]}
							>
								<Text style={styles.spinnerBtnText}>−</Text>
							</Pressable>
							<Text style={styles.spinnerValue}>{bidQty}</Text>
							<Pressable
								onPress={() => {
									haptic.tap();
									setBidQty((q) => Math.min(totalDice, q + 1));
								}}
								accessibilityRole="button"
								accessibilityLabel={t("a11yIncreaseQty")}
								style={[styles.spinnerBtn, { borderColor: theme.border }]}
							>
								<Text style={styles.spinnerBtnText}>+</Text>
							</Pressable>
						</RNView>
						<RNView style={styles.faceRow}>
							{FACES.map((f) => (
								<Pressable
									key={f}
									onPress={() => {
										haptic.tap();
										setBidFace(f);
									}}
									accessibilityRole="button"
									accessibilityLabel={t("a11yDieFace", { n: f })}
									accessibilityState={{ selected: bidFace === f }}
									style={[
										styles.faceBtn,
										{ backgroundColor: bidFace === f ? bidder.color : "transparent", borderColor: theme.border },
									]}
								>
									<Text style={styles.faceBtnText}>{DICE_EMOJI[f]}</Text>
								</Pressable>
							))}
						</RNView>
						<Pressable
							onPress={placeBid}
							disabled={!isValidBid(bidQty, bidFace)}
							accessibilityRole="button"
							accessibilityLabel={t("ldPlaceBid")}
							accessibilityState={{ disabled: !isValidBid(bidQty, bidFace) }}
							style={[
								styles.actionBtn,
								{ backgroundColor: bidder.color, opacity: isValidBid(bidQty, bidFace) ? 1 : 0.35 },
							]}
						>
							<Text style={styles.actionBtnText}>{t("ldPlaceBid")}</Text>
						</Pressable>
					</RNView>

					{currentBid && lastBidder >= 0 ? (
						<AnimatedPressable
							scaleTo={0.92}
							onPress={callLiar}
							accessibilityRole="button"
							accessibilityLabel={t("ldLiar")}
							style={[styles.liarBtn, { backgroundColor: theme.danger }]}
						>
							<Text style={styles.liarBtnText}>🤥 {t("ldLiar")}</Text>
						</AnimatedPressable>
					) : null}
				</ScrollView>
			) : null}

			{phase === "reveal" ? (
				<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
					{allDice.map((dice, i) =>
						dice.length > 0 ? (
							<Animated.View
								key={players[i].index}
								entering={FadeInDown.delay(i * 50).duration(200)}
								style={styles.revealPlayerRow}
							>
								<RNView style={[styles.playerDot, { backgroundColor: players[i].color }]} />
								<Text style={[styles.revealPlayerName, { color: players[i].color }]} numberOfLines={1}>
									{players[i].name}
								</Text>
								<RNView style={styles.diceRowSmall}>
									{dice.map((d, j) => (
										<Animated.View
											key={`${i}-${j}`}
											entering={ZoomIn.delay(i * 50 + j * 30).duration(150)}
											style={[
												styles.dieBoxSmall,
												{
													backgroundColor: d === currentBid?.face ? theme.warning : theme.card,
													borderColor: theme.border,
												},
											]}
										>
											<Text style={styles.dieTextSmall}>{DICE_EMOJI[d]}</Text>
										</Animated.View>
									))}
								</RNView>
							</Animated.View>
						) : null,
					)}

					{currentBid && revealResult ? (
						<Animated.View entering={ZoomIn.duration(300)} style={styles.resultCard}>
							<Text style={styles.resultTitle}>
								{revealResult.liar ? "🤥 " : "😤 "}
								{currentBid.qty}× {DICE_EMOJI[currentBid.face]} → {t("ldActual")}: {revealResult.total}
							</Text>
							<Text style={[styles.resultText, { color: players[revealResult.loser].color }]}>
								{players[revealResult.loser].name} {t("ldLosesDie")}
							</Text>
							<Pressable
								onPress={nextRound}
								accessibilityRole="button"
								accessibilityLabel={t("ldNextRound")}
								style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
							>
								<Text style={[styles.primaryBtnText, { color: theme.onTint }]}>{t("ldNextRound")}</Text>
							</Pressable>
						</Animated.View>
					) : null}
				</ScrollView>
			) : null}

			<PassDeviceOverlay
				visible={phase === "passPeek"}
				toPlayer={peeker}
				secret
				hint={t("ldDiceRolledHint")}
				readyLabel={t("ldPeek")}
				onReady={() => setPhase("peek")}
			/>

			{phase === "done" ? (
				<MatchResult
					standings={players.map((p, i) => ({
						player: p,
						score: diceCounts[i],
						detail: diceCounts[i] > 0 ? "🏆" : "💀",
					}))}
					winnerIndex={winner}
					scoreLabel="🎲"
					subtitle={`${t("ldRoundsPlayed")}: ${roundNum}`}
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
	scroll: { flex: 1 },
	scrollContent: { alignItems: "center", paddingBottom: Spacing["3xl"], gap: Spacing.sm },
	center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },
	hint: { ...TextStyle.hint, textAlign: "center" },
	diceRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap", justifyContent: "center" },
	diceRowSmall: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },
	dieBox: { width: 52, height: 52, borderRadius: Radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center" },
	dieText: { fontSize: FontSize["3xl"] },
	dieBoxSmall: { width: 36, height: 36, borderRadius: Radius.sm + 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
	dieTextSmall: { fontSize: FontSize.xl },
	diceInfo: { ...TextStyle.hint },
	bidSection: { alignItems: "center" },
	bidLabel: { ...TextStyle.statLabel },
	bidValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, marginTop: 2 },
	bidCard: { alignSelf: "stretch", borderWidth: 1.5, borderRadius: Radius.card, padding: Spacing.md, alignItems: "center", gap: Spacing.sm },
	spinnerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm + 2 },
	spinnerLabel: { ...TextStyle.hint },
	spinnerBtn: { width: 40, height: 40, borderRadius: Radius.sm + 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
	spinnerBtnText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
	spinnerValue: { fontSize: FontSize["2xl"], fontWeight: FontWeight.extrabold, minWidth: 32, textAlign: "center" },
	faceRow: { flexDirection: "row", gap: 6, marginVertical: 6 },
	faceBtn: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
	faceBtnText: { fontSize: FontSize["2xl"] + 2 },
	actionBtn: { paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.sm + 2, borderRadius: Radius.md },
	actionBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
	primaryBtn: { paddingHorizontal: Spacing["3xl"], paddingVertical: Spacing.md, borderRadius: Radius.card, marginTop: Spacing.sm },
	primaryBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
	liarBtn: { paddingHorizontal: Spacing["4xl"], paddingVertical: Spacing.lg, borderRadius: Radius.button, marginTop: Spacing.md },
	liarBtnText: { color: "#fff", fontSize: FontSize.xl, fontWeight: FontWeight.black },
	revealPlayerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, alignSelf: "stretch" },
	playerDot: { width: 10, height: 10, borderRadius: 5 },
	revealPlayerName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, minWidth: 64, maxWidth: 96 },
	resultCard: { alignItems: "center", marginTop: Spacing.md, gap: Spacing.sm },
	resultTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: "center" },
	resultText: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
});
