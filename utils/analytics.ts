import AsyncStorage from "@react-native-async-storage/async-storage";

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
  properties: Record<string, string | number | boolean> | undefined,
  /** When the event happened (capture time), not when it is handed over. */
  timestamp: Date
) => void;

interface QueuedEvent {
  eventName: AnalyticsEventName;
  properties?: Record<string, string | number | boolean>;
  /** Capture time (epoch ms) — held events keep it through upload. */
  timestamp: number;
}

/** Storage used for the durable hold queue (AsyncStorage subset). */
export interface AnalyticsQueueStorage {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
}

/**
 * Held events survive app restarts (a whole offline flight can be held), so
 * the cap is generous; at the cap the OLDEST event is dropped.
 */
export const MAX_PENDING_EVENTS = 500;
export const ANALYTICS_QUEUE_KEY = "analytics_hold_queue";

let sink: AnalyticsSink | null = null;
let disabled = false;
let pendingEvents: QueuedEvent[] = [];
let queueStorage: AnalyticsQueueStorage = AsyncStorage;
/** The durable queue was read (or cleared): writes may replace it from now on. */
let queueRestored = false;
let restorePromise: Promise<void> | null = null;
let writeInFlight: Promise<void> | null = null;
let writeDirty = false;

/** Tests / alternative backends. */
export function setAnalyticsQueueStorage(storage: AnalyticsQueueStorage) {
  queueStorage = storage;
}

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

function capQueue(events: QueuedEvent[]): QueuedEvent[] {
  return events.length > MAX_PENDING_EVENTS
    ? events.slice(events.length - MAX_PENDING_EVENTS)
    : events;
}

function deliver(target: AnalyticsSink, event: QueuedEvent) {
  target(event.eventName, event.properties, new Date(event.timestamp));
}

function isPropertyValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function parseStoredQueue(raw: string | null): QueuedEvent[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const events: QueuedEvent[] = [];
    for (const item of parsed) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.eventName !== "string" ||
        typeof item.timestamp !== "number" ||
        !Number.isFinite(item.timestamp)
      ) {
        continue;
      }
      let properties: Record<string, string | number | boolean> | undefined;
      if (typeof item.properties === "object" && item.properties !== null) {
        properties = Object.fromEntries(
          Object.entries(item.properties as Record<string, unknown>).filter(
            (entry): entry is [string, string | number | boolean] =>
              isPropertyValue(entry[1])
          )
        );
      }
      events.push({
        eventName: item.eventName as AnalyticsEventName,
        properties,
        timestamp: item.timestamp,
      });
    }
    return events;
  } catch {
    return [];
  }
}

/** Mirrors the in-memory hold queue to storage (coalesced, never throws). */
function persistQueue() {
  if (!queueRestored) {
    // The stored queue is not merged yet: writing now would overwrite it.
    return;
  }
  writeDirty = true;
  if (writeInFlight) {
    return;
  }
  writeInFlight = (async () => {
    // `writeDirty` check and the reset below run in one synchronous step, so a
    // capture during the last await is never left unwritten.
    while (writeDirty) {
      writeDirty = false;
      try {
        if (pendingEvents.length === 0) {
          // biome-ignore lint/performance/noAwaitInLoops: writes must be sequential
          await queueStorage.removeItem(ANALYTICS_QUEUE_KEY);
        } else {
          await queueStorage.setItem(
            ANALYTICS_QUEUE_KEY,
            JSON.stringify(pendingEvents)
          );
        }
      } catch {
        // Analytics must never break offline-first app flows.
      }
    }
    writeInFlight = null;
  })();
}

/** Resolves once pending storage writes settled (tests). */
export async function flushAnalyticsQueueWrites() {
  while (writeInFlight) {
    // biome-ignore lint/performance/noAwaitInLoops: wait for the coalesced write chain
    await writeInFlight;
  }
}

/**
 * Loads events held in a previous app run and merges them (older first) with
 * events captured since launch. Call once settings hydrated and analytics is
 * not disabled; a no-op after the first call.
 */
export function restoreAnalyticsQueue(): Promise<void> {
  if (restorePromise) {
    return restorePromise;
  }
  restorePromise = (async () => {
    let raw: string | null = null;
    try {
      raw = await queueStorage.getItem(ANALYTICS_QUEUE_KEY);
    } catch {
      raw = null;
    }
    queueRestored = true;
    if (disabled) {
      clearStoredQueue();
      return;
    }
    const stored = parseStoredQueue(raw);
    const merged = capQueue(
      [...stored, ...pendingEvents].sort((a, b) => a.timestamp - b.timestamp)
    );
    if (sink) {
      pendingEvents = [];
      for (const event of merged) {
        deliver(sink, event);
      }
    } else {
      pendingEvents = merged;
    }
    persistQueue();
  })();
  return restorePromise;
}

function clearStoredQueue() {
  // Opt-out wins over any pending mirror write: clear after it settles.
  const clear = async () => {
    await flushAnalyticsQueueWrites();
    try {
      await queueStorage.removeItem(ANALYTICS_QUEUE_KEY);
    } catch {
      // Analytics must never break offline-first app flows.
    }
  };
  // biome-ignore lint/complexity/noVoid: fire-and-forget; must never block UI
  void clear();
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
    deliver(sink, event);
  }
  if (eventsToFlush.length > 0) {
    persistQueue();
  }
}

export function disableAnalytics() {
  disabled = true;
  sink = null;
  pendingEvents = [];
  writeDirty = false;
  clearStoredQueue();
}

/**
 * What the PostHog bridge should do right now:
 * - `disabled` — user opted out: drop the in-app queue, opt PostHog out.
 * - `hold` — settings not hydrated yet (opt-out unknown), or the sync network
 *   policy forbids uploading on the current network: keep events in the
 *   bounded, durable (survives restarts) in-app queue, hand nothing to PostHog.
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

/**
 * Whether the sync policy lets analytics upload on this network. Unlike
 * `canSyncOnNetwork`, an unknown (`null`) reachability — some devices never
 * report it — counts as usable when the OS says we are connected; only an
 * explicit `false` blocks. The policy's network type rule still applies.
 */
export function analyticsNetworkAllowsUpload(
  network: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  },
  policy: "wifi_only" | "wifi_and_mobile" | "off"
): boolean {
  if (policy === "off" || network.isInternetReachable === false) {
    return false;
  }
  if (network.isInternetReachable === null && network.isConnected !== true) {
    return false;
  }
  if (policy === "wifi_only") {
    return network.type === "WIFI" || network.type === "ETHERNET";
  }
  return network.type !== "NONE";
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

  const event: QueuedEvent = {
    eventName,
    properties: sanitizedProperties,
    timestamp: Date.now(),
  };

  if (sink) {
    deliver(sink, event);
    return;
  }

  pendingEvents.push(event);
  pendingEvents = capQueue(pendingEvents);
  persistQueue();
}
