import { Ionicons } from "@expo/vector-icons";
import type { Product } from "expo-iap";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
	buySupporterProduct,
	fetchSupporterProducts,
	PLUS_SKU,
	restorePurchases,
	TIP_SKUS,
} from "@/utils/billing";

const PERKS: Array<{ icon: keyof typeof Ionicons.glyphMap; key: TranslationKey }> = [
	{ icon: "color-palette-outline", key: "plusPerkThemes" },
	{ icon: "ribbon-outline", key: "plusPerkBadge" },
	{ icon: "sparkles-outline", key: "plusPerkFuture" },
	{ icon: "heart-outline", key: "plusPerkSupport" },
];

const TIP_LABELS: Record<(typeof TIP_SKUS)[number], TranslationKey> = {
	tip_small: "plusTipSmall",
	tip_medium: "plusTipMedium",
	tip_large: "plusTipLarge",
};

/** FlightMode Plus (one-time) + tip jar. Everything else in the app stays free. */
export default function PlusScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const plus = useSupporterStore((s) => s.plus);
	const tips = useSupporterStore((s) => s.tips);
	const [products, setProducts] = useState<Product[] | null>(null);
	const [restoring, setRestoring] = useState(false);
	const [restoreResult, setRestoreResult] = useState<boolean | null>(null);

	useEffect(() => {
		captureAnalyticsEvent("support_opened", { placement: "plus", provider: "play_billing" });
		let alive = true;
		void fetchSupporterProducts().then((list) => {
			if (alive) setProducts(list);
		});
		return () => {
			alive = false;
		};
	}, []);

	const price = (sku: string) => products?.find((p) => p.id === sku)?.displayPrice;
	const plusPrice = price(PLUS_SKU);
	const storeReady = Boolean(products && products.length > 0);

	const handleRestore = async () => {
		setRestoring(true);
		setRestoreResult(await restorePurchases());
		setRestoring(false);
	};

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={["bottom"]}>
			<ScrollView contentContainerStyle={styles.content}>
				<View style={[styles.hero, { backgroundColor: theme.accentSoft, borderColor: theme.tint }]}>
					<Ionicons name="airplane" size={32} color={theme.tint} />
					<Text style={styles.title}>FlightMode Plus</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>{t("plusSubtitle")}</Text>
				</View>

				{PERKS.map((perk) => (
					<View
						key={perk.key}
						style={styles.perk}
						lightColor="transparent"
						darkColor="transparent"
						crazyColor="transparent"
					>
						<Ionicons name={perk.icon} size={20} color={theme.tint} />
						<Text style={styles.perkText}>{t(perk.key)}</Text>
					</View>
				))}

				{products === null ? (
					<ActivityIndicator style={styles.loader} color={theme.tint} />
				) : plus ? (
					<View style={[styles.owned, { backgroundColor: theme.successSurface, borderColor: theme.successBorder }]}>
						<Ionicons name="checkmark-circle" size={20} color={theme.successBorder} />
						<Text style={styles.ownedText}>{t("plusOwned")}</Text>
					</View>
				) : (
					<Pressable
						style={[styles.buy, { backgroundColor: theme.tint, opacity: plusPrice ? 1 : 0.5 }]}
						disabled={!plusPrice}
						onPress={() => void buySupporterProduct(PLUS_SKU)}
						accessibilityRole="button"
					>
						<Text style={[styles.buyText, { color: theme.onTint }]}>
							{plusPrice ? t("plusBuy", { price: plusPrice }) : t("plusUnavailable")}
						</Text>
					</Pressable>
				)}

				<Text style={[styles.sectionTitle, { color: theme.text }]}>{t("plusTipTitle")}</Text>
				<Text style={[styles.hint, { color: theme.mutedText }]}>
					{tips > 0 ? t("plusTipThanks", { count: tips }) : t("plusTipHint")}
				</Text>
				<View style={styles.tips} lightColor="transparent" darkColor="transparent" crazyColor="transparent">
					{TIP_SKUS.map((sku) => (
						<Pressable
							key={sku}
							style={[styles.tip, { borderColor: theme.border, backgroundColor: theme.card, opacity: price(sku) ? 1 : 0.5 }]}
							disabled={!price(sku)}
							onPress={() => void buySupporterProduct(sku)}
							accessibilityRole="button"
						>
							<Text style={styles.tipLabel}>{t(TIP_LABELS[sku])}</Text>
							<Text style={[styles.tipPrice, { color: theme.tint }]}>{price(sku) ?? "—"}</Text>
						</Pressable>
					))}
				</View>

				{storeReady ? (
					<Pressable style={styles.restore} onPress={() => void handleRestore()} disabled={restoring}>
						<Text style={[styles.restoreText, { color: theme.mutedText }]}>
							{restoring
								? "…"
								: restoreResult === false
									? t("plusRestoreNone")
									: t("plusRestore")}
						</Text>
					</Pressable>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: Spacing.lg, paddingBottom: Spacing["3xl"] },
	hero: {
		alignItems: "center",
		borderWidth: 1,
		borderRadius: Radius.card,
		padding: Spacing.xl,
		marginBottom: Spacing.lg,
		gap: Spacing.xs,
	},
	title: { fontSize: FontSize["2xl"], fontWeight: FontWeight.bold },
	subtitle: { fontSize: FontSize.sm, textAlign: "center", lineHeight: 19 },
	perk: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
	perkText: { flex: 1, fontSize: FontSize.base },
	loader: { marginVertical: Spacing.xl },
	buy: { marginTop: Spacing.lg, borderRadius: Radius.card, paddingVertical: Spacing.md + 2, alignItems: "center" },
	buyText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
	owned: {
		marginTop: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		borderWidth: 1,
		borderRadius: Radius.card,
		padding: Spacing.md,
	},
	ownedText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
	sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: Spacing["2xl"], marginBottom: 4 },
	hint: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
	tips: { flexDirection: "row", gap: Spacing.sm },
	tip: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: Radius.card, paddingVertical: Spacing.md, gap: 4 },
	tipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	tipPrice: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	restore: { alignItems: "center", marginTop: Spacing.xl, padding: Spacing.sm },
	restoreText: { fontSize: FontSize.sm, textDecorationLine: "underline" },
});
