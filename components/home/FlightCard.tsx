import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import JetlagCard from "@/components/JetlagCard";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import type { Destination } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import { getFlightProgress, getRemainingMinutes } from "@/store/useFlightStore";
import type { Flight } from "@/types/flight";
import { formatTimeInZone, getDayOffset } from "@/utils/timezone";

interface Props {
  destination: Destination | undefined;
  flight: Flight | null;
  /** After arrival: show "Landed" instead of a progress readout. */
  landed?: boolean;
  /** Wall-clock "now" from Home's 30 s tick, so clocks refresh. */
  nowMs: number;
  onAddFlight: () => void;
  onClear: () => void;
}

/** Active-flight card (progress, clocks, jet lag) or the "add your flight" prompt. */
export default function FlightCard({
  flight,
  destination,
  nowMs,
  onClear,
  onAddFlight,
  landed,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  if (!flight) {
    return (
      <AnimatedPressable
        onPress={onAddFlight}
        style={[
          styles.addFlightCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons color={theme.tint} name="airplane-outline" size={30} />
        <Text style={styles.addFlightTitle}>{t("addYourFlight")}</Text>
        <Text style={[styles.addFlightSubtitle, { color: theme.mutedText }]}>
          {t("trackFlightRecommendation")}
        </Text>
      </AnimatedPressable>
    );
  }

  const progress = getFlightProgress(flight);
  const remaining = getRemainingMinutes(flight);
  const remainingRounded = Math.round(remaining);
  const remainingH = Math.floor(remainingRounded / 60);
  const remainingM = remainingRounded % 60;
  const arrivalMs = flight.departureTime + flight.duration * 60_000;
  const arrivalDate = new Date(arrivalMs);
  const arrivalTime = `${String(arrivalDate.getHours()).padStart(2, "0")}:${String(
    arrivalDate.getMinutes()
  ).padStart(2, "0")}`;
  const destinationNow = destination
    ? formatTimeInZone(nowMs, destination)
    : null;
  const arrivalLocal = destination
    ? (() => {
        const time = formatTimeInZone(arrivalMs, destination);
        const dayOffset = getDayOffset(arrivalMs, destination, nowMs);
        return dayOffset > 0 ? `${time} ${t("nextDaySuffix")}` : time;
      })()
    : null;

  return (
    <View
      style={[styles.flightShell, { backgroundColor: `${theme.border}30` }]}
    >
      <View
        style={[
          styles.flightCard,
          { backgroundColor: theme.accentSoft },
          Shadow.card,
        ]}
      >
        <View style={styles.flightHeader}>
          <Ionicons color={theme.tint} name="airplane" size={20} />
          <Text style={styles.flightTitle}>
            {flight.flightNumber ?? t("yourFlight")}
          </Text>
          <Pressable
            accessibilityLabel={t("a11yClearFlight")}
            hitSlop={10}
            onPress={onClear}
          >
            <Ionicons
              color={theme.mutedText}
              name="close-circle-outline"
              size={20}
            />
          </Pressable>
        </View>

        <View
          style={[styles.progressBar, { backgroundColor: theme.progressTrack }]}
        >
          <AnimatedProgressFill color={theme.tint} progress={progress} />
        </View>
        <Text style={[styles.progressLabel, { color: theme.mutedText }]}>
          {landed
            ? t("flightLanded")
            : `${Math.round(progress * 100)}% — ${t("remainingTime", {
                hours: remainingH,
                minutes: remainingM,
              })}`}
        </Text>
        {!arrivalLocal && (
          <Text style={[styles.progressLabel, { color: theme.mutedText }]}>
            {t("arrivalTime", { time: arrivalTime })}
          </Text>
        )}
        {destination && destinationNow && arrivalLocal && (
          <>
            <Text style={[styles.progressLabel, { color: theme.mutedText }]}>
              {t("destinationLocalTime", {
                city: destination.city,
                time: destinationNow,
              })}
            </Text>
            <Text style={[styles.progressLabel, { color: theme.mutedText }]}>
              {t("arrivalTimeLocal", { time: arrivalLocal })}
            </Text>
          </>
        )}

        {landed ? null : (
          <View style={styles.recommendation}>
            <Ionicons color={theme.warning} name="bulb-outline" size={16} />
            <Text
              style={[styles.recommendationText, { color: theme.mutedText }]}
            >
              {remaining > 120
                ? t("recommendationLong")
                : remaining > 30
                  ? t("recommendationMid")
                  : t("recommendationShort")}
            </Text>
          </View>
        )}
      </View>
      {destination ? (
        <JetlagCard destination={destination} flight={flight} nowMs={nowMs} />
      ) : null}
    </View>
  );
}

function AnimatedProgressFill({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.round(progress * 100), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, width]);

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: color,
    borderRadius: 4,
    height: "100%",
    width: `${width.value}%`,
  }));

  return <Animated.View style={fillStyle} />;
}

const styles = StyleSheet.create({
  addFlightCard: {
    alignItems: "center",
    borderRadius: Radius.xl,
    borderStyle: "dashed",
    borderWidth: 2,
    marginBottom: 6,
    padding: Spacing["2xl"],
  },
  addFlightSubtitle: { fontSize: 13, marginTop: 4, textAlign: "center" },
  addFlightTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  flightCard: { borderRadius: Radius.xl, padding: Spacing.xl },
  flightHeader: {
    alignItems: "center",
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  // Double-bezel: outer shell + inner core
  flightShell: {
    borderRadius: Radius.xl + 4,
    marginBottom: Spacing["2xl"],
    padding: 4,
  },
  flightTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  progressBar: {
    borderRadius: 4,
    height: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressLabel: { fontSize: 13 },
  recommendation: {
    alignItems: "center",
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  recommendationText: { flex: 1, fontSize: 13 },
});
