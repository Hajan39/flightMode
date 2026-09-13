import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useEffect, useState } from "react";
import {
	Pressable,
	View as RNView,
	ScrollView,
	StyleSheet,
	TextInput,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { MAX_MATCH_PLAYERS, PlayerColors } from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { type MatchPlayer, useMatchPlayers } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import {
	MAX_PLAYER_NAME_LENGTH,
	usePlayersStore,
} from "@/store/usePlayersStore";

type Props = {
	/** Game title shown at the top (usually `t(def.titleKey)`). */
	title: string;
	/** One-line rules teaser or hint under the title. */
	subtitle?: string;
	minPlayers?: number;
	maxPlayers?: number;
	/** Locks the player count (e.g. 2 for head-to-head games). */
	fixedCount?: number;
	/** Game-specific options (best-of, difficulty, board mode) rendered between names and Start. */
	children?: ReactNode;
	/** Show the name fields expanded on first render (icebreaker games want names). */
	namesExpanded?: boolean;
	startLabel?: string;
	onStart: (players: MatchPlayer[]) => void;
};

/**
 * Shared setup screen for every multiplayer game: player count chips, optional
 * per-seat names (persisted across games), game options, and a Start button.
 */
export default function PlayerSetup({
	title,
	subtitle,
	minPlayers = 2,
	maxPlayers = MAX_MATCH_PLAYERS,
	fixedCount,
	children,
	namesExpanded = false,
	startLabel,
	onStart,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const seats = usePlayersStore((s) => s.seats);
	const lastCount = usePlayersStore((s) => s.lastCount);
	const setSeatName = usePlayersStore((s) => s.setSeatName);
	const setLastCount = usePlayersStore((s) => s.setLastCount);

	const clamp = (n: number) => Math.max(minPlayers, Math.min(maxPlayers, n));
	const [count, setCount] = useState(fixedCount ?? clamp(lastCount));
	const [showNames, setShowNames] = useState(
		namesExpanded || seats.slice(0, count).some((s) => s.name.trim().length > 0),
	);
	const players = useMatchPlayers(count);

	useEffect(() => {
		if (fixedCount !== undefined) setCount(fixedCount);
	}, [fixedCount]);

	const handleStart = () => {
		haptic.tap();
		if (fixedCount === undefined) setLastCount(count);
		onStart(players);
	};

	const countOptions = Array.from(
		{ length: maxPlayers - minPlayers + 1 },
		(_, i) => minPlayers + i,
	);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={styles.container}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
		>
			<Animated.View entering={FadeInDown.duration(220)} style={styles.header}>
				<Text style={[styles.title, { color: theme.text }]}>{title}</Text>
				{subtitle ? (
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{subtitle}
					</Text>
				) : null}
			</Animated.View>

			{fixedCount === undefined ? (
				<RNView style={styles.block}>
					<Text style={[styles.blockLabel, { color: theme.mutedText }]}>
						{t("mpSelectPlayers")}
					</Text>
					<RNView style={styles.countRow}>
						{countOptions.map((n) => {
							const active = count === n;
							return (
								<Pressable
									key={n}
									style={[
										styles.countBtn,
										{
											backgroundColor: active ? theme.tint : theme.card,
											borderColor: active ? theme.tint : theme.border,
										},
									]}
									onPress={() => {
										haptic.tap();
										setCount(n);
									}}
									accessibilityRole="button"
									accessibilityLabel={t("mpPlayersCount", { n })}
									accessibilityState={{ selected: active }}
								>
									<Text
										style={[
											styles.countBtnText,
											{ color: active ? theme.onTint : theme.text },
										]}
									>
										{n}
									</Text>
								</Pressable>
							);
						})}
					</RNView>
				</RNView>
			) : null}

			<RNView style={styles.block}>
				<Pressable
					onPress={() => {
						haptic.tap();
						setShowNames((v) => !v);
					}}
					style={styles.namesToggle}
					accessibilityRole="button"
					accessibilityState={{ expanded: showNames }}
				>
					<RNView style={styles.dotRow}>
						{players.map((p) => (
							<RNView
								key={p.index}
								style={[styles.dot, { backgroundColor: p.color }]}
							/>
						))}
					</RNView>
					<Text style={[styles.namesToggleText, { color: theme.text }]}>
						{showNames ? t("mpHideNames") : t("mpAddNames")}
					</Text>
					<Ionicons
						name={showNames ? "chevron-up" : "chevron-down"}
						size={18}
						color={theme.mutedText}
					/>
				</Pressable>

				{showNames ? (
					<Animated.View entering={FadeIn.duration(160)} style={styles.nameList}>
						{players.map((p) => (
							<RNView key={p.index} style={styles.nameRow}>
								<RNView style={[styles.dotLarge, { backgroundColor: p.color }]}>
									<Text style={styles.dotLargeText}>{p.index + 1}</Text>
								</RNView>
								<TextInput
									value={seats[p.index]?.name ?? ""}
									onChangeText={(v) => setSeatName(p.index, v)}
									placeholder={
										p.isHost
											? `${t("mpPlayerN", { n: 1 })} · ${t("mpYouHint")}`
											: t("mpPlayerN", { n: p.index + 1 })
									}
									placeholderTextColor={theme.mutedText}
									maxLength={MAX_PLAYER_NAME_LENGTH}
									returnKeyType="done"
									autoCorrect={false}
									accessibilityLabel={t("mpNameFor", { n: p.index + 1 })}
									style={[
										styles.nameInput,
										{
											backgroundColor: theme.inputBackground,
											borderColor: theme.border,
											color: theme.text,
										},
									]}
								/>
							</RNView>
						))}
					</Animated.View>
				) : null}
			</RNView>

			{children ? <RNView style={styles.block}>{children}</RNView> : null}

			<Pressable
				style={[styles.startBtn, { backgroundColor: theme.tint }]}
				onPress={handleStart}
				accessibilityRole="button"
				accessibilityLabel={startLabel ?? t("start")}
			>
				<Ionicons name="play" size={20} color={theme.onTint} />
				<Text style={[styles.startBtnText, { color: theme.onTint }]}>
					{startLabel ?? t("start")}
				</Text>
			</Pressable>
		</ScrollView>
	);
}

/** Small helper for option chips inside `PlayerSetup` children. */
export function OptionChips<T extends string | number>({
	label,
	options,
	value,
	onChange,
}: {
	label?: string;
	options: Array<{ value: T; label: string; hint?: string }>;
	value: T;
	onChange: (value: T) => void;
}) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const haptic = useHaptic();
	return (
		<RNView style={styles.optionBlock}>
			{label ? (
				<Text style={[styles.blockLabel, { color: theme.mutedText }]}>{label}</Text>
			) : null}
			<RNView style={styles.optionRow}>
				{options.map((opt) => {
					const active = opt.value === value;
					return (
						<Pressable
							key={String(opt.value)}
							onPress={() => {
								haptic.tap();
								onChange(opt.value);
							}}
							accessibilityRole="button"
							accessibilityState={{ selected: active }}
							style={[
								styles.optionChip,
								{
									backgroundColor: active ? theme.tint : theme.card,
									borderColor: active ? theme.tint : theme.border,
								},
							]}
						>
							<Text
								style={[
									styles.optionChipText,
									{ color: active ? theme.onTint : theme.text },
								]}
							>
								{opt.label}
							</Text>
							{opt.hint ? (
								<Text
									style={[
										styles.optionChipHint,
										{ color: active ? theme.onTint : theme.mutedText },
									]}
								>
									{opt.hint}
								</Text>
							) : null}
						</Pressable>
					);
				})}
			</RNView>
		</RNView>
	);
}

