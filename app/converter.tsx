import { Ionicons } from "@expo/vector-icons";
import { getLocales } from "expo-localization";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { currencies, getCurrency, ratesAsOf } from "@/data/currencies";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
	convertCurrency,
	convertUnit,
	formatCurrency,
	formatUnit,
	parseAmount,
	type UnitDirection,
	type UnitKind,
	unitLabels,
} from "@/utils/convert";

type Kind = "currency" | UnitKind;

const KINDS: Array<{ id: Kind; icon: keyof typeof Ionicons.glyphMap }> = [
	{ id: "currency", icon: "cash-outline" },
	{ id: "temperature", icon: "thermometer-outline" },
	{ id: "distance", icon: "navigate-outline" },
	{ id: "weight", icon: "barbell-outline" },
];

const KIND_LABEL_KEYS = {
	currency: "converterCurrency",
	temperature: "converterTemperature",
	distance: "converterDistance",
	weight: "converterWeight",
} as const;

function deviceCurrency(): string {
	const code = getLocales()[0]?.currencyCode?.toUpperCase();
	return code && getCurrency(code) ? code : "USD";
}

export default function ConverterScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { currency, source } = useLocalSearchParams<{
		currency?: string;
		source?: string;
	}>();
	const incrementConverterUses = useAchievementStore(
		(s) => s.incrementConverterUses,
	);

	const [kind, setKind] = useState<Kind>("currency");
	const [amount, setAmount] = useState("100");
	const [from, setFrom] = useState(deviceCurrency);
	const [to, setTo] = useState(() => {
		const param = getCurrency(currency)?.code;
		const home = deviceCurrency();
		return param && param !== home ? param : home === "EUR" ? "USD" : "EUR";
	});
	const [direction, setDirection] = useState<UnitDirection>("metricToImperial");
	const countedRef = useRef(false);

	useEffect(() => {
		captureAnalyticsEvent("converter_open", {
			source: source ?? "direct",
			kind: "currency",
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const value = parseAmount(amount);

	const result = useMemo(() => {
		if (value === null) return null;
		if (kind === "currency") {
			const converted = convertCurrency(value, from, to);
			return converted === null ? null : formatCurrency(converted, to);
		}
		const converted = convertUnit(value, kind, direction);
		const [metric, imperial] = unitLabels[kind];
		return `${formatUnit(converted)} ${direction === "metricToImperial" ? imperial : metric}`;
	}, [value, kind, from, to, direction]);

	// Debounced usage event + one-time achievement counter.
	useEffect(() => {
		if (result === null) return;
		const timer = setTimeout(() => {
			captureAnalyticsEvent("converter_used", {
				kind,
				from: kind === "currency" ? from : unitLabels[kind][direction === "metricToImperial" ? 0 : 1],
				to: kind === "currency" ? to : unitLabels[kind][direction === "metricToImperial" ? 1 : 0],
			});
			if (!countedRef.current) {
				countedRef.current = true;
				incrementConverterUses();
			}
		}, 800);
		return () => clearTimeout(timer);
	}, [result, kind, from, to, direction, incrementConverterUses]);

	const swap = () => {
		haptic.tap();
		if (kind === "currency") {
			setFrom(to);
			setTo(from);
		} else {
			setDirection((d) =>
				d === "metricToImperial" ? "imperialToMetric" : "metricToImperial",
			);
		}
	};

	const fromLabel =
		kind === "currency"
			? from
			: unitLabels[kind][direction === "metricToImperial" ? 0 : 1];
	const toLabel =
		kind === "currency"
			? to
			: unitLabels[kind][direction === "metricToImperial" ? 1 : 0];

	const renderCurrencyChips = (
		selected: string,
		onSelect: (code: string) => void,
	) => (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.chipRow}
		>
			{currencies.map((c) => {
				const isActive = c.code === selected;
				return (
					<Pressable
						key={c.code}
						onPress={() => {
							haptic.tap();
							onSelect(c.code);
						}}
						accessibilityRole="button"
						accessibilityState={{ selected: isActive }}
						accessibilityLabel={c.nameEn}
						style={[
							styles.chip,
							{
								borderColor: isActive ? theme.tint : theme.border,
								backgroundColor: isActive ? theme.tint : theme.card,
							},
						]}
					>
						<Text
							style={[
								styles.chipText,
								{ color: isActive ? theme.onTint : theme.text },
							]}
						>
							{c.code}
						</Text>
					</Pressable>
				);
			})}
		</ScrollView>
	);

	return (
		<SafeAreaView
			style={[styles.screen, { backgroundColor: theme.background }]}
			edges={["bottom"]}
		>
			<ScrollView
				style={styles.screen}
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.segment} lightColor="transparent" darkColor="transparent">
					{KINDS.map((item) => {
						const isActive = item.id === kind;
						return (
							<Pressable
								key={item.id}
								onPress={() => {
									haptic.tap();
									setKind(item.id);
								}}
								accessibilityRole="button"
								accessibilityState={{ selected: isActive }}
								style={[
									styles.segmentBtn,
									{
										backgroundColor: isActive ? theme.tint : theme.card,
										borderColor: isActive ? theme.tint : theme.border,
									},
								]}
							>
								<Ionicons
									name={item.icon}
									size={18}
									color={isActive ? theme.onTint : theme.mutedText}
								/>
								<Text
									style={[
										styles.segmentText,
										{ color: isActive ? theme.onTint : theme.text },
									]}
								>
									{t(KIND_LABEL_KEYS[item.id])}
								</Text>
							</Pressable>
						);
					})}
				</View>

				<View
					style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
				>
					<Text style={[styles.label, { color: theme.mutedText }]}>
						{t("converterAmount")} · {fromLabel}
					</Text>
					<TextInput
						value={amount}
						onChangeText={setAmount}
						keyboardType="decimal-pad"
						returnKeyType="done"
						selectTextOnFocus
						accessibilityLabel={t("converterAmount")}
						style={[
							styles.input,
							{
								backgroundColor: theme.inputBackground,
								borderColor: theme.border,
								color: theme.text,
							},
						]}
					/>
					{kind === "currency" ? (
						<>
							<Text style={[styles.label, { color: theme.mutedText }]}>
								{t("converterFrom")}
							</Text>
							{renderCurrencyChips(from, setFrom)}
						</>
					) : null}

					<Pressable
						onPress={swap}
						accessibilityRole="button"
						accessibilityLabel={t("converterSwap")}
						style={[styles.swapBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
					>
						<Ionicons name="swap-vertical" size={20} color={theme.tint} />
						<Text style={[styles.swapText, { color: theme.tint }]}>
							{t("converterSwap")}
						</Text>
					</Pressable>

					{kind === "currency" ? (
						<>
							<Text style={[styles.label, { color: theme.mutedText }]}>
								{t("converterTo")}
							</Text>
							{renderCurrencyChips(to, setTo)}
						</>
					) : null}

					<Text style={[styles.label, { color: theme.mutedText }]}>
						{t("converterResult")} · {toLabel}
					</Text>
					<Text
						style={[styles.result, { color: theme.tint }]}
						accessibilityLiveRegion="polite"
					>
						{result ?? "–"}
					</Text>
				</View>

				{kind === "currency" ? (
					<View style={styles.footer} lightColor="transparent" darkColor="transparent">
						<Text style={[styles.footerText, { color: theme.mutedText }]}>
							{t("converterRatesAsOf", { date: ratesAsOf })}
						</Text>
						<Text style={[styles.footerText, { color: theme.mutedText }]}>
							{t("converterRatesDisclaimer")}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	container: { padding: Spacing.lg, paddingBottom: Spacing["4xl"], gap: Spacing.lg },
	segment: { flexDirection: "row", gap: Spacing.sm },
	segmentBtn: {
		flex: 1,
		alignItems: "center",
		gap: 4,
		paddingVertical: Spacing.sm + 2,
		borderRadius: Radius.card,
		borderWidth: 1,
	},
	segmentText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
	card: {
		borderWidth: 1,
		borderRadius: Radius.panel,
		padding: Spacing.lg,
		gap: Spacing.sm,
	},
	label: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 0.6,
		marginTop: Spacing.xs,
	},
	input: {
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		fontSize: FontSize["2xl"],
		fontWeight: FontWeight.bold,
	},
	chipRow: { gap: Spacing.sm, paddingVertical: 2 },
	chip: {
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
	},
	chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	swapBtn: {
		flexDirection: "row",
		alignSelf: "center",
		alignItems: "center",
		gap: 6,
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		marginVertical: Spacing.xs,
	},
	swapText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	result: { fontSize: FontSize["3xl"], fontWeight: FontWeight.black, letterSpacing: -0.5 },
	footer: { gap: 2, paddingHorizontal: Spacing.xs },
	footerText: { fontSize: FontSize.xs, lineHeight: 16 },
});
