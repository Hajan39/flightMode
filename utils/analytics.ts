export type AnalyticsEventName =
  | "app_open"
  | "second_session_started"
  | "onboarding_complete"
  | "flight_added"
  | "flight_edited"
  | "flight_setup_completed"
  | "game_start"
  | "game_finish"
  | "first_session_completed"
  | "article_open"
  | "article_finish"
  | "relax_start"
  | "relax_finish"
  | "reminder_scheduled"
  | "reminder_permission_denied"
  | "reminder_opened"
  | "audio_play"
  | "audio_stop"
  | "settings_open"
  | "profile_open"
  | "passport_shared"
  | "review_prompted"
  | "review_store_opened"
  | "home_action_open"
  | "home_phase_shown"
  | "home_recommendation_open"
  | "content_search_changed"
  | "content_filter_changed"
  | "content_sort_changed"
  | "network_status_changed"
  | "content_sync_start"
  | "content_sync_success"
  | "content_sync_failed"
  | "sync_network_policy_changed"
  | "support_opened"
  | "support_clicked"
  | "support_completed"
  | "premium_view"
  | "achievement_unlocked"
  | "jetlag_card_shown"
  | "checklist_open"
  | "checklist_item_toggled"
  | "checklist_custom_added"
  | "checklist_completed"
  | "checklist_reset"
  | "phrasebook_open"
  | "phrasebook_language_changed"
  | "converter_open"
  | "converter_used"
  | "rates_sync_success"
  | "rates_sync_failed"
  | "app_error";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnalyticsSink = (
  eventName: AnalyticsEventName,
  properties?: Record<string, string | number | boolean>
) => void;

const MAX_PENDING_EVENTS = 100;

let sink: AnalyticsSink | null = null;
let disabled = false;
let pendingEvents: Array<{
  eventName: AnalyticsEventName;
  properties?: Record<string, string | number | boolean>;
}> = [];

function sanitizeProperties(properties?: AnalyticsProperties) {
  if (!properties) {
    return;
  }

  return Object.fromEntries(
    Object.entries(properties).filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== null && entry[1] !== undefined
    )
  );
}

export function setAnalyticsSink(nextSink: AnalyticsSink | null) {
  sink = nextSink;
  disabled = false;

  if (!sink) {
    return;
  }

  const eventsToFlush = pendingEvents;
  pendingEvents = [];
  for (const event of eventsToFlush) {
    sink(event.eventName, event.properties);
  }
}

export function disableAnalytics() {
  disabled = true;
  sink = null;
  pendingEvents = [];
}

/**
 * What the PostHog bridge should do right now:
 * - `disabled` — user opted out: drop the in-app queue, opt PostHog out.
 * - `hold` — settings not hydrated yet (opt-out unknown), or the sync network
 *   policy forbids uploading on the current network: keep events in the
 *   bounded in-app queue, hand nothing to PostHog.
 * - `send` — forward to PostHog (which queues + uploads them).
 */
export type AnalyticsUploadMode = "disabled" | "hold" | "send";

export function getAnalyticsUploadMode(input: {
  /** User's analytics toggle (only meaningful once hydrated). */
  enabled: boolean;
  /** Settings store finished loading from storage. */
  hydrated: boolean;
  /** `canSyncOnNetwork(network, syncNetworkPolicy)` — false for policy `off`. */
  networkAllowsUpload: boolean;
}): AnalyticsUploadMode {
  if (!input.hydrated) {
    return "hold";
  }
  if (!input.enabled) {
    return "disabled";
  }
  return input.networkAllowsUpload ? "send" : "hold";
}

export type DepartureBucket = "past" | "<6h" | "6-24h" | "1-7d" | ">7d";

const HOUR_MS = 60 * 60 * 1000;

/** Coarse "how far ahead is the flight" — never the exact departure time. */
export function hoursUntilDepartureBucket(
  departureMs: number,
  nowMs: number
): DepartureBucket {
  const hours = (departureMs - nowMs) / HOUR_MS;
  if (!Number.isFinite(hours) || hours < 0) {
    return "past";
  }
  if (hours < 6) {
    return "<6h";
  }
  if (hours < 24) {
    return "6-24h";
  }
  if (hours < 24 * 7) {
    return "1-7d";
  }
  return ">7d";
}

export type DurationBucket = "<2h" | "2-5h" | "5-9h" | ">9h";

/** Coarse flight length — the exact minutes plus departure near-identify a flight. */
export function flightDurationBucket(minutes: number): DurationBucket {
  if (!Number.isFinite(minutes) || minutes < 120) {
    return "<2h";
  }
  if (minutes < 300) {
    return "2-5h";
  }
  if (minutes < 540) {
    return "5-9h";
  }
  return ">9h";
}

/** Every `source=` value the app's own links pass (grep `source=`). */
const ROUTE_SOURCES = new Set([
  "destination",
  "destinations",
  "direct",
  "home",
  "landed",
  "preflight",
  "tools",
]);

/**
 * Route params are attacker/deep-link controlled: only known `source` values
 * reach analytics; anything else is `other`, a missing one is `direct`.
 */
export function normalizeRouteSource(source: unknown): string {
  if (source === undefined || source === null || source === "") {
    return "direct";
  }
  return typeof source === "string" && ROUTE_SOURCES.has(source)
    ? source
    : "other";
}

export function captureAnalyticsEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties
) {
  if (disabled) {
    return;
  }

  const sanitizedProperties = sanitizeProperties(properties);

  if (sink) {
    sink(eventName, sanitizedProperties);
    return;
  }

  if (pendingEvents.length < MAX_PENDING_EVENTS) {
    pendingEvents.push({ eventName, properties: sanitizedProperties });
  }
}
