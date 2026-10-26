import { Ionicons } from "@expo/vector-icons";
import type { Product } from "expo-iap";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  buySupporterProduct,
  fetchSupporterProducts,
  PLUS_SKU,
  restorePurchases,
  subscribePurchaseUpdates,
  TIP_SKUS,
} from "@/utils/billing";

const PERKS: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  key: TranslationKey;
}> = [
  { icon: "color-palette-outline", key: "plusPerkThemes" },
  { icon: "ribbon-outline", key: "plusPerkBadge" },
  { icon: "sparkles-outline", key: "plusPerkFuture" },
  { icon: "heart-outline", key: "plusPerkSupport" },
];

const TIP_LABELS: Record<(typeof TIP_SKUS)[number], TranslationKey> = {
  tip_large: "plusTipLarge",
  tip_medium: "plusTipMedium",
  tip_small: "plusTipSmall",
};

interface BuyButtonProps {
  /** This product's Play sheet is opening. */
  busy: boolean;
  /** Another checkout is in progress. */
  disabled: boolean;
  label: string;
  onPress: () => void;
  /** Store price; missing = product unavailable. */
  price: string | undefined;
  theme: (typeof Colors)["dark"];
}

function BuyPlusButton({
  busy,
  disabled,
  label,
  onPress,
  price,
  theme,
}: BuyButtonProps) {
  const inactive = !price || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.buy,
        { backgroundColor: theme.tint, opacity: inactive ? 0.5 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.onTint} />
      ) : (
        <Text style={[styles.buyText, { color: theme.onTint }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function TipButton({
  busy,
  disabled,
  label,
  onPress,
  price,
  theme,
}: BuyButtonProps) {
  const inactive = !price || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.tip,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: inactive ? 0.5 : 1,
        },
      ]}
    >
      <Text style={styles.tipLabel}>{label}</Text>
      {busy ? (
        <ActivityIndicator color={theme.tint} />
      ) : (
        <Text style={[styles.tipPrice, { color: theme.tint }]}>
          {price ?? "—"}
        </Text>
      )}
    </Pressable>
  );
}

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
  // SKU whose Play sheet is opening / open: blocks a second purchase tap.
  const [busySku, setBusySku] = useState<string | null>(null);
  // Play accepted the order but the payment (cash, bank transfer) clears later.
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const online = useNetworkStore((s) => s.isInternetReachable) === true;

  useEffect(
    () =>
      subscribePurchaseUpdates((productId, update) => {
        setBusySku(null);
        setPendingSku(update === "pending" ? productId : null);
      }),
    []
  );

  const buy = async (sku: string) => {
    if (busySku) {
      return;
    }
    setBusySku(sku);
    try {
      await buySupporterProduct(sku);
    } finally {
      setBusySku(null);
    }
  };

  useEffect(() => {
    captureAnalyticsEvent("support_opened", {
      placement: "plus",
      provider: "play_billing",
    });
    let alive = true;
    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void fetchSupporterProducts().then((list) => {
      if (alive) {
        setProducts(list);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const price = (sku: string) =>
    products?.find((p) => p.id === sku)?.displayPrice;
  const plusPrice = price(PLUS_SKU);
  const storeReady = Boolean(products && products.length > 0);

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreResult(await restorePurchases());
    setRestoring(false);
  };

  let purchaseBlock: ReactNode;
  if (products === null) {
    purchaseBlock = (
      <ActivityIndicator color={theme.tint} style={styles.loader} />
    );
  } else if (plus) {
    purchaseBlock = (
      <View
        style={[
          styles.owned,
          {
            backgroundColor: theme.successSurface,
            borderColor: theme.successBorder,
          },
        ]}
      >
        <Ionicons
          color={theme.successBorder}
          name="checkmark-circle"
          size={20}
        />
        <Text style={styles.ownedText}>{t("plusOwned")}</Text>
      </View>
    );
  } else {
    purchaseBlock = (
      <BuyPlusButton
        busy={busySku === PLUS_SKU}
        disabled={busySku !== null}
        label={
          plusPrice ? t("plusBuy", { price: plusPrice }) : t("plusUnavailable")
        }
        onPress={() =>
          // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
          void buy(PLUS_SKU)
        }
        price={plusPrice}
        theme={theme}
      />
    );
  }

  let restoreLabel = t("plusRestore");
  if (restoring) {
    restoreLabel = "…";
  } else if (restoreResult === false) {
    restoreLabel = t("plusRestoreNone");
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.hero,
            { backgroundColor: theme.accentSoft, borderColor: theme.tint },
          ]}
        >
          <Ionicons color={theme.tint} name="airplane" size={32} />
          <Text style={styles.title}>FlightMode Plus</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {t("plusSubtitle")}
          </Text>
        </View>

        {PERKS.map((perk) => (
          <View
            crazyColor="transparent"
            darkColor="transparent"
            key={perk.key}
            lightColor="transparent"
            style={styles.perk}
          >
            <Ionicons color={theme.tint} name={perk.icon} size={20} />
            <Text style={styles.perkText}>{t(perk.key)}</Text>
          </View>
        ))}

        {purchaseBlock}

        {pendingSku ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.hint, { color: theme.text }]}
          >
            {t("plusPendingPayment")}
          </Text>
        ) : null}
        {online || plus ? null : (
          <Text style={[styles.hint, { color: theme.mutedText }]}>
            {t("plusOfflineHint")}
          </Text>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t("plusTipTitle")}
        </Text>
        <Text style={[styles.hint, { color: theme.mutedText }]}>
          {tips > 0 ? t("plusTipThanks", { count: tips }) : t("plusTipHint")}
        </Text>
        <View
          crazyColor="transparent"
          darkColor="transparent"
          lightColor="transparent"
          style={styles.tips}
        >
          {TIP_SKUS.map((sku) => (
            <TipButton
              busy={busySku === sku}
              disabled={busySku !== null}
              key={sku}
              label={t(TIP_LABELS[sku])}
              onPress={() =>
                // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
                void buy(sku)
              }
              price={price(sku)}
              theme={theme}
            />
          ))}
        </View>

        {storeReady ? (
          <Pressable
            disabled={restoring}
            onPress={() =>
              // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
              void handleRestore()
            }
            style={styles.restore}
          >
            <Text style={[styles.restoreText, { color: theme.mutedText }]}>
              {restoreLabel}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  buy: {
    alignItems: "center",
    borderRadius: Radius.card,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
  buyText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  content: { padding: Spacing.lg, paddingBottom: Spacing["3xl"] },
  hero: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  hint: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
  loader: { marginVertical: Spacing.xl },
  owned: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
  ownedText: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  perk: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  perkText: { flex: 1, fontSize: FontSize.base },
  restore: { alignItems: "center", marginTop: Spacing.xl, padding: Spacing.sm },
  restoreText: { fontSize: FontSize.sm, textDecorationLine: "underline" },
  safe: { flex: 1 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: Spacing["2xl"],
  },
  subtitle: { fontSize: FontSize.sm, lineHeight: 19, textAlign: "center" },
  tip: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: Spacing.md,
  },
  tipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  tipPrice: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  tips: { flexDirection: "row", gap: Spacing.sm },
  title: { fontSize: FontSize["2xl"], fontWeight: FontWeight.bold },
});
