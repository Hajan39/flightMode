import { Ionicons } from "@expo/vector-icons";
import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GameResult from "@/components/GameResult";
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
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

import {
	applyGust,
	type BallState,
	distanceFromCenter,
	gustIntervalMs,
	gustStrength,
	isOutOfBounds,
	ringRadius,
	scoreTurn,
	START_STATE,
	step,
} from "./logic";

const GAME_ID = "tilt-balance";
const SENSOR_INTERVAL_MS = 16;
type Phase = "setup" | "pass" | "countdown" | "playing" | "turnEnd" | "done" | "unsupported";

/**
 * Turbulence Test — hold the phone flat and keep the ball inside the ring by
 * tilting. The ring shrinks and random gusts hit you the longer you survive.
 * Pass-and-play for 1–6; the only game in the app driven by the accelerometer.
 */
export default function TiltBalanceGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { width } = useWindowDimensions();
	const plateSize = Math.min(width - Spacing.lg * 2, 340);
	const plateRadius = plateSize / 2;

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [turnIndex, setTurnIndex] = useState(0);
	const [scores, setScores] = useState<number[]>([]);
	const [ball, setBall] = useState<BallState>(START_STATE);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [inRing, setInRing] = useState(true);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	// Sensor + loop state lives in refs: the physics runs at 60 Hz and must not
	// re-create the subscription on every frame.
	const tiltRef = useRef({ x: 0, y: 0 });
	const ballRef = useRef<BallState>(START_STATE);
	const lastFrameRef = useRef(0);
	const startedAtRef = useRef(0);
	const nextGustRef = useRef(0);
	const streakStartRef = useRef<number | null>(null);
	const bestStreakRef = useRef(0);
	const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const subscriptionRef = useRef<{ remove: () => void } | null>(null);

	const solo = players.length === 1;
	const current = players[turnIndex] ?? players[0];

	const stopLoop = () => {
		if (frameRef.current) clearInterval(frameRef.current);
		frameRef.current = null;
		subscriptionRef.current?.remove();
		subscriptionRef.current = null;
	};

	useEffect(() => stopLoop, []);

	// Motion is unavailable on web and some simulators — fail soft, never crash.
	useEffect(() => {
		let cancelled = false;
		Accelerometer.isAvailableAsync()
			.then((available) => {
				if (!cancelled && !available) setPhase("unsupported");
			})
			.catch(() => {
				if (!cancelled) setPhase("unsupported");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		stopLoop();
		setPlayers(matchPlayers);
		setScores(Array(matchPlayers.length).fill(0));
		setTurnIndex(0);
		setProgress(undefined);
		setPhase(matchPlayers.length === 1 ? "countdown" : "pass");
	};

	const beginTurn = () => {
		ballRef.current = START_STATE;
		setBall(START_STATE);
		setElapsedMs(0);
		setInRing(true);
		bestStreakRef.current = 0;
		streakStartRef.current = null;
		startedAtRef.current = Date.now();
		lastFrameRef.current = Date.now();
		nextGustRef.current = Date.now() + gustIntervalMs(0);

		Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
		subscriptionRef.current = Accelerometer.addListener(({ x, y }) => {
			// Phone flat, screen up: +x tilts right, -y tilts "down" the screen.
			tiltRef.current = {
				x: Math.max(-1, Math.min(1, x)),
				y: Math.max(-1, Math.min(1, -y)),
			};
		});

		frameRef.current = setInterval(tick, SENSOR_INTERVAL_MS);
		setPhase("playing");
	};

	const tick = () => {
		const now = Date.now();
		const dtMs = now - lastFrameRef.current;
		lastFrameRef.current = now;
		const elapsed = now - startedAtRef.current;

		let next = step(ballRef.current, tiltRef.current.x, tiltRef.current.y, dtMs);
		if (now >= nextGustRef.current) {
			next = applyGust(next, gustStrength(elapsed));
			nextGustRef.current = now + gustIntervalMs(elapsed);
			haptic.tap();
		}
		ballRef.current = next;

		const inside = distanceFromCenter(next) <= ringRadius(elapsed);
		if (inside && streakStartRef.current === null) {
			streakStartRef.current = now;
		} else if (!inside && streakStartRef.current !== null) {
			bestStreakRef.current = Math.max(
				bestStreakRef.current,
				now - streakStartRef.current,
			);
			streakStartRef.current = null;
		}

		setBall(next);
		setElapsedMs(elapsed);
		setInRing(inside);

		if (isOutOfBounds(next)) endTurn(elapsed);
	};

	const endTurn = (survivedMs: number) => {
		stopLoop();
		haptic.error();
		if (streakStartRef.current !== null) {
			bestStreakRef.current = Math.max(
				bestStreakRef.current,
				Date.now() - streakStartRef.current,
			);
			streakStartRef.current = null;
		}
		const turnScore = scoreTurn(survivedMs, bestStreakRef.current);
		setScores((prev) => {
			const nextScores = [...prev];
			nextScores[turnIndex] = turnScore;
			return nextScores;
		});
		setPhase("turnEnd");
	};

	const nextTurn = () => {
		haptic.tap();
		const next = turnIndex + 1;
		if (next >= players.length) {
			if (solo) {
				setProgress(updateProgress(GAME_ID, scores[0], { won: scores[0] > 0 }));
			} else {
				setProgress(recordMatch(GAME_ID, scores.map((score) => ({ score }))));
			}
			setPhase("done");
			return;
		}
		setTurnIndex(next);
		setPhase("pass");
	};

	if (phase === "unsupported") {
		return (
			<View style={styles.centered}>
				<Ionicons name="phone-portrait-outline" size={40} color={theme.mutedText} />
				<Text style={[styles.unsupported, { color: theme.mutedText }]}>
					{t("tbNoSensor")}
				</Text>
			</View>
		);
	}

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameTiltBalanceName")}
				subtitle={t("tbIntro")}
				minPlayers={1}
				onStart={startMatch}
			/>
		);
	}

	const radius = ringRadius(elapsedMs);
	const seconds = (elapsedMs / 1000).toFixed(1);
	const ballColor = inRing ? (current?.color ?? theme.tint) : theme.danger;

	return (
		<View style={styles.root}>
			<RNView style={styles.topRow}>
				{current ? (
					<TurnBanner
						player={current}
						compact
						label={solo ? t("tbKeepItSteady") : undefined}
						right={
							<Text style={[styles.timer, { color: inRing ? theme.tint : theme.danger }]}>
								{seconds}s
							</Text>
						}
					/>
				) : null}
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			{!solo ? (
				<PlayerScoreStrip
					players={players}
					scores={scores}
					activeIndex={phase === "playing" ? turnIndex : undefined}
				/>
			) : null}

			<RNView style={styles.plateArea}>
				<RNView
					style={[
						styles.plate,
						{
							width: plateSize,
							height: plateSize,
							borderRadius: plateRadius,
							backgroundColor: theme.card,
							borderColor: theme.border,
						},
					]}
				>
					{/* Target ring — shrinks as the turn goes on. */}
					<RNView
						style={[
							styles.ring,
							{
								width: plateSize * radius,
								height: plateSize * radius,
								borderRadius: (plateSize * radius) / 2,
								borderColor: inRing ? theme.successBorder : theme.danger,
							},
						]}
					/>
					<RNView
						style={[
							styles.ball,
							{
								backgroundColor: ballColor,
								transform: [
									{ translateX: ball.x * plateRadius },
									{ translateY: ball.y * plateRadius },
								],
							},
						]}
					/>
				</RNView>
				<Text style={[styles.hint, { color: theme.mutedText }]}>
					{phase === "playing" ? t("tbHint") : t("tbHoldFlat")}
				</Text>
			</RNView>

			{phase === "turnEnd" ? (
				<Animated.View entering={FadeIn.duration(200)} style={styles.turnEnd}>
					<Text style={[styles.turnScore, { color: current?.color ?? theme.tint }]}>
						{scores[turnIndex]}
					</Text>
					<Text style={[styles.turnText, { color: theme.mutedText }]}>
						{t("tbSurvived", { seconds })}
					</Text>
					<Pressable
						onPress={nextTurn}
						accessibilityRole="button"
						style={[styles.nextBtn, { backgroundColor: theme.tint }]}
					>
						<Text style={[styles.nextText, { color: theme.onTint }]}>
							{turnIndex + 1 >= players.length ? t("hmSeeResult") : t("hmNextRound")}
						</Text>
					</Pressable>
				</Animated.View>
			) : null}

			{current ? (
				<PassDeviceOverlay
					visible={phase === "pass"}
					toPlayer={current}
					hint={t("tbHoldFlat")}
					onReady={() => setPhase("countdown")}
				/>
			) : null}
			{phase === "countdown" ? <GameCountdown onComplete={beginTurn} /> : null}

			{phase === "done" && solo ? (
				<GameResult
					title={t("gameTiltBalanceName")}
					score={scores[0]}
					isNewBest={progress?.isNewBest}
					best={progress?.best}
					last={progress?.previousBest}
					streak={progress?.currentStreak}
					onPlayAgain={() => startMatch(players)}
				/>
			) : null}
			{phase === "done" && !solo ? (
				<MatchResult
					standings={players.map((p, i) => ({ player: p, score: scores[i] }))}
					winnerIndex={getSoleWinnerIndex(scores.map((score) => ({ score })))}
					scoreLabel={t("tbPoints")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.md,
		padding: Spacing["2xl"],
	},
	unsupported: { ...TextStyle.hint, textAlign: "center", lineHeight: 20 },
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	timer: { fontSize: FontSize.base, fontWeight: FontWeight.black },
	plateArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },
	plate: {
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	ring: { position: "absolute", borderWidth: 2, borderStyle: "dashed" },
	ball: { width: 34, height: 34, borderRadius: 17 },
	hint: { ...TextStyle.hint, textAlign: "center", paddingHorizontal: Spacing.lg },
	turnEnd: { alignItems: "center", gap: Spacing.xs },
	turnScore: { fontSize: FontSize["4xl"], fontWeight: FontWeight.black },
	turnText: { ...TextStyle.hint },
	nextBtn: {
		marginTop: Spacing.sm,
		paddingHorizontal: Spacing["4xl"],
		paddingVertical: Spacing.md + 2,
		borderRadius: Radius.button,
	},
	nextText: { ...TextStyle.buttonSecondary },
});
