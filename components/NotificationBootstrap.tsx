import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { captureAnalyticsEvent } from "@/utils/analytics";
import { initializeNotifications } from "@/utils/notifications";

export default function NotificationBootstrap() {
	useEffect(() => {
		initializeNotifications().catch(() => {
			// Notifications are optional; bootstrap must never block app startup.
		});

		const subscription = Notifications.addNotificationResponseReceivedListener(
			(response) => {
				const data = response.notification.request.content.data;
				const reminderKind =
					data && typeof data === "object"
						? (data as Record<string, unknown>).reminder_kind
						: undefined;

				if (typeof reminderKind !== "string") return;

				captureAnalyticsEvent("reminder_opened", {
					reminder_kind: reminderKind,
				});
			},
		);

		return () => subscription.remove();
	}, []);

	return null;
}
