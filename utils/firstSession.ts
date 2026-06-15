import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

type FirstSessionSource = "game" | "relax" | "content";

export function trackFirstSessionCompleted(source: FirstSessionSource) {
	const settings = useSettingsStore.getState();
	if (settings.hasCompletedFirstSession) return;

	settings.markFirstSessionCompleted();
	captureAnalyticsEvent("first_session_completed", { source });
}
