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
	if (handlerConfigured) return;

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
	if (!Notifications) return;

	ensureNotificationHandler(Notifications);

	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(
			FLIGHT_REMINDER_CHANNEL_ID,
			{
				name: translate(currentLanguage(), "notifChannelFlightReminders"),
				importance: Notifications.AndroidImportance.DEFAULT,
			},
		);
	}
}

export function addNotificationResponseListener(
	onReminderOpened: (reminderKind: string) => void,
): (() => void) | null {
	const Notifications = getNotifications();
	if (!Notifications) return null;

	const subscription = Notifications.addNotificationResponseReceivedListener(
		(response) => {
			const data = response.notification.request.content.data;
			const reminderKind =
				data && typeof data === "object"
					? (data as Record<string, unknown>).reminder_kind
					: undefined;

			if (typeof reminderKind !== "string") return;

			onReminderOpened(reminderKind);
		},
	);

	return () => subscription.remove();
}

export async function requestNotificationPermission() {
	const Notifications = getNotifications();
	if (!Notifications) return false;

	const isGranted = (value: unknown) => {
		if (!value || typeof value !== "object") return false;

		if ("granted" in value) {
			return Boolean((value as { granted?: unknown }).granted);
		}

		if ("status" in value) {
			return (value as { status?: unknown }).status === "granted";
		}

		return false;
	};

	const current = await Notifications.getPermissionsAsync();
	if (isGranted(current)) return true;

	const next = await Notifications.requestPermissionsAsync();
	return isGranted(next);
}

/** Cancels every pending reminder tagged with `reminder_kind === kind`. */
async function cancelRemindersOfKind(
	Notifications: NotificationsModule,
	kind: string,
) {
	const scheduled = await Notifications.getAllScheduledNotificationsAsync();
	await Promise.all(
		scheduled
			.filter(
				(item) =>
					item.content.data &&
					typeof item.content.data === "object" &&
					(item.content.data as Record<string, unknown>).reminder_kind === kind,
			)
			.map((item) =>
				Notifications.cancelScheduledNotificationAsync(item.identifier),
			),
	);
}

/**
 * Nudges the traveller 10 minutes before the suggested on-plane sleep window
 * (see `getJetlagReminderFireAt`). Safe to call repeatedly — it replaces any
 * previously scheduled jet-lag reminder.
 */
export async function scheduleJetlagSleepReminder(fireAt: number, city: string) {
	const Notifications = getNotifications();
	if (!Notifications) {
		return { scheduled: false as const, reason: "unsupported" as const };
	}

	await initializeNotifications();

	const hasPermission = await requestNotificationPermission();
	if (!hasPermission) {
		return { scheduled: false as const, reason: "permission_denied" as const };
	}

	await cancelRemindersOfKind(Notifications, JETLAG_SLEEP_KIND);

	if (fireAt <= Date.now() + 2 * 60 * 1000) {
		return { scheduled: false as const, reason: "too_late" as const };
	}

	const fireDate = new Date(fireAt);
	const language = currentLanguage();
	const identifier = await Notifications.scheduleNotificationAsync({
		content: {
			title: translate(language, "notifJetlagSleepTitle"),
			body: translate(language, "notifJetlagSleepBody", { city }),
			data: { reminder_kind: JETLAG_SLEEP_KIND },
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: fireDate,
			channelId:
				Platform.OS === "android" ? FLIGHT_REMINDER_CHANNEL_ID : undefined,
		},
	});

	return {
		scheduled: true as const,
		identifier,
		scheduledFor: fireDate.getTime(),
	};
}

/** Drops the jet-lag reminder — used when the flight is cleared. */
export async function cancelJetlagSleepReminder() {
	const Notifications = getNotifications();
	if (!Notifications) return;
	await cancelRemindersOfKind(Notifications, JETLAG_SLEEP_KIND);
}

export async function scheduleFlightReadyReminder(departureTime: number) {
	const Notifications = getNotifications();
	if (!Notifications) {
		return { scheduled: false as const, reason: "unsupported" as const };
	}

	await initializeNotifications();

	const hasPermission = await requestNotificationPermission();
	if (!hasPermission) {
		return { scheduled: false as const, reason: "permission_denied" as const };
	}

	await cancelRemindersOfKind(Notifications, FLIGHT_REMINDER_KIND);

	const now = Date.now();
	const threeHoursBefore = departureTime - 3 * 60 * 60 * 1000;
	const thirtyMinutesBefore = departureTime - 30 * 60 * 1000;

	let fireAt = threeHoursBefore;
	if (fireAt <= now + 2 * 60 * 1000) {
		fireAt = thirtyMinutesBefore;
	}
	if (fireAt <= now + 2 * 60 * 1000) {
		fireAt = now + 5 * 60 * 1000;
	}

	const fireDate = new Date(fireAt);
	const identifier = await Notifications.scheduleNotificationAsync({
		content: {
			title: translate(currentLanguage(), "notifFlightReadyTitle"),
			body: translate(currentLanguage(), "notifFlightReadyBody"),
			data: {
				reminder_kind: FLIGHT_REMINDER_KIND,
				departure_time: departureTime,
				reminder_offset_minutes: Math.round((departureTime - fireAt) / 60000),
			},
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: fireDate,
			channelId:
				Platform.OS === "android" ? FLIGHT_REMINDER_CHANNEL_ID : undefined,
		},
	});

	return {
		scheduled: true as const,
		identifier,
		scheduledFor: fireDate.getTime(),
	};
}
