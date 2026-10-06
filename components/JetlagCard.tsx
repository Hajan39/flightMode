import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { Destination } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import type { Flight } from "@/types/flight";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { getJetlagPlan } from "@/utils/timezone";

interface Props {
  destination: Destination;
  flight: Flight;
  /** Wall-clock "now" — passed in so the Home 30 s tick re-renders us. */
  nowMs: number;
}

function formatDeviceTime(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Small jet-lag hint under the flight card: hours shifted, direction, and a
 * concrete on-plane sleep suggestion. Renders nothing for shifts under 2 h.
 */
export default function JetlagCard({ flight, destination, nowMs }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  const plan = getJetlagPlan({
    departureTime: flight.departureTime,
    destination,
    duration: flight.duration,
    nowMs,
  });

  useEffect(() => {
    if (plan.direction === "none") {
      return;
    }
    captureAnalyticsEvent("jetlag_card_shown", {
      direction: plan.direction,
      severity: plan.severity,
      shift_hours: plan.shiftHours,
    });
    // Fire once per flight, not on every 30 s tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.shiftHours, plan.severity, plan.direction]);

  if (plan.direction === "none") {
    return null;
  }

  const hours = Math.abs(plan.shiftHours);
  const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        Shadow.card,
      ]}
    >
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={[styles.icon, { backgroundColor: theme.accentSoft }]}
      >
        <Ionicons
          color={theme.tint}
          name={plan.direction === "east" ? "sunny-outline" : "moon-outline"}
          size={20}
        />
      </View>
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.body}
      >
        <Text style={styles.title}>
          {t("jetlagTitle")} ·{" "}
          {t(plan.direction === "east" ? "jetlagAhead" : "jetlagBehind", {
            hours: hoursLabel,
          })}
        </Text>
        <Text style={[styles.advice, { color: theme.mutedText }]}>
          {t(plan.adviceKey)}
        </Text>
        {plan.sleepWindow ? (
          <Text style={[styles.window, { color: theme.tint }]}>
            {t("jetlagSleepWindow", {
              end: formatDeviceTime(plan.sleepWindow.endMs),
              start: formatDeviceTime(plan.sleepWindow.startMs),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  advice: { fontSize: FontSize.sm, lineHeight: 18 },
  body: { flex: 1, gap: 4 },
  card: {
    alignItems: "flex-start",
    borderRadius: Radius.panel,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  icon: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  window: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
});
