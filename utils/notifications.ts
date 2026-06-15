import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const FLIGHT_REMINDER_CHANNEL_ID = "flight-reminders";
const FLIGHT_REMINDER_KIND = "flight_ready";

let handlerConfigured = false;

function ensureNotificationHandler() {
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
	ensureNotificationHandler();

	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(
			FLIGHT_REMINDER_CHANNEL_ID,
			{
				name: "Flight reminders",
				importance: Notifications.AndroidImportance.DEFAULT,
			},
		);
	}
}

export async function requestNotificationPermission() {
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

export async function scheduleFlightReadyReminder(departureTime: number) {
	await initializeNotifications();

	const hasPermission = await requestNotificationPermission();
	if (!hasPermission) {
		return { scheduled: false as const, reason: "permission_denied" as const };
	}

	const scheduled = await Notifications.getAllScheduledNotificationsAsync();
	await Promise.all(
		scheduled
			.filter(
				(item) =>
					item.content.data &&
					typeof item.content.data === "object" &&
					(item.content.data as Record<string, unknown>).reminder_kind ===
						FLIGHT_REMINDER_KIND,
			)
			.map((item) =>
				Notifications.cancelScheduledNotificationAsync(item.identifier),
			),
	);

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
			title: "Your flight entertainment is ready",
			body: "Long flight ahead? Relax mode and offline games are ready.",
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
