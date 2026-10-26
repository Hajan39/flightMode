import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { getDeviceLanguage, translate } from "@/i18n/translations";
import { useSettingsStore } from "@/store/useSettingsStore";

const FLIGHT_REMINDER_CHANNEL_ID = "flight-reminders";
const FLIGHT_REMINDER_KIND = "flight_ready";
const JETLAG_SLEEP_KIND = "jetlag_sleep";

// expo-notifications was removed from Expo Go on Android in SDK 53 —
// even importing the module logs a runtime error there. Notifications are
// optional, so we skip the whole subsystem in Expo Go and only load the
// module lazily in development/production builds.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const notificationsSupported = !isExpoGo;

type NotificationsModule = typeof import("expo-notifications");

let cachedModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (cachedModule === undefined) {
    cachedModule = notificationsSupported
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require("expo-notifications") as NotificationsModule)
      : null;
  }
  return cachedModule;
}

let handlerConfigured = false;

/** Stored language > device language — same order as `useTranslation`. */
function currentLanguage() {
  return useSettingsStore.getState().language ?? getDeviceLanguage();
}

function ensureNotificationHandler(Notifications: NotificationsModule) {
  if (handlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  handlerConfigured = true;
}

export async function initializeNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) {
    return;
  }

  ensureNotificationHandler(Notifications);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      FLIGHT_REMINDER_CHANNEL_ID,
      {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: translate(currentLanguage(), "notifChannelFlightReminders"),
      }
    );
  }
}

export function addNotificationResponseListener(
  onReminderOpened: (reminderKind: string) => void
): (() => void) | null {
  const Notifications = getNotifications();
  if (!Notifications) {
    return null;
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const { data } = response.notification.request.content;
      const reminderKind =
        data && typeof data === "object"
          ? (data as Record<string, unknown>).reminder_kind
          : undefined;

      if (typeof reminderKind !== "string") {
        return;
      }

      onReminderOpened(reminderKind);
    }
  );

  return () => subscription.remove();
}

export async function requestNotificationPermission() {
  const Notifications = getNotifications();
  if (!Notifications) {
    return false;
  }

  const isGranted = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return false;
    }

    if ("granted" in value) {
      return Boolean((value as { granted?: unknown }).granted);
    }

    if ("status" in value) {
      return (value as { status?: unknown }).status === "granted";
    }

    return false;
  };

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) {
    return true;
  }

  const next = await Notifications.requestPermissionsAsync();
  return isGranted(next);
}

/** Cancels every pending reminder tagged with `reminder_kind === kind`. */
async function cancelRemindersOfKind(
  Notifications: NotificationsModule,
  kind: string
) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (item) =>
          item.content.data &&
          typeof item.content.data === "object" &&
          (item.content.data as Record<string, unknown>).reminder_kind === kind
      )
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier)
      )
  );
}

/**
 * Nudges the traveller 10 minutes before the suggested on-plane sleep window
 * (see `getJetlagReminderFireAt`). Safe to call repeatedly — it replaces any
 * previously scheduled jet-lag reminder.
 */
export async function scheduleJetlagSleepReminder(
  fireAt: number,
  city: string
) {
  const Notifications = getNotifications();
  if (!Notifications) {
    return { reason: "unsupported" as const, scheduled: false as const };
  }

  await initializeNotifications();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return { reason: "permission_denied" as const, scheduled: false as const };
  }

  await cancelRemindersOfKind(Notifications, JETLAG_SLEEP_KIND);

  if (fireAt <= Date.now() + 2 * 60 * 1000) {
    return { reason: "too_late" as const, scheduled: false as const };
  }

  const fireDate = new Date(fireAt);
  const language = currentLanguage();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      body: translate(language, "notifJetlagSleepBody", { city }),
      data: { reminder_kind: JETLAG_SLEEP_KIND },
      title: translate(language, "notifJetlagSleepTitle"),
    },
    trigger: {
      channelId:
        Platform.OS === "android" ? FLIGHT_REMINDER_CHANNEL_ID : undefined,
      date: fireDate,
      type: Notifications.SchedulableTriggerInputTypes.DATE,
    },
  });

  return {
    identifier,
    scheduled: true as const,
    scheduledFor: fireDate.getTime(),
  };
}

/** Drops the jet-lag reminder — used when the flight is cleared. */
export async function cancelJetlagSleepReminder() {
  const Notifications = getNotifications();
  if (!Notifications) {
    return;
  }
  await cancelRemindersOfKind(Notifications, JETLAG_SLEEP_KIND);
}

/** Drops the "flight entertainment is ready" reminder — used when the flight is cleared. */
export async function cancelFlightReadyReminder() {
  const Notifications = getNotifications();
  if (!Notifications) {
    return;
  }
  await cancelRemindersOfKind(Notifications, FLIGHT_REMINDER_KIND);
}

const MINUTE_MS = 60 * 1000;

/**
 * When to send the pre-flight "entertainment ready" reminder: 3 h before
 * departure, else 30 min before; null (don't schedule) when departure is in
 * the past or less than 30 min away — a reminder mid-flight or at the gate is
 * useless. Needs at least 2 min of lead time. Pure, exported for tests.
 */
export function getFlightReadyReminderFireAt(
  departureTime: number,
  now: number
): number | null {
  if (!Number.isFinite(departureTime) || departureTime - now < 30 * MINUTE_MS) {
    return null;
  }
  const minLead = now + 2 * MINUTE_MS;
  const threeHoursBefore = departureTime - 180 * MINUTE_MS;
  if (threeHoursBefore > minLead) {
    return threeHoursBefore;
  }
  const thirtyMinutesBefore = departureTime - 30 * MINUTE_MS;
  if (thirtyMinutesBefore > minLead) {
    return thirtyMinutesBefore;
  }
  return null;
}

export async function scheduleFlightReadyReminder(departureTime: number) {
  const Notifications = getNotifications();
  if (!Notifications) {
    return { reason: "unsupported" as const, scheduled: false as const };
  }

  const fireAt = getFlightReadyReminderFireAt(departureTime, Date.now());
  if (fireAt === null) {
    // Past / imminent departure: drop any stale reminder, don't prompt for
    // permission and don't schedule one mid-flight.
    await cancelRemindersOfKind(Notifications, FLIGHT_REMINDER_KIND);
    return { reason: "too_late" as const, scheduled: false as const };
  }

  await initializeNotifications();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return { reason: "permission_denied" as const, scheduled: false as const };
  }

  await cancelRemindersOfKind(Notifications, FLIGHT_REMINDER_KIND);

  const fireDate = new Date(fireAt);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      body: translate(currentLanguage(), "notifFlightReadyBody"),
      data: {
        departure_time: departureTime,
        reminder_kind: FLIGHT_REMINDER_KIND,
        reminder_offset_minutes: Math.round((departureTime - fireAt) / 60_000),
      },
      title: translate(currentLanguage(), "notifFlightReadyTitle"),
    },
    trigger: {
      channelId:
        Platform.OS === "android" ? FLIGHT_REMINDER_CHANNEL_ID : undefined,
      date: fireDate,
      type: Notifications.SchedulableTriggerInputTypes.DATE,
    },
  });

  return {
    identifier,
    scheduled: true as const,
    scheduledFor: fireDate.getTime(),
  };
}
