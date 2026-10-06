import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { destinations, getDestinationById } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  cancelJetlagSleepReminder,
  scheduleFlightReadyReminder,
  scheduleJetlagSleepReminder,
} from "@/utils/notifications";
import { getJetlagPlan, getJetlagReminderFireAt } from "@/utils/timezone";

const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT_RE = /^(\d{2}):(\d{2})$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toTimeInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalDateTime(dateInput: string, timeInput: string) {
  const dateMatch = DATE_INPUT_RE.exec(dateInput.trim());
  const timeMatch = TIME_INPUT_RE.exec(timeInput.trim());
  if (!(dateMatch && timeMatch)) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null;
  }

  return parsed.getTime();
}

function offsetDate(baseDate: string, delta: number): string {
  const match = DATE_INPUT_RE.exec(baseDate);
  if (!match) {
    return baseDate;
  }
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setDate(d.getDate() + delta);
  return toDateInputValue(d.getTime());
}

function dayOffsetFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const match = DATE_INPUT_RE.exec(dateStr);
  if (!match) {
    return -1;
  }
  const target = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function localTzLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

interface StepperProps {
  bgColor: string;
  borderColor: string;
  onDecrement: () => void;
  onIncrement: () => void;
  textColor: string;
  tint: string;
  value: string;
}

function Stepper({
  value,
  onDecrement,
  onIncrement,
  tint,
  textColor,
  bgColor,
  borderColor,
}: StepperProps) {
  return (
    <View style={[styles.stepper, { backgroundColor: bgColor, borderColor }]}>
      <Pressable hitSlop={8} onPress={onDecrement} style={styles.stepBtn}>
        <Text style={[styles.stepBtnText, { color: tint }]}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, { color: textColor }]}>{value}</Text>
      <Pressable hitSlop={8} onPress={onIncrement} style={styles.stepBtn}>
        <Text style={[styles.stepBtnText, { color: tint }]}>+</Text>
      </Pressable>
    </View>
  );
}

