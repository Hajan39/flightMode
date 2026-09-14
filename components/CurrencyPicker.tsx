import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { currencies as bundledCurrencies, type Currency } from "@/data/currencies";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { getEffectiveCurrencies, useRatesStore } from "@/store/useRatesStore";

type Props = {
	selected: string;
	onSelect: (code: string) => void;
	/** Bundled codes stay as quick chips; everything else lives in the modal. */
	chipCodes?: string[];
};

/**
 * Currency chips + a searchable "All currencies" modal. Shared by the
 * converter and the onboarding / settings home-currency pickers.
 */
export default function CurrencyPicker({ selected, onSelect, chipCodes }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const liveRates = useRatesStore((s) => s.rates);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const currencies = useMemo(() => getEffectiveCurrencies(liveRates), [liveRates]);
	const chipSet = useMemo(
		() => new Set(chipCodes ?? bundledCurrencies.map((c) => c.code)),
		[chipCodes],
	);
	const selectedExtra = currencies.find(
		(c) => c.code === selected && !chipSet.has(c.code),
	);
	const chips: Currency[] = [
		...(selectedExtra ? [selectedExtra] : []),
		...currencies.filter((c) => chipSet.has(c.code)),
	];
	const hasExtra = currencies.length > chipSet.size;

	const items = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return currencies;
		return currencies.filter(
			(c) => c.code.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q),
		);
	}, [currencies, query]);

	const pick = (code: string) => {
		haptic.tap();
		onSelect(code);
		setOpen(false);
		setQuery("");
	};

	return (
		<>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chipRow}
			>
				{hasExtra ? (
					<Pressable
						onPress={() => {
							haptic.tap();
							setOpen(true);
						}}
						accessibilityRole="button"
						accessibilityLabel={t("converterAllCurrencies")}
						style={[
							styles.chip,
							styles.moreChip,
							{ borderColor: theme.tint, backgroundColor: theme.card },
						]}
					>
						<Ionicons name="search" size={14} color={theme.tint} />
						<Text style={[styles.chipText, { color: theme.tint }]}>
							{t("converterAllCurrencies")} · {currencies.length}
						</Text>
					</Pressable>
				) : null}
				{chips.map((c) => {
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

			<Modal
				visible={open}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setOpen(false)}
			>
				<SafeAreaView
					style={[styles.modal, { backgroundColor: theme.background }]}
					edges={["top", "bottom"]}
				>
					<View style={styles.header} lightColor="transparent" darkColor="transparent">
						<TextInput
							value={query}
							onChangeText={setQuery}
							placeholder={t("converterSearchCurrency")}
							placeholderTextColor={theme.mutedText}
							autoFocus
							autoCapitalize="characters"
							autoCorrect={false}
							accessibilityLabel={t("converterSearchCurrency")}
							style={[
								styles.search,
								{
									backgroundColor: theme.inputBackground,
									borderColor: theme.border,
									color: theme.text,
								},
							]}
						/>
						<Pressable
							onPress={() => {
								haptic.tap();
								setOpen(false);
								setQuery("");
							}}
							accessibilityRole="button"
							accessibilityLabel={t("gameCancel")}
							hitSlop={8}
						>
							<Ionicons name="close" size={24} color={theme.mutedText} />
						</Pressable>
					</View>
					<FlatList
						data={items}
						keyExtractor={(c) => c.code}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.list}
						renderItem={({ item }) => {
							const isActive = item.code === selected;
							return (
								<Pressable
									onPress={() => pick(item.code)}
									accessibilityRole="button"
									accessibilityState={{ selected: isActive }}
									style={[
										styles.row,
										{
											backgroundColor: isActive ? theme.accentSoft : theme.card,
											borderColor: isActive ? theme.tint : theme.border,
										},
									]}
								>
									<Text style={[styles.rowCode, { color: theme.tint }]}>
										{item.code}
									</Text>
									<Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
										{item.nameEn}
									</Text>
									<Text style={[styles.rowSymbol, { color: theme.mutedText }]}>
										{item.symbol}
									</Text>
								</Pressable>
							);
						}}
						ListEmptyComponent={
							<Text style={[styles.empty, { color: theme.mutedText }]}>
								{t("exploreNoResults")}
							</Text>
						}
					/>
				</SafeAreaView>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	chipRow: { gap: Spacing.sm, paddingVertical: 2 },
	chip: {
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
	},
	moreChip: { flexDirection: "row", alignItems: "center", gap: 4 },
	chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	modal: { flex: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
	search: {
		flex: 1,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm + 2,
		fontSize: FontSize.md,
	},
	list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing["4xl"], gap: Spacing.sm },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		minHeight: 48,
	},
	rowCode: { width: 48, fontSize: FontSize.base, fontWeight: FontWeight.black },
	rowName: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
	rowSymbol: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	empty: { fontSize: FontSize.sm, textAlign: "center", marginTop: Spacing.xl },
});
