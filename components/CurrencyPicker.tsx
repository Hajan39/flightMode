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
import {
  currencies as bundledCurrencies,
  type Currency,
} from "@/data/currencies";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { getEffectiveCurrencies, useRatesStore } from "@/store/useRatesStore";

interface Props {
  /** Bundled codes stay as quick chips; everything else lives in the modal. */
  chipCodes?: string[];
  onSelect: (code: string) => void;
  selected: string;
}

/**
 * Currency chips + a searchable "All currencies" modal. Shared by the
 * converter and the onboarding / settings home-currency pickers.
 */
export default function CurrencyPicker({
  selected,
  onSelect,
  chipCodes,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const liveRates = useRatesStore((s) => s.rates);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const currencies = useMemo(
    () => getEffectiveCurrencies(liveRates),
    [liveRates]
  );
  const chipSet = useMemo(
    () => new Set(chipCodes ?? bundledCurrencies.map((c) => c.code)),
    [chipCodes]
  );
  const selectedExtra = currencies.find(
    (c) => c.code === selected && !chipSet.has(c.code)
  );
  const chips: Currency[] = [
    ...(selectedExtra ? [selectedExtra] : []),
    ...currencies.filter((c) => chipSet.has(c.code)),
  ];
  const hasExtra = currencies.length > chipSet.size;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return currencies;
    }
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q)
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
        contentContainerStyle={styles.chipRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {hasExtra ? (
          <Pressable
            accessibilityLabel={t("converterAllCurrencies")}
            accessibilityRole="button"
            onPress={() => {
              haptic.tap();
              setOpen(true);
            }}
            style={[
              styles.chip,
              styles.moreChip,
              { backgroundColor: theme.card, borderColor: theme.tint },
            ]}
          >
            <Ionicons color={theme.tint} name="search" size={14} />
            <Text style={[styles.chipText, { color: theme.tint }]}>
              {t("converterAllCurrencies")} · {currencies.length}
            </Text>
          </Pressable>
        ) : null}
        {chips.map((c) => {
          const isActive = c.code === selected;
          return (
            <Pressable
              accessibilityLabel={c.nameEn}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={c.code}
              onPress={() => {
                haptic.tap();
                onSelect(c.code);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.tint : theme.card,
                  borderColor: isActive ? theme.tint : theme.border,
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
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet"
        visible={open}
      >
        <SafeAreaView
          edges={["top", "bottom"]}
          style={[styles.modal, { backgroundColor: theme.background }]}
        >
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.header}
          >
            <TextInput
              accessibilityLabel={t("converterSearchCurrency")}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              placeholder={t("converterSearchCurrency")}
              placeholderTextColor={theme.mutedText}
              style={[
                styles.search,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={query}
            />
            <Pressable
              accessibilityLabel={t("gameCancel")}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                haptic.tap();
                setOpen(false);
                setQuery("");
              }}
            >
              <Ionicons color={theme.mutedText} name="close" size={24} />
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.list}
            data={items}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(c) => c.code}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: theme.mutedText }]}>
                {t("exploreNoResults")}
              </Text>
            }
            renderItem={({ item }) => {
              const isActive = item.code === selected;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => pick(item.code)}
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
                  <Text
                    numberOfLines={1}
                    style={[styles.rowName, { color: theme.text }]}
                  >
                    {item.nameEn}
                  </Text>
                  <Text style={[styles.rowSymbol, { color: theme.mutedText }]}>
                    {item.symbol}
                  </Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipRow: { gap: Spacing.sm, paddingVertical: 2 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  empty: { fontSize: FontSize.sm, marginTop: Spacing.xl, textAlign: "center" },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing["4xl"],
    paddingHorizontal: Spacing.lg,
  },
  modal: { flex: 1 },
  moreChip: { alignItems: "center", flexDirection: "row", gap: 4 },
  row: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowCode: { fontSize: FontSize.base, fontWeight: FontWeight.black, width: 48 },
  rowName: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  rowSymbol: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  search: {
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
});
