import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";
import type { TranslationKey } from "@/i18n/translations";

const ROUND_SECONDS = 40;

type Command = {
	id: string;
	labelKey: TranslationKey;
	icon: string;
	/** Minimum score needed to unlock this command */
	unlockAt: number;
};

const COMMANDS: Command[] = [
	{
		id: "seatbelt",
		labelKey: "ccCmdSeatbelt",
		icon: "shield-checkmark-outline",
		unlockAt: 0,
	},
	{
		id: "tray",
		labelKey: "ccCmdTray",
		icon: "restaurant-outline",
		unlockAt: 0,
	},
	{ id: "window", labelKey: "ccCmdWindow", icon: "sunny-outline", unlockAt: 0 },
	{
		id: "phone",
		labelKey: "ccCmdPhone",
		icon: "phone-portrait-outline",
		unlockAt: 0,
	},
	{
		id: "light",
		labelKey: "ccCmdLight",
		icon: "flashlight-outline",
		unlockAt: 40,
	},
	{
		id: "music",
		labelKey: "ccCmdMusic",
		icon: "musical-notes-outline",
		unlockAt: 80,
	},
	{ id: "bag", labelKey: "ccCmdBag", icon: "bag-outline", unlockAt: 130 },
	{ id: "wifi", labelKey: "ccCmdWifi", icon: "wifi-outline", unlockAt: 200 },
];

function getActiveCommands(currentScore: number): Command[] {
	return COMMANDS.filter((cmd) => currentScore >= cmd.unlockAt);
}

function randomCommand(currentScore: number, excludeId?: string) {
	const pool = getActiveCommands(currentScore).filter(
		(item) => !excludeId || item.id !== excludeId,
	);
	return pool[Math.floor(Math.random() * pool.length)];
}

/** Number of decoy choices increases with score */
function getDecoyCount(currentScore: number): number {
	if (currentScore >= 150) return 4;
	if (currentScore >= 80) return 3;
	return 2;
}

export default function CabinCallGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
	const [score, setScore] = useState(0);
	const [streak, setStreak] = useState(0);
	const [target, setTarget] = useState<Command>(() => randomCommand(0));
	const scoreRef = useRef(0);

	useEffect(() => {
		if (secondsLeft <= 0) {
			updateProgress("cabin-call", scoreRef.current);
			return;
		}

		const timer = setTimeout(() => {
			setSecondsLeft((prev) => prev - 1);
		}, 1000);

		return () => clearTimeout(timer);
	}, [secondsLeft, updateProgress]);

	const [choices, setChoices] = useState<Command[]>(() => {
		const active = getActiveCommands(0);
		const numDecoys = getDecoyCount(0);
		const decoys = active
			.filter((item) => item.id !== target.id)
			.sort(() => Math.random() - 0.5)
			.slice(0, numDecoys);
		return [target, ...decoys].sort(() => Math.random() - 0.5);
	});

	useEffect(() => {
		const active = getActiveCommands(score);
		const numDecoys = getDecoyCount(score);
		const decoys = active
			.filter((item) => item.id !== target.id)
			.sort(() => Math.random() - 0.5)
			.slice(0, numDecoys);
		setChoices([target, ...decoys].sort(() => Math.random() - 0.5));
	}, [target]);

	const restart = () => {
		setSecondsLeft(ROUND_SECONDS);
		setScore(0);
		scoreRef.current = 0;
		setStreak(0);
		setTarget(randomCommand(0));
	};

	const handleChoice = (choice: Command) => {
		if (secondsLeft <= 0) {
			restart();
			return;
		}

		if (choice.id === target.id) {
			haptic.success();
			setScore((prev) => {
				const next = prev + 10 + Math.min(10, streak * 2);
				scoreRef.current = next;
				return next;
			});
			setStreak((prev) => prev + 1);
		} else {
			setScore((prev) => {
				const next = Math.max(0, prev - 6);
				scoreRef.current = next;
				return next;
			});
			setStreak(0);
		}

		setTarget((prev) => randomCommand(scoreRef.current, prev.id));
	};

	return (
		<View style={styles.root}>
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("ccTime")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{secondsLeft}
					</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("ccScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</View>
			</View>

			<View
				style={[
					styles.targetCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.targetHint, { color: theme.mutedText }]}>
					{t("ccCrewSays")}
				</Text>
				<Ionicons name={target.icon as never} size={40} color={theme.tint} />
				<Text style={styles.targetText}>{t(target.labelKey)}</Text>
			</View>

			<View style={styles.choiceList}>
				{choices.map((choice) => (
					<Pressable
						key={choice.id}
						style={[
							styles.choice,
							{ backgroundColor: theme.elevated, borderColor: theme.border },
						]}
						onPress={() => handleChoice(choice)}
					>
						<Ionicons
							name={choice.icon as never}
							size={20}
							color={theme.tint}
						/>
						<Text style={styles.choiceText}>{t(choice.labelKey)}</Text>
					</Pressable>
				))}
			</View>

			<Text style={[styles.streakText, { color: theme.mutedText }]}>
				{t("ccStreak", { streak })}
			</Text>
			{secondsLeft <= 0 ? (
				<Pressable
					style={[styles.button, { backgroundColor: theme.tint }]}
					onPress={restart}
				>
					<Text style={styles.buttonText}>{t("ccPlayAgain")}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	statBlock: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
	statDivider: { width: 1, height: 56 },
	targetCard: {
		borderRadius: 16,
		borderWidth: 1,
		paddingVertical: 20,
		alignItems: "center",
		gap: 8,
	},
	targetHint: { fontSize: 13, fontWeight: "600" },
	targetText: {
		fontSize: 20,
		fontWeight: "800",
		textAlign: "center",
		paddingHorizontal: 12,
	},
	choiceList: { gap: 10 },
	choice: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 14,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	choiceText: { fontSize: 15, fontWeight: "700" },
	streakText: { textAlign: "center", fontSize: 13, fontWeight: "600" },
	button: {
		alignItems: "center",
		paddingVertical: 14,
		borderRadius: 14,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "900",
		letterSpacing: 0.8,
	},
});
