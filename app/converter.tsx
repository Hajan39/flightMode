import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CurrencyPicker from "@/components/CurrencyPicker";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { deviceCurrencyCode, getCurrency } from "@/data/currencies";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  getEffectiveCurrencies,
  getRatesProvenance,
  useRatesStore,
} from "@/store/useRatesStore";
import { useSettingsStore } from "@/store/useSettingsStore";
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
  { icon: "cash-outline", id: "currency" },
  { icon: "thermometer-outline", id: "temperature" },
  { icon: "navigate-outline", id: "distance" },
  { icon: "barbell-outline", id: "weight" },
];

const KIND_LABEL_KEYS = {
  currency: "converterCurrency",
  distance: "converterDistance",
  temperature: "converterTemperature",
  weight: "converterWeight",
} as const;

export default function ConverterScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const params = useLocalSearchParams<{
    currency?: string;
    source?: string;
  }>();
  // Route params are optional at runtime; keep the nullable types explicit.
  const currency: string | undefined = params.currency;
  const source: string | undefined = params.source;
  const incrementConverterUses = useAchievementStore(
    (s) => s.incrementConverterUses
  );
  const liveRates = useRatesStore((s) => s.rates);
  const liveAsOf = useRatesStore((s) => s.ratesAsOf);
  const ratesStatus = useRatesStore((s) => s.status);
  const syncRates = useRatesStore((s) => s.syncRates);
  const online = useNetworkStore((s) => s.isInternetReachable) === true;
  const currencies = useMemo(
    () => getEffectiveCurrencies(liveRates),
    [liveRates]
  );
  const provenance = getRatesProvenance({
    rates: liveRates,
    ratesAsOf: liveAsOf,
  });

  const homeCurrency = useSettingsStore((s) => s.homeCurrency);
  const home = homeCurrency ?? deviceCurrencyCode();
  const [kind, setKind] = useState<Kind>("currency");
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState(home);
  const [to, setTo] = useState(() => {
    const param = getCurrency(currency)?.code ?? currency?.toUpperCase();
    if (param && param !== home) {
      return param;
    }
    return home === "EUR" ? "USD" : "EUR";
  });
  const [direction, setDirection] = useState<UnitDirection>("metricToImperial");
  const countedRef = useRef(false);

  useEffect(() => {
    captureAnalyticsEvent("converter_open", {
      kind: "currency",
      source: source ?? "direct",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const value = parseAmount(amount);

  const result = useMemo(() => {
    if (value === null) {
      return null;
    }
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
    if (result === null) {
      return;
    }
    const timer = setTimeout(() => {
      captureAnalyticsEvent("converter_used", {
        from:
          kind === "currency"
            ? from
            : unitLabels[kind][direction === "metricToImperial" ? 0 : 1],
        kind,
        to:
          kind === "currency"
            ? to
            : unitLabels[kind][direction === "metricToImperial" ? 1 : 0],
      });
      // biome-ignore lint/suspicious/noUnnecessaryConditions: the ref flips to true below; this is a one-time-per-mount guard
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
        d === "metricToImperial" ? "imperialToMetric" : "metricToImperial"
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
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
      >
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.segment}
        >
          {KINDS.map((item) => {
            const isActive = item.id === kind;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={item.id}
                onPress={() => {
                  haptic.tap();
                  setKind(item.id);
                }}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: isActive ? theme.tint : theme.card,
                    borderColor: isActive ? theme.tint : theme.border,
                  },
                ]}
              >
                <Ionicons
                  color={isActive ? theme.onTint : theme.mutedText}
                  name={item.icon}
                  size={18}
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
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.mutedText }]}>
            {t("converterAmount")} · {fromLabel}
          </Text>
          <TextInput
            accessibilityLabel={t("converterAmount")}
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            returnKeyType="done"
            selectTextOnFocus
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={amount}
          />
          {kind === "currency" ? (
            <>
              <Text style={[styles.label, { color: theme.mutedText }]}>
                {t("converterFrom")}
              </Text>
              <CurrencyPicker onSelect={setFrom} selected={from} />
            </>
          ) : null}

          <Pressable
            accessibilityLabel={t("converterSwap")}
            accessibilityRole="button"
            onPress={swap}
            style={[
              styles.swapBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.tint} name="swap-vertical" size={20} />
            <Text style={[styles.swapText, { color: theme.tint }]}>
              {t("converterSwap")}
            </Text>
          </Pressable>

          {kind === "currency" ? (
            <>
              <Text style={[styles.label, { color: theme.mutedText }]}>
                {t("converterTo")}
              </Text>
              <CurrencyPicker onSelect={setTo} selected={to} />
            </>
          ) : null}

          <Text style={[styles.label, { color: theme.mutedText }]}>
            {t("converterResult")} · {toLabel}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.result, { color: theme.tint }]}
          >
            {result ?? "–"}
          </Text>
        </View>

        {kind === "currency" ? (
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.footer}
          >
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
                accessibilityRole="button"
                disabled={ratesStatus === "syncing"}
                onPress={() => {
                  haptic.tap();
                  // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
                  void syncRates({ force: true });
                }}
                style={[
                  styles.refreshBtn,
                  {
                    borderColor: theme.border,
                    opacity: ratesStatus === "syncing" ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons
                  color={theme.tint}
                  name="cloud-download-outline"
                  size={16}
                />
                <Text style={[styles.refreshText, { color: theme.tint }]}>
                  {ratesStatus === "syncing"
                    ? t("converterRatesUpdating")
                    : t("converterRatesRefresh")}
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
  card: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  container: {
    gap: Spacing.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  footer: { gap: 2, paddingHorizontal: Spacing.xs },
  footerText: { fontSize: FontSize.xs, lineHeight: 16 },
  input: {
    borderRadius: Radius.card,
    borderWidth: 1,
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
    marginTop: Spacing.xs,
    textTransform: "uppercase",
  },
  refreshBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  refreshText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  result: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
  },
  screen: { flex: 1 },
  segment: { flexDirection: "row", gap: Spacing.sm },
  segmentBtn: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: Spacing.sm + 2,
  },
  segmentText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  swapBtn: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  swapText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
