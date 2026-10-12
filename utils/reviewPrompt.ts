import { Alert, Linking } from "react-native";

import type { TranslationKey } from "@/i18n/translations";
import { isNetworkUsable, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

const MIN_APP_OPENS = 4;
const MIN_GAMES_PLAYED = 8;
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const PLAY_ID = "com.hajan39.flightmode";

/** Pure gate: engaged users only; never again after rating or "No thanks"; "Later" waits 30 days. */
export function shouldAskForReview(
  appOpenCount: number,
  gamesPlayed: number,
  lastPromptAt: number | null,
  done: boolean,
  nowMs: number
): boolean {
  if (done || appOpenCount < MIN_APP_OPENS || gamesPlayed < MIN_GAMES_PLAYED) {
    return false;
  }
  return lastPromptAt === null || nowMs - lastPromptAt >= COOLDOWN_MS;
}

async function openStoreListing() {
  try {
    await Linking.openURL(`market://details?id=${PLAY_ID}`);
  } catch {
    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${PLAY_ID}`
    );
  }
}

/**
 * Asks for a store rating with our own dialog (Play's in-app sheet is quota-limited
 * and often never shows). Called from Home only, never during a game, and only
 * online since the store needs a connection. Neutral wording: Play forbids
 * steering only happy users to the store.
 */
export function maybeAskForReview(
  gamesPlayed: number,
  t: (key: TranslationKey) => string
): void {
  const settings = useSettingsStore.getState();
  if (
    !(
      isNetworkUsable(useNetworkStore.getState()) &&
      shouldAskForReview(
        settings.appOpenCount,
        gamesPlayed,
        settings.lastReviewPromptAt,
        settings.reviewDone,
        Date.now()
      )
    )
  ) {
    return;
  }
  settings.markReviewPrompted();
  captureAnalyticsEvent("review_prompted");
  Alert.alert(t("reviewAskTitle"), t("reviewAskBody"), [
    {
      onPress: () => settings.markReviewDone(),
      style: "cancel",
      text: t("reviewAskNever"),
    },
    { text: t("reviewAskLater") },
    {
      onPress: () => {
        settings.markReviewDone();
        captureAnalyticsEvent("review_store_opened");
        // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
        void openStoreListing();
      },
      text: t("reviewAskRate"),
    },
  ]);
}
