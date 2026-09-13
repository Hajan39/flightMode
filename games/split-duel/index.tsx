import { useEffect, useRef, useState } from "react";
import { View as RNView, StyleSheet } from "react-native";

import GameControls from "@/components/GameControls";
import { MatchResult, PlayerSetup } from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

import DuelPane, { type PaneStatus } from "./DuelPane";
import {
	type Challenge,
	colorAt,
	type ColorId,
	isMatchOver,
	MAX_ROUNDS,
	pickChallenges,
	resolveHold,
} from "./logic";

const GAME_ID = "split-duel";
type Seat = 0 | 1;
type Phase = "setup" | "playing" | "done";
type RoundState = "idle" | "countdown" | "live" | "resolved";

const ROUND_TIMEOUT_MS = 8000;
const RESULT_PAUSE_MS = 1600;

/**
 * Split Duel — lay the phone flat between two players. The top half is
 * rotated 180° so each player has their own "screen"; both get identical
 * stimuli and the first correct reaction wins the round. Best of 5.
 */
export default function SplitDuelGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [challenges, setChallenges] = useState<Challenge[]>([]);
	const [roundIndex, setRoundIndex] = useState(0);
	const [roundState, setRoundState] = useState<RoundState>("idle");
	const [countdown, setCountdown] = useState(3);
	const [wins, setWins] = useState<[number, number]>([0, 0]);
	const [roundWinner, setRoundWinner] = useState<Seat | "tie" | null>(null);
	const [discColor, setDiscColor] = useState<ColorId | null>(null);
	const [greenOn, setGreenOn] = useState(false);
	const [holdMs, setHoldMs] = useState<[number | null, number | null]>([null, null]);
	const [reactionMs, setReactionMs] = useState<number | null>(null);
	const [bestReaction, setBestReaction] = useState<[number | null, number | null]>([null, null]);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	const resolvedRef = useRef(false);
	const roundStartRef = useRef(0);
	const holdStartRef = useRef<[number | null, number | null]>([null, null]);
	const heldRef = useRef<[number | null, number | null]>([null, null]);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clearTimers = () => {
		for (const tm of timers.current) clearTimeout(tm);
		timers.current = [];
		if (tickRef.current) clearInterval(tickRef.current);
		tickRef.current = null;
	};
	const later = (fn: () => void, ms: number) => {
		const tm = setTimeout(fn, ms);
		timers.current.push(tm);
	};

	useEffect(() => clearTimers, []);

	const challenge = challenges[roundIndex] ?? null;

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		clearTimers();
		setPlayers(matchPlayers);
		setChallenges(pickChallenges(MAX_ROUNDS));
		setRoundIndex(0);
		setWins([0, 0]);
		setBestReaction([null, null]);
		setProgress(undefined);
		setPhase("playing");
		beginCountdown();
	};

	const beginCountdown = () => {
		resolvedRef.current = false;
		setRoundWinner(null);
		setReactionMs(null);
		setDiscColor(null);
		setGreenOn(false);
		setHoldMs([null, null]);
		holdStartRef.current = [null, null];
		heldRef.current = [null, null];
		setRoundState("countdown");
		setCountdown(3);
		haptic.tap();
		later(() => {
			setCountdown(2);
			haptic.tap();
		}, 700);
		later(() => {
			setCountdown(1);
			haptic.tap();
		}, 1400);
		later(() => {
			setCountdown(0);
			haptic.heavy();
		}, 2100);
		later(goLive, 2500);
	};

	const goLive = () => {
		roundStartRef.current = Date.now();
		setRoundState("live");
		const current = challenges[roundIndex] ?? challenge;
		if (!current) return;

		if (current.kind === "color") {
			setDiscColor(colorAt(current, 0));
			tickRef.current = setInterval(() => {
				const elapsed = Date.now() - roundStartRef.current;
				setDiscColor(colorAt(current, elapsed));
			}, 50);
			later(() => resolveRound("tie"), current.totalMs);
		} else if (current.kind === "green") {
			later(() => {
				setGreenOn(true);
				haptic.heavy();
			}, current.delayMs);
			later(() => resolveRound("tie"), current.delayMs + ROUND_TIMEOUT_MS);
		} else if (current.kind === "hold") {
			// Anyone who never releases by the timeout forfeits.
			later(() => finishHold(), current.targetMs + 4000);
		} else {
			later(() => resolveRound("tie"), ROUND_TIMEOUT_MS);
		}
	};

	const resolveRound = (winner: Seat | "tie", reaction?: number) => {
		if (resolvedRef.current) return;
		resolvedRef.current = true;
		clearTimers();
		setRoundState("resolved");
		setRoundWinner(winner);
		if (winner !== "tie") {
			haptic.success();
			if (reaction !== undefined) {
				setReactionMs(reaction);
				setBestReaction((prev) => {
					const next: [number | null, number | null] = [...prev] as [number | null, number | null];
					next[winner] = prev[winner] === null ? reaction : Math.min(prev[winner] as number, reaction);
					return next;
				});
			}
		} else {
			haptic.error();
		}

		const nextWins: [number, number] = [...wins] as [number, number];
		if (winner !== "tie") nextWins[winner] += 1;
		setWins(nextWins);
		const roundsPlayed = roundIndex + 1;

		later(() => {
			if (isMatchOver(nextWins, roundsPlayed)) {
				setProgress(recordMatch(GAME_ID, nextWins.map((score) => ({ score }))));
				setPhase("done");
				return;
			}
			setRoundIndex(roundsPlayed);
			beginCountdown();
		}, RESULT_PAUSE_MS);
	};

	const finishHold = () => {
		if (resolvedRef.current || !challenge || challenge.kind !== "hold") return;
		const winner = resolveHold(challenge.targetMs, heldRef.current);
		resolveRound(winner === null ? "tie" : winner);
	};

	const handleTap = (seat: Seat, payload?: number) => {
		if (roundState !== "live" || resolvedRef.current || !challenge) return;
		const reaction = Date.now() - roundStartRef.current;
		const other: Seat = seat === 0 ? 1 : 0;
		switch (challenge.kind) {
			case "color": {
				const correct = discColor === challenge.target;
				resolveRound(correct ? seat : other, correct ? reaction : undefined);
				return;
			}
			case "odd":
				resolveRound(payload === challenge.oddIndex ? seat : other, payload === challenge.oddIndex ? reaction : undefined);
				return;
			case "math":
				resolveRound(payload === challenge.answer ? seat : other, payload === challenge.answer ? reaction : undefined);
				return;
			case "green":
				resolveRound(greenOn ? seat : other, greenOn ? reaction : undefined);
				return;
			case "hold":
				return;
		}
	};

	const handleHoldStart = (seat: Seat) => {
		if (roundState !== "live" || !challenge || challenge.kind !== "hold") return;
		if (heldRef.current[seat] !== null) return;
		holdStartRef.current[seat] = Date.now();
		setHoldMs((prev) => {
			const next: [number | null, number | null] = [...prev] as [number | null, number | null];
			next[seat] = 0;
			return next;
		});
	};

	const handleHoldEnd = (seat: Seat) => {
		const start = holdStartRef.current[seat];
		if (start === null || heldRef.current[seat] !== null) return;
		heldRef.current[seat] = Date.now() - start;
		holdStartRef.current[seat] = null;
		setHoldMs((prev) => {
			const next: [number | null, number | null] = [...prev] as [number | null, number | null];
			next[seat] = null;
			return next;
		});
		haptic.tap();
		if (heldRef.current[0] !== null && heldRef.current[1] !== null) finishHold();
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameSplitDuelName")}
				subtitle={t("sdLayFlat")}
				fixedCount={2}
				onStart={startMatch}
			/>
		);
	}

	const statusFor = (seat: Seat): PaneStatus => {
		if (roundState === "idle") return "idle";
		if (roundState === "countdown") return "countdown";
		if (roundState === "live") return "live";
		if (roundWinner === "tie" || roundWinner === null) return "tie";
		return roundWinner === seat ? "won" : "lost";
	};

	const paneProps = (seat: Seat) => ({
		player: players[seat],
		challenge,
		status: statusFor(seat),
		countdown,
		discColor,
		greenOn,
		holdMs: holdMs[seat],
		reactionMs: roundWinner === seat ? reactionMs : null,
		wins: wins[seat],
		onTap: (payload?: number) => handleTap(seat, payload),
		onHoldStart: () => handleHoldStart(seat),
		onHoldEnd: () => handleHoldEnd(seat),
	});

	return (
		<View style={styles.root}>
			{/* Top player faces the other way — rotate their whole pane. */}
			<RNView style={[styles.half, styles.rotated]}>
				<DuelPane {...paneProps(1)} />
			</RNView>

			<RNView style={[styles.divider, { backgroundColor: theme.surface, borderColor: theme.border }]}>
				<Text style={[styles.roundText, { color: theme.mutedText, transform: [{ rotate: "180deg" }] }]}>
					{t("mpRoundOf", { round: Math.min(roundIndex + 1, MAX_ROUNDS), total: MAX_ROUNDS })}
				</Text>
				<GameControls onReset={() => startMatch(players)} />
				<Text style={[styles.roundText, { color: theme.mutedText }]}>
					{t("mpRoundOf", { round: Math.min(roundIndex + 1, MAX_ROUNDS), total: MAX_ROUNDS })}
				</Text>
			</RNView>

			<RNView style={styles.half}>
				<DuelPane {...paneProps(0)} />
			</RNView>

			{phase === "done" ? (
				<MatchResult
					standings={players.map((p, i) => ({
						player: p,
						score: wins[i],
						detail: bestReaction[i] !== null ? t("sdFastest", { ms: Math.round(bestReaction[i] as number) }) : undefined,
					}))}
					winnerIndex={getSoleWinnerIndex(wins.map((score) => ({ score })))}
					scoreLabel={t("mpWinsLabel")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: Spacing.sm, gap: Spacing.sm },
	half: { flex: 1 },
	rotated: { transform: [{ rotate: "180deg" }] },
	divider: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		borderRadius: Radius.pill,
		borderWidth: 1,
	},
	roundText: { ...TextStyle.chipLabel },
});
