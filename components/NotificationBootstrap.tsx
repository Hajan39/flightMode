import { useEffect } from "react";

import { captureAnalyticsEvent } from "@/utils/analytics";
import {
	addNotificationResponseListener,
	initializeNotifications,
} from "@/utils/notifications";

export default function NotificationBootstrap() {
	useEffect(() => {
		initializeNotifications().catch(() => {
			// Notifications are optional; bootstrap must never block app startup.
		});

		const removeListener = addNotificationResponseListener((reminderKind) => {
			captureAnalyticsEvent("reminder_opened", {
				reminder_kind: reminderKind,
			});
		});

		return () => removeListener?.();
	}, []);

	return null;
}
