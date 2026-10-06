import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

const MIN_APP_OPENS = 3;
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;

/** Pure gate: ask only engaged users, at a happy moment, at most every 60 days. */
export function shouldAskForReview(
  appOpenCount: number,
  lastPromptAt: number | null,
  nowMs: number
): boolean {
  if (appOpenCount < MIN_APP_OPENS) {
    return false;
  }
  return lastPromptAt === null || nowMs - lastPromptAt >= COOLDOWN_MS;
}

/**
 * Asks Google Play for the native in-app review sheet after a new best score.
 * Play itself decides whether the sheet shows (quota), so this never blocks UX.
 */
export async function maybeRequestReview(): Promise<void> {
  const settings = useSettingsStore.getState();
  if (
    !shouldAskForReview(
      settings.appOpenCount,
      settings.lastReviewPromptAt,
      Date.now()
    )
  ) {
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StoreReview =
      require("expo-store-review") as typeof import("expo-store-review");
    if (!(await StoreReview.hasAction())) {
      return;
    }
    settings.markReviewPrompted();
    captureAnalyticsEvent("review_prompted");
    await StoreReview.requestReview();
  } catch {
    // Native module missing (Expo Go / web) — skip silently.
  }
}