export default function FlightEditScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const setFlight = useFlightStore((s) => s.setFlight);
  const existingFlight = useFlightStore((s) => s.flight);
  const incrementFlights = useAchievementStore((s) => s.incrementFlights);
  const isEditingFlight = Boolean(existingFlight);
  const insets = useSafeAreaInsets();
  const initialDepartureTime = existingFlight?.departureTime ?? Date.now();

  const [hours, setHours] = useState(
    existingFlight ? String(Math.floor(existingFlight.duration / 60)) : "2"
  );
  const [minutes, setMinutes] = useState(
    existingFlight ? String(existingFlight.duration % 60) : "00"
  );
  const [departureDate, setDepartureDate] = useState(
    toDateInputValue(initialDepartureTime)
  );
  const [departureClock, setDepartureClock] = useState(
    toTimeInputValue(initialDepartureTime)
  );
  const [flightNumber, setFlightNumber] = useState(
    existingFlight?.flightNumber ?? ""
  );
  const [destinationId, setDestinationId] = useState<string | undefined>(
    existingFlight?.destinationId
  );

  // Parse current clock for steppers
  const clockMatch = TIME_INPUT_RE.exec(departureClock);
  const clockHour = clockMatch ? Number(clockMatch[1]) : 0;
  const clockMinute = clockMatch ? Number(clockMatch[2]) : 0;

  function adjustHour(delta: number) {
    const next = (clockHour + delta + 24) % 24;
    setDepartureClock(`${pad2(next)}:${pad2(clockMinute)}`);
  }

  function adjustMinute(delta: number) {
    const next = (clockMinute + delta + 60) % 60;
    setDepartureClock(`${pad2(clockHour)}:${pad2(next)}`);
  }

  // Duration steppers
  const durationHours = Number.parseInt(hours, 10) || 0;
  const durationMins = Number.parseInt(minutes, 10) || 0;

  function adjustDurationHour(delta: number) {
    const next = Math.max(0, Math.min(24, durationHours + delta));
    setHours(String(next));
  }

  function adjustDurationMinute(delta: number) {
    let next = durationMins + delta;
    let h = durationHours;
    if (next < 0) {
      next = 55;
      h = Math.max(0, h - 1); // borrow an hour
    } else if (next >= 60) {
      next = 0;
      h = Math.min(24, h + 1); // carry an hour
    }
    setHours(String(h));
    setMinutes(pad2(next));
  }

  const dayOffset = dayOffsetFromToday(departureDate);
  const dateChips = [
    { labelKey: "flightDateToday" as const, offset: 0 },
    { labelKey: "flightDateTomorrow" as const, offset: 1 },
    { labelKey: "flightDateIn2Days" as const, offset: 2 },
  ];

  const handleSave = async () => {
    const h = Number.parseInt(hours, 10) || 0;
    const m = Number.parseInt(minutes, 10) || 0;
    const totalMinutes = h * 60 + m;
    const departureTime = parseLocalDateTime(departureDate, departureClock);

    if (totalMinutes <= 0) {
      Alert.alert(t("invalidDurationTitle"), t("invalidDurationMessage"));
      return;
    }

    if (!departureTime) {
      Alert.alert(t("invalidDepartureTitle"), t("invalidDepartureMessage"));
      return;
    }

    const flightId = existingFlight?.id ?? Date.now().toString();
    setFlight({
      departureTime,
      destinationId,
      duration: totalMinutes,
      flightNumber: flightNumber.trim() || undefined,
      id: flightId,
    });
    if (!existingFlight) {
      incrementFlights();
      // A new flight starts with a fresh checklist (custom items survive).
      useChecklistStore.getState().resetForFlight(flightId, "new_flight");
    }
    const destination = destinationId
      ? getDestinationById(destinationId)
      : undefined;
    if (destination) {
      const plan = getJetlagPlan({
        departureTime,
        destination,
        duration: totalMinutes,
        nowMs: departureTime,
      });
      useAchievementStore.getState().recordTimezoneShift(plan.shiftHours);

      // Nudge the traveller when the suggested on-plane sleep window opens.
      const sleepFireAt = getJetlagReminderFireAt(plan, Date.now());
      if (sleepFireAt) {
        const sleepResult = await scheduleJetlagSleepReminder(
          sleepFireAt,
          destination.city
        );
        if (sleepResult.scheduled) {
          captureAnalyticsEvent("reminder_scheduled", {
            departure_time: departureTime,
            reminder_kind: "jetlag_sleep",
            scheduled_for: sleepResult.scheduledFor,
          });
        }
      } else {
        // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
        void cancelJetlagSleepReminder();
      }
    } else {
      // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
      void cancelJetlagSleepReminder();
    }
    captureAnalyticsEvent(isEditingFlight ? "flight_edited" : "flight_added", {
      departure_time: departureTime,
      duration_minutes: totalMinutes,
    });
    captureAnalyticsEvent("flight_setup_completed", {
      departure_time: departureTime,
      duration_minutes: totalMinutes,
      is_departure_in_future: departureTime > Date.now(),
      mode: isEditingFlight ? "edit" : "create",
    });

    const reminderResult = await scheduleFlightReadyReminder(departureTime);
    if (reminderResult.scheduled) {
      captureAnalyticsEvent("reminder_scheduled", {
        departure_time: departureTime,
        reminder_kind: "flight_ready",
        scheduled_for: reminderResult.scheduledFor,
      });
    } else {
      captureAnalyticsEvent("reminder_permission_denied", {
        departure_time: departureTime,
        reminder_kind: "flight_ready",
      });
    }

    router.back();
  };

  const tz = localTzLabel();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 24}
      // Edge-to-edge: keep the CTA above the system navigation bar.
      style={[styles.keyboardContainer, { paddingBottom: insets.bottom }]}
    >
      <Stack.Screen
        options={{
          title: isEditingFlight ? t("stackEditFlight") : t("addYourFlight"),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Ionicons
            color={theme.tint}
            name="airplane"
            size={48}
            style={styles.icon}
          />
          <Text style={styles.title}>{t("setYourFlight")}</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {t("enterFlightDuration")}
          </Text>

          {/* Flight Number (optional) */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
              {t("flightNumberLabel")}
            </Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              onChangeText={setFlightNumber}
              placeholder={t("flightNumberPlaceholder")}
              placeholderTextColor={theme.mutedText}
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={flightNumber}
            />
          </View>

          {/* Destination (optional) — links flight to bundled tips */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
              {t("flightDestinationLabel")}
            </Text>
            <ScrollView
              contentContainerStyle={styles.destRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <Pressable
                onPress={() => setDestinationId(undefined)}
                style={[
                  styles.destChip,
                  {
                    backgroundColor: destinationId ? theme.card : theme.tint,
                    borderColor: destinationId ? theme.border : theme.tint,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: destinationId ? theme.text : theme.onTint },
                  ]}
                >
                  {t("flightDestinationNone")}
                </Text>
              </Pressable>
              {destinations.map((d) => {
                const active = destinationId === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDestinationId(active ? undefined : d.id)}
                    style={[
                      styles.destChip,
                      {
                        backgroundColor: active ? theme.tint : theme.card,
                        borderColor: active ? theme.tint : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.onTint : theme.text },
                      ]}
                    >
                      {d.emoji} {d.city}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Departure Date — quick chips + day stepper */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
              {t("flightDepartureDate")}
            </Text>
            <View style={styles.chipRow}>
              {dateChips.map((chip) => {
                const active = dayOffset === chip.offset;
                return (
                  <Pressable
                    key={chip.offset}
                    onPress={() =>
                      setDepartureDate(
                        offsetDate(toDateInputValue(Date.now()), chip.offset)
                      )
                    }
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.tint : theme.card,
                        borderColor: active ? theme.tint : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.onTint : theme.text },
                      ]}
                    >
                      {t(chip.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.dayStepperRow}>
              {(() => {
                const canGoBack = dayOffsetFromToday(departureDate) > 0;
                const canGoForward = dayOffsetFromToday(departureDate) < 14;
                return (
                  <>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        canGoBack &&
                        setDepartureDate(offsetDate(departureDate, -1))
                      }
                      style={[
                        styles.dayStepBtn,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          opacity: canGoBack ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Ionicons
                        color={theme.tint}
                        name="chevron-back-outline"
                        size={20}
                      />
                    </Pressable>
                    <Text style={[styles.dayLabel, { color: theme.text }]}>
                      {departureDate}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        canGoForward &&
                        setDepartureDate(offsetDate(departureDate, +1))
                      }
                      style={[
                        styles.dayStepBtn,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          opacity: canGoForward ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Ionicons
                        color={theme.tint}
                        name="chevron-forward-outline"
                        size={20}
                      />
                    </Pressable>
                  </>
                );
              })()}
            </View>
          </View>

          {/* Departure Time stepper */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
                {t("flightDepartureTime")}
              </Text>
              {tz ? (
                <Text style={[styles.tzLabel, { color: theme.mutedText }]}>
                  {tz}
                </Text>
              ) : null}
            </View>
            <View style={styles.timeRow}>
              <Stepper
                bgColor={theme.card}
                borderColor={theme.border}
                onDecrement={() => adjustHour(-1)}
                onIncrement={() => adjustHour(+1)}
                textColor={theme.text}
                tint={theme.tint}
                value={pad2(clockHour)}
              />
              <Text style={[styles.colon, { color: theme.text }]}>:</Text>
              <Stepper
                bgColor={theme.card}
                borderColor={theme.border}
                onDecrement={() => adjustMinute(-5)}
                onIncrement={() => adjustMinute(+5)}
                textColor={theme.text}
                tint={theme.tint}
                value={pad2(clockMinute)}
              />
            </View>
          </View>

          {/* Flight Duration steppers */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
              {t("flightDuration")}
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.durationGroup}>
                <Stepper
                  bgColor={theme.card}
                  borderColor={theme.border}
                  onDecrement={() => adjustDurationHour(-1)}
                  onIncrement={() => adjustDurationHour(+1)}
                  textColor={theme.text}
                  tint={theme.tint}
                  value={String(durationHours)}
                />
                <Text style={[styles.durationUnit, { color: theme.mutedText }]}>
                  {t("hours")}
                </Text>
              </View>
              <Text style={[styles.colon, { color: theme.text }]}>:</Text>
              <View style={styles.durationGroup}>
                <Stepper
                  bgColor={theme.card}
                  borderColor={theme.border}
                  onDecrement={() => adjustDurationMinute(-5)}
                  onIncrement={() => adjustDurationMinute(+5)}
                  textColor={theme.text}
                  tint={theme.tint}
                  value={pad2(durationMins)}
                />
                <Text style={[styles.durationUnit, { color: theme.mutedText }]}>
                  {t("minutes")}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            style={[styles.button, { backgroundColor: theme.tint }]}
          >
            <Ionicons
              color={theme.onTint}
              name="checkmark-circle-outline"
              size={22}
            />
            <Text style={[styles.buttonText, { color: theme.onTint }]}>
              {t("startFlight")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // CTA button
  button: {
    alignItems: "center",
    borderRadius: 30,
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  chip: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  // Date chips
  chipRow: { flexDirection: "row", gap: 8 },
  chipText: { fontSize: 13, fontWeight: "700" },
  colon: { fontSize: 28, fontWeight: "700", marginHorizontal: 4 },
  container: {
    alignItems: "center",
    flex: 1,
    gap: 20,
    justifyContent: "center",
    minHeight: "100%",
    padding: 24,
  },
  dayArrow: { fontSize: 22, fontWeight: "700", lineHeight: 26 },
  dayLabel: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 110,
    textAlign: "center",
  },
  dayStepBtn: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  // Day stepper
  dayStepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  destChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  destRow: { gap: 8, paddingRight: 8 },
  // Duration
  durationGroup: { alignItems: "center", gap: 4 },
  durationUnit: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  // Field groups
  fieldGroup: { gap: 8, width: "100%" },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  icon: { marginBottom: 0 },
  keyboardContainer: { flex: 1 },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scrollContent: { flexGrow: 1 },
  stepBtn: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 40,
  },
  stepBtnText: { fontSize: 24, fontWeight: "700" },
  // Stepper component
  stepper: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  stepValue: {
    fontSize: 22,
    fontWeight: "800",
    minWidth: 44,
    textAlign: "center",
  },
  subtitle: { fontSize: 14, marginTop: -8 },
  // Flight number input
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "600",
    height: 44,
    paddingHorizontal: 12,
    width: "100%",
  },
  // Time / duration stepper row
  timeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "700", marginTop: -4 },
  tzLabel: { fontSize: 11 },
});
