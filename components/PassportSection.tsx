import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { getPassportSummary } from "@/utils/passport";

const STORE_URL =
  "https://play.google.com/store/apps/details?id=com.hajan39.flightmode";

/** Flight Passport: a stamp per departed flight + lifetime totals, shareable. */
export default function PassportSection() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t, language } = useTranslation();
  const log = useFlightStore((s) => s.log);
  const summary = useMemo(() => getPassportSummary(log, Date.now()), [log]);
  const hours = Math.round(summary.minutesInAir / 6) / 10;

  const handleShare = () => {
    captureAnalyticsEvent("passport_shared", {
      cities: summary.cities,
      flights: summary.flights,
    });
    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void Share.share({
      message: t("passportShareMessage", {
        cities: summary.cities,
        flights: summary.flights,
        hours,
        url: STORE_URL,
      }),
    });
  };

  return (
    <View
      crazyColor="transparent"
      darkColor="transparent"
      lightColor="transparent"
    >
      <Text style={[styles.title, { color: theme.text }]}>
        {t("passportTitle")}
      </Text>
      <Text style={[styles.hint, { color: theme.mutedText }]}>
        {summary.flights > 0 ? t("passportHint") : t("passportEmpty")}
      </Text>

      <View
        style={[
          styles.totals,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Total
          label={t("passportFlights")}
          theme={theme}
          value={summary.flights}
        />
        <Total
          label={t("passportHours")}
          theme={theme}
          value={hours.toLocaleString(language)}
        />
        <Total
          label={t("passportCities")}
          theme={theme}
          value={summary.cities}
        />
        <Total
          label={t("passportCountries")}
          theme={theme}
          value={summary.countries}
        />
      </View>

      {summary.stamps.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.stamps}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {summary.stamps.map((stamp) => (
            <View
              crazyColor="transparent"
              darkColor="transparent"
              key={stamp.id}
              lightColor="transparent"
              style={[styles.stamp, { borderColor: theme.tint }]}
            >
              <Text style={styles.stampEmoji}>{stamp.emoji}</Text>
              <Text
                numberOfLines={1}
                style={[styles.stampCity, { color: theme.text }]}
              >
                {stamp.city ?? t("passportUnknownCity")}
              </Text>
              <Text style={[styles.stampMeta, { color: theme.mutedText }]}>
                {new Date(stamp.departureTime).toLocaleDateString(language, {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })}
              </Text>
              <Text style={[styles.stampMeta, { color: theme.mutedText }]}>
                {Math.floor(stamp.duration / 60)} h {stamp.duration % 60} min
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {summary.flights > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleShare}
          style={[
            styles.share,
            { backgroundColor: theme.accentSoft, borderColor: theme.tint },
          ]}
        >
          <Ionicons color={theme.tint} name="share-social-outline" size={16} />
          <Text style={[styles.shareText, { color: theme.text }]}>
            {t("passportShare")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Total({
  value,
  label,
  theme,
}: {
  value: number | string;
  label: string;
  theme: (typeof Colors)["light"];
}) {
  return (
    <View
      crazyColor="transparent"
      darkColor="transparent"
      lightColor="transparent"
      style={styles.total}
    >
      <Text style={[styles.totalValue, { color: theme.text }]}>{value}</Text>
      <Text
        numberOfLines={1}
        style={[styles.totalLabel, { color: theme.mutedText }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
  share: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
  },
  shareText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  stamp: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderStyle: "dashed",
    borderWidth: 2,
    padding: Spacing.sm,
    transform: [{ rotate: "-3deg" }],
    width: 96,
  },
  stampCity: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: 4,
  },
  stampEmoji: { fontSize: 26 },
  stampMeta: { fontSize: FontSize.xs },
  // Padding so the rotated, dashed stamps are not clipped by the scroll view.
  stamps: { gap: Spacing.sm, padding: Spacing.sm, paddingVertical: Spacing.md },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4, marginTop: 20 },
  total: { alignItems: "center", flex: 1 },
  totalLabel: { fontSize: FontSize.xs, marginTop: 2 },
  totals: {
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: Spacing.md,
  },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
});