export { PlayerColors };

const styles = StyleSheet.create({
	scroll: { flex: 1, width: "100%" },
	container: {
		flexGrow: 1,
		justifyContent: "center",
		padding: Spacing.xl,
		paddingBottom: Spacing["4xl"],
		gap: Spacing.xl,
	},
	header: { alignItems: "center", gap: Spacing.xs },
	title: {
		fontSize: FontSize["3xl"],
		fontWeight: FontWeight.black,
		textAlign: "center",
		letterSpacing: -0.5,
	},
	subtitle: { ...TextStyle.hint, textAlign: "center", paddingHorizontal: Spacing.md },
	block: { gap: Spacing.sm },
	blockLabel: { ...TextStyle.statLabel },
	countRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
	countBtn: {
		width: 48,
		height: 48,
		borderRadius: Radius.card,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	countBtnText: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
	namesToggle: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		minHeight: 44,
	},
	dotRow: { flexDirection: "row", gap: 4 },
	dot: { width: 10, height: 10, borderRadius: 5 },
	namesToggleText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
	nameList: { gap: Spacing.sm },
	nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	dotLarge: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	dotLargeText: { color: "#0b1620", fontSize: FontSize.xs, fontWeight: FontWeight.black },
	nameInput: {
		flex: 1,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm + 2,
		fontSize: FontSize.base,
	},
	optionBlock: { gap: Spacing.sm },
	optionRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
	optionChip: {
		flexGrow: 1,
		minWidth: 90,
		alignItems: "center",
		paddingVertical: Spacing.sm + 2,
		paddingHorizontal: Spacing.md,
		borderRadius: Radius.card,
		borderWidth: 1.5,
	},
	optionChipText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
	optionChipHint: { fontSize: FontSize.xs, marginTop: 2 },
	startBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.lg,
		borderRadius: Radius.button,
	},
	startBtnText: { ...TextStyle.buttonPrimary },
});
