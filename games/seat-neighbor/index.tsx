import { useRef, useState } from "react";
import { Pressable, View as RNView, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import { MatchResult, PassDeviceOverlay, PlayerSetup, TurnBanner } from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { seatNeighborQuestions } from "@/data/seatNeighborQuestions";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import { getLocalizedText } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

import { buildRounds, getSyncTier, type Round, SYNC_WIN_THRESHOLD, TOTAL_ROUNDS } from "./logic";

const GAME_ID = "seat-neighbor";
type Seat = 0 | 1;
type Phase = "setup" | "pass" | "pick" | "reveal" | "done";

/**
 * Seat Neighbor — an icebreaker for two people sharing a row. Mind-meld
 * rounds: guess what your neighbour will answer. Would-you-rather rounds:
 * both pick privately. Matching answers earn shared "sync" points.
 */
export default function SeatNeighborGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t, language } = useTranslation();
	const haptic = useHaptic();
	const updateProgress = useGameStore((s) => s.updateProgress);

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [rounds, setRounds] = useState<Round[]>([]);
	const [roundIndex, setRoundIndex] = useState(0);
	/** Which seat is currently picking (privately). */
	const [picker, setPicker] = useState<Seat>(0);
	const [picks, setPicks] = useState<[number | null, number | null]>([null, null]);
	const [sync, setSync] = useState(0);
	/** Correct predictions per seat (bragging stat). */
	const [reads, setReads] = useState<[number, number]>([0, 0]);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();
	const seenRef = useRef<Set<string>>(new Set());

	const round = rounds[roundIndex];

	const firstPicker = (r: Round): Seat => (r.question.kind === "mindMeld" ? r.guesser : 0);
	const secondPicker = (r: Round): Seat => (firstPicker(r) === 0 ? 1 : 0);

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		const built = buildRounds(seatNeighborQuestions, seenRef.current);
		for (const r of built) seenRef.current.add(r.question.id);
		setPlayers(matchPlayers);
		setRounds(built);
		setRoundIndex(0);
		setSync(0);
		setReads([0, 0]);
		setPicks([null, null]);
		setProgress(undefined);
		setPicker(firstPicker(built[0]));
		setPhase("pass");
	};

	const handlePick = (option: number) => {
		if (!round) return;
		haptic.tap();
		const next: [number | null, number | null] = [...picks] as [number | null, number | null];
		next[picker] = option;
		setPicks(next);
		if (next[0] !== null && next[1] !== null) {
			const match = next[0] === next[1];
			if (match) {
				setSync((s) => s + 1);
				if (round.question.kind === "mindMeld") {
					setReads((prev) => {
						const copy: [number, number] = [...prev] as [number, number];
						copy[round.guesser] += 1;
						return copy;
					});
				}
			}
			setPhase("reveal");
			setTimeout(() => (match ? haptic.success() : haptic.error()), 350);
		} else {
			setPicker(secondPicker(round));
			setPhase("pass");
		}
	};

	const nextRound = () => {
		haptic.tap();
		const nextIndex = roundIndex + 1;
		if (nextIndex >= rounds.length) {
			// Cooperative result: both players share the same score.
			setProgress(updateProgress(GAME_ID, sync, { won: sync >= SYNC_WIN_THRESHOLD }));
			setPhase("done");
			return;
		}
		setRoundIndex(nextIndex);
		setPicks([null, null]);
		setPicker(firstPicker(rounds[nextIndex]));
		setPhase("pass");
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameSeatNeighborName")}
				subtitle={t("snIntro")}
				fixedCount={2}
				namesExpanded
				onStart={startMatch}
			/>
		);
	}

	if (!round) return null;
	const isMindMeld = round.question.kind === "mindMeld";
	const current = players[picker];
	const guesserName = players[round.guesser].name;
	const answererName = players[round.answerer].name;
	const bannerLabel =
		phase === "reveal"
			? picks[0] === picks[1]
				? t("snMatch")
				: t("snNoMatch")
			: isMindMeld
				? picker === round.guesser
					? t("snGuessFor", { player: answererName })
					: t("snAnswerTruth")
				: t("snWyrIntro");

	return (
		<View style={styles.root}>
			<RNView style={styles.topRow}>
				<TurnBanner
					player={phase === "reveal" ? players[0] : current}
					label={bannerLabel}
					compact
					right={
						<Text style={[styles.roundChip, { color: theme.mutedText }]}>
							{t("mpRoundOf", { round: roundIndex + 1, total: TOTAL_ROUNDS })}
						</Text>
					}
				/>
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			<RNView style={[styles.syncRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
				<Text style={[styles.syncLabel, { color: theme.mutedText }]}>{t("snSyncScore")}</Text>
				<Text style={[styles.syncValue, { color: theme.tint }]}>
					{sync}/{TOTAL_ROUNDS}
				</Text>
			</RNView>

			<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
				<Animated.View
					key={`${round.question.id}-${phase}`}
					entering={FadeInDown.duration(220)}
					style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
				>
					<Text style={[styles.kind, { color: theme.mutedText }]}>
						{isMindMeld ? t("snMindMeldIntro", { player: answererName }) : t("snWyrIntro")}
					</Text>
					<Text style={[styles.prompt, { color: theme.text }]}>
						{getLocalizedText(round.question.prompt, language)}
					</Text>

					{phase === "pick" ? (
						<RNView style={styles.options}>
							{round.question.options.map((opt, i) => (
								<Pressable
									key={`${round.question.id}-${i}`}
									onPress={() => handlePick(i)}
									accessibilityRole="button"
									style={[styles.option, { backgroundColor: theme.elevated, borderColor: current.color }]}
								>
									<Text style={[styles.optionText, { color: theme.text }]}>
										{getLocalizedText(opt, language)}
									</Text>
								</Pressable>
							))}
						</RNView>
					) : null}

					{phase === "reveal" ? (
						<RNView style={styles.reveal}>
							{([0, 1] as Seat[]).map((seat) => {
								const p = players[seat];
								const pick = picks[seat];
								return (
									<Animated.View
										key={p.index}
										entering={ZoomIn.delay(seat * 180).duration(220)}
										style={[styles.revealCard, { borderColor: p.color, backgroundColor: `${p.color}1A` }]}
									>
										<Text style={[styles.revealName, { color: p.color }]} numberOfLines={1}>
											{p.name}
											{isMindMeld ? (seat === round.guesser ? ` · ${t("snGuessLabel")}` : ` · ${t("snTruthLabel")}`) : ""}
										</Text>
										<Text style={[styles.revealAnswer, { color: theme.text }]}>
											{pick !== null ? getLocalizedText(round.question.options[pick], language) : "—"}
										</Text>
									</Animated.View>
								);
							})}
							<Animated.View entering={ZoomIn.delay(420).duration(220)} style={styles.matchRow}>
								<Text
									style={[
										styles.matchText,
										{ color: picks[0] === picks[1] ? theme.successBorder : theme.mutedText },
									]}
								>
									{picks[0] === picks[1] ? `✨ ${t("snMatch")} +1` : t("snNoMatch")}
								</Text>
							</Animated.View>
							<Pressable
								onPress={nextRound}
								accessibilityRole="button"
								style={[styles.nextBtn, { backgroundColor: theme.tint }]}
							>
								<Text style={[styles.nextText, { color: theme.onTint }]}>
									{roundIndex + 1 >= rounds.length ? t("hmSeeResult") : t("hmNextRound")}
								</Text>
							</Pressable>
						</RNView>
					) : null}
				</Animated.View>
			</ScrollView>

			<PassDeviceOverlay
				visible={phase === "pass"}
				toPlayer={current}
				secret
				hint={isMindMeld && picker === round.guesser ? t("snGuessFor", { player: answererName }) : isMindMeld ? t("snAnswerTruth") : t("snWyrHint")}
				onReady={() => setPhase("pick")}
			/>

			{phase === "done" ? (
				<MatchResult
					title={t(getSyncTier(sync))}
					subtitle={t("snSyncResult", { sync, total: TOTAL_ROUNDS })}
					cooperative
					standings={players.map((p, i) => ({
						player: p,
						score: reads[i],
						detail: t("snReads"),
					}))}
					winnerIndex={null}
					scoreLabel={t("snReads")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	roundChip: { ...TextStyle.chipLabel },
	syncRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
	},
	syncLabel: { ...TextStyle.statLabel },
	syncValue: { fontSize: FontSize.xl, fontWeight: FontWeight.black },
	body: { flexGrow: 1, justifyContent: "center", paddingBottom: Spacing.xl },
	card: { borderWidth: 1, borderRadius: Radius.modal, padding: Spacing.xl, gap: Spacing.md },
	kind: { ...TextStyle.statLabel },
	prompt: { fontSize: FontSize["2xl"], fontWeight: FontWeight.black, lineHeight: 30 },
	options: { gap: Spacing.sm, marginTop: Spacing.xs },
	option: { borderWidth: 1.5, borderRadius: Radius.button, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg },
	optionText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, textAlign: "center" },
	reveal: { gap: Spacing.sm },
	revealCard: { borderWidth: 1.5, borderRadius: Radius.card, padding: Spacing.md, gap: 4 },
	revealName: { fontSize: FontSize.xs, fontWeight: FontWeight.black, textTransform: "uppercase", letterSpacing: 0.6 },
	revealAnswer: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
	matchRow: { alignItems: "center", paddingVertical: Spacing.xs },
	matchText: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
	nextBtn: { borderRadius: Radius.button, paddingVertical: Spacing.md + 2, alignItems: "center" },
	nextText: { ...TextStyle.buttonSecondary },
});
