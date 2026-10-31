import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import {
  type SyncNetworkPolicy,
  useSettingsStore,
} from "@/store/useSettingsStore";

/**
 * Optional "fill in my flight by flight number" client.
 *
 * Talks to our own Cloudflare Worker (`services/flight-lookup`), never to the
 * data provider directly. Sends only the flight number and date. The feature
 * is OFF unless the build sets `EXPO_PUBLIC_FLIGHT_LOOKUP_URL` (the Worker
 * origin), and it is online-only + failure-tolerant: saving a flight manually
 * never depends on it.
 */

/** Same budget as the content/rates fetches: captive portals must not hang. */
export const FLIGHT_LOOKUP_TIMEOUT_MS = 8000;

const TRAILING_SLASHES_RE = /\/+$/;
const HTTPS_URL_RE = /^https:\/\/[^\s/]+/;

/** Worker origin from the build env; "" = feature disabled. */
export function getFlightLookupBaseUrl(): string {
  // Literal access so babel-preset-expo inlines it at build time.
  const url = process.env.EXPO_PUBLIC_FLIGHT_LOOKUP_URL ?? "";
  return url.trim().replace(TRAILING_SLASHES_RE, "");
}

export function isFlightLookupEnabled(
  baseUrl: string = getFlightLookupBaseUrl()
) {
  return HTTPS_URL_RE.test(baseUrl);
}

export type FlightLookupAvailability =
  | "ok"
  | "disabled"
  | "sync_off"
  | "wifi_only"
  | "offline";

type NetworkSnapshot = Parameters<typeof canSyncOnNetwork>[0];

/**
 * Whether a lookup may run right now. Honours Settings → Online Sync:
 * "Off" disables it, "Wi-Fi only" disables it on mobile data (with a hint).
 */
export function getFlightLookupAvailability(
  network: NetworkSnapshot,
  policy: SyncNetworkPolicy,
  baseUrl: string = getFlightLookupBaseUrl()
): FlightLookupAvailability {
  if (!isFlightLookupEnabled(baseUrl)) {
    return "disabled";
  }
  if (policy === "off") {
    return "sync_off";
  }
  if (network.isInternetReachable !== true) {
    return "offline";
  }
  if (!canSyncOnNetwork(network, policy)) {
    return "wifi_only";
  }
  return "ok";
}

const FLIGHT_NUMBER_RE =
  /^(?:[A-Z]{3}|[A-Z][0-9]|[0-9][A-Z]|[A-Z]{2})[0-9]{1,4}[A-Z]?$/;
const SEPARATORS_RE = /[\s\-_.]/g;

/**
 * "ok 123" → "OK123"; null when it is not an IATA/ICAO flight number.
 * Must agree with the Worker's `normalizeFlightNumber` (tested).
 */
export function normalizeFlightNumberInput(raw: string): string | null {
  if (raw.length > 32) {
    return null;
  }
  const compact = raw.replace(SEPARATORS_RE, "").toUpperCase();
  return FLIGHT_NUMBER_RE.test(compact) ? compact : null;
}

export interface FlightLookupAirport {
  city?: string;
  iata?: string;
  icao?: string;
  name?: string;
  scheduledLocal: string;
  /** ISO 8601 UTC instant. */
  scheduledUtc: string;
}

export interface FlightLookupData {
  arrival: FlightLookupAirport;
  codeshares?: string[];
  date: string;
  departure: FlightLookupAirport;
  durationMinutes: number | null;
  number: string;
}

export type FlightLookupError =
  | "disabled"
  | "sync_off"
  | "wifi_only"
  | "offline"
  | "invalid"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "error";

export type FlightLookupResult =
  | { ok: true; flight: FlightLookupData }
  | { ok: false; error: FlightLookupError };

function optString(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function parseAirport(value: unknown): FlightLookupAirport | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const scheduledUtc = optString(raw.scheduledUtc);
  if (!scheduledUtc || Number.isNaN(Date.parse(scheduledUtc))) {
    return null;
  }
  return {
    city: optString(raw.city),
    iata: optString(raw.iata),
    icao: optString(raw.icao),
    name: optString(raw.name),
    scheduledLocal: optString(raw.scheduledLocal) ?? scheduledUtc,
    scheduledUtc,
  };
}

/** Validates the Worker's JSON; null when it is not a usable flight. */
export function parseFlightLookupBody(body: unknown): FlightLookupData | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const departure = parseAirport(raw.departure);
  const arrival = parseAirport(raw.arrival);
  if (!(departure && arrival)) {
    return null;
  }
  const duration =
    typeof raw.durationMinutes === "number" &&
    Number.isFinite(raw.durationMinutes) &&
    raw.durationMinutes > 0
      ? Math.round(raw.durationMinutes)
      : null;
  return {
    arrival,
    codeshares: Array.isArray(raw.codeshares)
      ? raw.codeshares.filter((c): c is string => typeof c === "string")
      : undefined,
    date: optString(raw.date) ?? "",
    departure,
    durationMinutes: duration,
    number: optString(raw.number) ?? "",
  };
}

export function mapLookupStatus(status: number): FlightLookupError | null {
  if (status === 200) {
    return null;
  }
  if (status === 400) {
    return "invalid";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "unavailable";
  }
  return "error";
}

export interface LookupFlightOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  network?: NetworkSnapshot;
  policy?: SyncNetworkPolicy;
  timeoutMs?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Looks a flight up via the Worker. Never throws: every failure is a typed
 * error the edit screen turns into a hint (the user can always fill the form
 * by hand).
 */
export async function lookupFlight(
  number: string,
  date: string,
  options: LookupFlightOptions = {}
): Promise<FlightLookupResult> {
  const baseUrl = options.baseUrl ?? getFlightLookupBaseUrl();
  const availability = getFlightLookupAvailability(
    options.network ?? useNetworkStore.getState(),
    options.policy ?? useSettingsStore.getState().syncNetworkPolicy,
    baseUrl
  );
  if (availability !== "ok") {
    return { error: availability, ok: false };
  }
  const normalized = normalizeFlightNumberInput(number);
  if (!(normalized && DATE_RE.test(date))) {
    return { error: "invalid", ok: false };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? FLIGHT_LOOKUP_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Race as well as abort: a fetch that ignores the signal still settles.
  const timeout = new Promise<FlightLookupResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ error: "timeout", ok: false });
    }, timeoutMs);
  });

  const url = `${baseUrl}/v1/flight?number=${encodeURIComponent(
    normalized
  )}&date=${encodeURIComponent(date)}`;
  const request = (async (): Promise<FlightLookupResult> => {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const statusError = mapLookupStatus(response.status);
      if (statusError) {
        return { error: statusError, ok: false };
      }
      const flight = parseFlightLookupBody(await response.json());
      return flight ? { flight, ok: true } : { error: "error", ok: false };
    } catch {
      return {
        error: controller.signal.aborted ? "timeout" : "error",
        ok: false,
      };
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The only analytics payload of a lookup — never the number or the date.
 * Client-side input errors are not reported (no lookup happened).
 */
export function flightLookupAnalyticsResult(
  result: FlightLookupResult
): "filled" | "not_found" | "error" | "offline" | null {
  if (result.ok) {
    return "filled";
  }
  switch (result.error) {
    case "not_found":
      return "not_found";
    case "offline":
    case "sync_off":
    case "wifi_only":
      return "offline";
    case "disabled":
    case "invalid":
      return null;
    default:
      return "error";
  }
}
