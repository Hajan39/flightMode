import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import CurrencyPicker from "@/components/CurrencyPicker";
import { deviceCurrencyCode, getCurrency } from "@/data/currencies";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { getEffectiveCurrencies, getRatesProvenance, useRatesStore } from "@/store/useRatesStore";
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
	const liveRates = useRatesStore((s) => s.rates);
	const liveAsOf = useRatesStore((s) => s.ratesAsOf);
	const ratesStatus = useRatesStore((s) => s.status);
	const syncRates = useRatesStore((s) => s.syncRates);
	const online = useNetworkStore((s) => s.isInternetReachable) === true;
	const currencies = useMemo(() => getEffectiveCurrencies(liveRates), [liveRates]);
	const provenance = getRatesProvenance({ rates: liveRates, ratesAsOf: liveAsOf });

	const homeCurrency = useSettingsStore((s) => s.homeCurrency);
	const home = homeCurrency ?? deviceCurrencyCode();
	const [kind, setKind] = useState<Kind>("currency");
	const [amount, setAmount] = useState("100");
	const [from, setFrom] = useState(home);
	const [to, setTo] = useState(() => {
		const param = getCurrency(currency)?.code ?? currency?.toUpperCase();
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
			const converted = convertCurrency(value, from, to, currencies);
			return converted === null ? null : formatCurrency(converted, to);
		}
		const converted = convertUnit(value, kind, direction);
		const [metric, imperial] = unitLabels[kind];
		return `${formatUnit(converted)} ${direction === "metricToImperial" ? imperial : metric}`;
	}, [value, kind, from, to, direction, currencies]);

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
							<CurrencyPicker selected={from} onSelect={setFrom} />
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
							<CurrencyPicker selected={to} onSelect={setTo} />
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
							{provenance.live
								? t("converterRatesLive", { date: provenance.asOf })
								: t("converterRatesAsOf", { date: provenance.asOf })}
						</Text>
						<Text style={[styles.footerText, { color: theme.mutedText }]}>
							{t("converterRatesDisclaimer")}
						</Text>
						{online ? (
							<Pressable
								onPress={() => {
									haptic.tap();
									void syncRates({ force: true });
								}}
								disabled={ratesStatus === "syncing"}
								accessibilityRole="button"
								style={[styles.refreshBtn, { borderColor: theme.border, opacity: ratesStatus === "syncing" ? 0.6 : 1 }]}
							>
								<Ionicons name="cloud-download-outline" size={16} color={theme.tint} />
								<Text style={[styles.refreshText, { color: theme.tint }]}>
									{ratesStatus === "syncing" ? t("converterRatesUpdating") : t("converterRatesRefresh")}
								</Text>
							</Pressable>
						) : null}
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
	refreshBtn: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: 6,
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		marginTop: Spacing.sm,
	},
	refreshText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
