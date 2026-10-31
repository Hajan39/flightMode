import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { FlightLookupStatus } from "@/hooks/useFlightLookup";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  FlightLookupAvailability,
  FlightLookupError,
} from "@/utils/flightLookup";

type Translate = ReturnType<typeof useTranslation>["t"];

/** Policy/network hints are guidance, not errors: shown in muted text. */
const NETWORK_HINTS: ReadonlySet<FlightLookupError> = new Set([
  "offline",
  "sync_off",
  "wifi_only",
]);

function lookupErrorText(error: FlightLookupError, t: Translate): string {
  switch (error) {
    case "not_found":
      return t("flightLookupNotFound");
    case "offline":
      return t("flightLookupOffline");
    case "sync_off":
      return t("flightLookupSyncOff");
    case "wifi_only":
      return t("flightLookupWifiOnly");
    case "rate_limited":
      return t("flightLookupRateLimited");
    case "invalid":
      return t("flightLookupInvalid");
    default:
      return t("flightLookupError");
  }
}

function statusText(
  status: FlightLookupStatus,
  availability: FlightLookupAvailability,
  t: Translate
): string {
  switch (status.kind) {
    case "loading":
      return t("flightLookupLoading");
    case "filled":
      return t("flightLookupFilled", { from: status.from, to: status.to });
    case "failed":
      return lookupErrorText(status.error, t);
    default:
      // Idle: warn up front when the sync policy / network blocks it.
      return availability === "ok" || availability === "disabled"
        ? t("flightLookupHint")
        : lookupErrorText(availability, t);
  }
}

interface ButtonProps {
  disabled: boolean;
  onPress: () => void;
  status: FlightLookupStatus;
}

/** "Fill in" next to the flight number (44 dp target, busy state). */
export function FlightLookupButton({ disabled, onPress, status }: ButtonProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const loading = status.kind === "loading";
  let icon: React.ReactNode = (
    <Ionicons color={theme.tint} name="search-outline" size={18} />
  );
  if (loading) {
    icon = <ActivityIndicator color={theme.tint} size="small" />;
  } else if (status.kind === "filled") {
    icon = <Ionicons color={theme.tint} name="checkmark-circle" size={18} />;
  }
  return (
    <Pressable
      accessibilityHint={t("flightLookupHint")}
      accessibilityLabel={t("flightLookupA11y")}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: theme.card,
          borderColor: theme.tint,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, { color: theme.tint }]}>
        {t("flightLookupFill")}
      </Text>
    </Pressable>
  );
}

interface StatusProps {
  availability: FlightLookupAvailability;
  status: FlightLookupStatus;
}

/** One status line under the flight number (announced to screen readers). */
export function FlightLookupStatusLine({ availability, status }: StatusProps) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const isError = status.kind === "failed" && !NETWORK_HINTS.has(status.error);
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.status,
        { color: isError ? theme.danger : theme.mutedText },
      ]}
    >
      {statusText(status, availability, t)}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  buttonText: { fontSize: 14, fontWeight: "700" },
  status: { fontSize: 12 },
});
