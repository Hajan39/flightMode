import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";

import { type Challenge, COLOR_HEX, type ColorId } from "./logic";

export type PaneStatus = "idle" | "countdown" | "live" | "won" | "lost" | "tie";

export type PaneProps = {
	player: MatchPlayer;
	challenge: Challenge | null;
	status: PaneStatus;
	/** 3,2,1 during countdown. */
	countdown: number;
	/** Current disc color for the "color" challenge. */
	discColor: ColorId | null;
	/** True once the "green" challenge has turned green. */
	greenOn: boolean;
	/** Live hold duration for the "hold" challenge (ms), null when not holding. */
	holdMs: number | null;
	/** Reaction time to show on a won pane. */
	reactionMs: number | null;
	wins: number;
	onTap: (payload?: number) => void;
	onHoldStart: () => void;
	onHoldEnd: () => void;
};

const COLOR_KEYS: Record<ColorId, TranslationKey> = {
	red: "sdColorRed",
	blue: "sdColorBlue",
	green: "sdColorGreen",
	yellow: "sdColorYellow",
	purple: "sdColorPurple",
	orange: "sdColorOrange",
};

/**
 * One half of the Split Duel screen. The parent renders two of these with the
 * same props; the top one is rotated 180° so it faces the other player.
 */
export default function DuelPane({
	player,
	challenge,
	status,
	countdown,
	discColor,
	greenOn,
	holdMs,
	reactionMs,
	wins,
	onTap,
	onHoldStart,
	onHoldEnd,
}: PaneProps) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	const resultBg =
		status === "won"
			? `${player.color}33`
			: status === "lost"
				? `${theme.danger}22`
				: status === "tie"
					? theme.surface
					: theme.card;

	const renderBody = () => {
		if (status === "idle") {
			return (
				<Text style={[styles.big, { color: theme.mutedText }]}>{t("sdGetReady")}</Text>
			);
		}
		if (status === "countdown") {
			return (
				<Animated.Text
					key={countdown}
					entering={ZoomIn.duration(160)}
					style={[styles.countdown, { color: player.color }]}
				>
					{countdown > 0 ? countdown : t("gameGo")}
				</Animated.Text>
			);
		}
		if (status !== "live") {
			const label =
				status === "won" ? t("sdRoundWon") : status === "lost" ? t("sdRoundLost") : t("sdRoundTie");
			return (
				<Animated.View entering={FadeIn.duration(160)} style={styles.center}>
					<Text style={[styles.big, { color: status === "won" ? player.color : status === "lost" ? theme.danger : theme.mutedText }]}>
						{status === "won" ? "🏆 " : status === "lost" ? "✖ " : "🤝 "}
						{label}
					</Text>
					{status === "won" && reactionMs !== null ? (
						<Text style={[styles.sub, { color: theme.mutedText }]}>
							{t("sdReaction", { ms: Math.round(reactionMs) })}
						</Text>
					) : null}
				</Animated.View>
			);
		}
		if (!challenge) return null;

		switch (challenge.kind) {
			case "color":
				return (
					<Pressable style={styles.fill} onPress={() => onTap()} accessibilityRole="button">
						<Text style={[styles.prompt, { color: theme.text }]}>
							{t("sdTapWhen", { color: t(COLOR_KEYS[challenge.target]) })}
						</Text>
						<RNView
							style={[
								styles.disc,
								{ backgroundColor: discColor ? COLOR_HEX[discColor] : theme.surface },
							]}
						/>
					</Pressable>
				);
			case "odd":
				return (
					<RNView style={styles.center}>
						<Text style={[styles.prompt, { color: theme.text }]}>{t("sdFindOdd")}</Text>
						<RNView style={styles.grid}>
							{challenge.grid.map((emoji, i) => (
								<Pressable
									key={`${i}-${emoji}`}
									onPress={() => onTap(i)}
									style={[styles.gridCell, { backgroundColor: theme.card, borderColor: theme.border }]}
									accessibilityRole="button"
								>
									<Text style={styles.gridEmoji}>{emoji}</Text>
								</Pressable>
							))}
						</RNView>
					</RNView>
				);
			case "hold":
				return (
					<RNView style={styles.center}>
						<Text style={[styles.prompt, { color: theme.text }]}>
							{t("sdHoldRelease", { seconds: (challenge.targetMs / 1000).toFixed(1) })}
						</Text>
						<Pressable
							onPressIn={onHoldStart}
							onPressOut={onHoldEnd}
							style={[
								styles.holdBtn,
								{
									backgroundColor: holdMs !== null ? player.color : theme.card,
									borderColor: player.color,
								},
							]}
							accessibilityRole="button"
						>
							<Text style={[styles.holdText, { color: holdMs !== null ? "#0b1620" : theme.text }]}>
								{holdMs !== null ? t("sdHolding") : t("sdHold")}
							</Text>
						</Pressable>
					</RNView>
				);
			case "math":
				return (
					<RNView style={styles.center}>
						<Text style={[styles.mathPrompt, { color: theme.text }]}>{challenge.prompt}</Text>
						<RNView style={styles.optionRow}>
							{challenge.options.map((opt) => (
								<Pressable
									key={opt}
									onPress={() => onTap(opt)}
									style={[styles.optionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
									accessibilityRole="button"
								>
									<Text style={[styles.optionText, { color: theme.text }]}>{opt}</Text>
								</Pressable>
							))}
						</RNView>
					</RNView>
				);
			case "green":
				return (
					<Pressable
						style={[
							styles.fill,
							{ backgroundColor: greenOn ? COLOR_HEX.green : theme.surface, borderRadius: Radius.panel },
						]}
						onPress={() => onTap()}
						accessibilityRole="button"
					>
						<Text style={[styles.prompt, { color: greenOn ? "#0b1620" : theme.text }]}>
							{greenOn ? t("sdTapNow") : t("sdTapGreen")}
						</Text>
					</Pressable>
				);
		}
	};

	return (
		<RNView style={[styles.pane, { borderColor: player.color, backgroundColor: resultBg }]}>
			<RNView style={styles.header}>
				<RNView style={[styles.dot, { backgroundColor: player.color }]} />
				<Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
					{player.name}
				</Text>
				<Text style={[styles.wins, { color: player.color }]}>
					{"●".repeat(wins)}
					<Text style={{ color: theme.border }}>{"●".repeat(Math.max(0, 3 - wins))}</Text>
				</Text>
			</RNView>
			<RNView style={styles.body}>{renderBody()}</RNView>
		</RNView>
	);
}

const styles = StyleSheet.create({
	pane: {
		flex: 1,
		borderWidth: 2,
		borderRadius: Radius.panel,
		padding: Spacing.md,
		gap: Spacing.sm,
	},
	header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	dot: { width: 10, height: 10, borderRadius: 5 },
	name: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	wins: { fontSize: FontSize.sm, letterSpacing: 2 },
	body: { flex: 1 },
	fill: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
	center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.sm },
	big: { fontSize: FontSize.xl, fontWeight: FontWeight.black, textAlign: "center" },
	sub: { ...TextStyle.hint },
	countdown: { fontSize: FontSize["5xl"], fontWeight: FontWeight.black },
	prompt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, textAlign: "center" },
	disc: { width: 96, height: 96, borderRadius: 48 },
	grid: { width: 174, flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
	gridCell: { width: 54, height: 54, borderRadius: Radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
	gridEmoji: { fontSize: 26 },
	holdBtn: {
		width: 160,
		paddingVertical: Spacing.lg,
		borderRadius: Radius.button,
		borderWidth: 2,
		alignItems: "center",
	},
	holdText: { ...TextStyle.buttonSecondary },
	mathPrompt: { fontSize: FontSize["3xl"], fontWeight: FontWeight.black },
	optionRow: { flexDirection: "row", gap: Spacing.md },
	optionBtn: {
		minWidth: 84,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: Radius.button,
		borderWidth: 1.5,
		alignItems: "center",
	},
	optionText: { fontSize: FontSize["2xl"], fontWeight: FontWeight.black },
});
