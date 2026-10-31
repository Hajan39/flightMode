/**
 * Pure, runtime-agnostic logic of the flight-lookup Worker.
 *
 * Nothing here touches Cloudflare APIs: bindings are injected through
 * `LookupDeps`, so the whole request flow is unit-tested from the app's root
 * Jest run (`__tests__/flightLookupWorker.test.ts`) and type-checked by the
 * root `tsc` (this file is listed in the root tsconfig `files`).
 *
 * Privacy: this module never logs. The only inputs are a flight number, a
 * date and an opaque (hashed) rate-limit key.
 */

/** Bump to invalidate every cached entry after a response-shape change. */
export const CACHE_KEY_VERSION = "v1";

/** Cloudflare KV refuses `expirationTtl` below 60 s. */
export const KV_MIN_TTL_SECONDS = 60;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** Longest plausible scheduled leg (Singapore–New York is ~19 h). */
const MAX_LEG_MINUTES = 24 * 60;

// ---------------------------------------------------------------------------
// Configuration (wrangler.toml [vars] — all strings in the Worker env)
// ---------------------------------------------------------------------------

export interface LookupConfig {
  /** Upper bound for a positive cache entry, seconds. */
  cacheMaxSeconds: number;
  /** Rate-limit fallback (when the Rate Limiting binding is absent). */
  ipLimitPerMinute: number;
  maxDaysAhead: number;
  maxDaysBehind: number;
  /** TTL of a cached "not found", seconds. */
  negativeCacheSeconds: number;
  /** Header that carries the API key (API.Market: x-api-market-key). */
  upstreamAuthHeader: string;
  /** e.g. https://prod.api.market/api/v1/aedbx/aerodatabox (no trailing /). */
  upstreamBaseUrl: string;
  /** Global upstream calls per UTC day (cache misses only). */
  upstreamDailyCap: number;
  /** `dateLocalRole` query value; empty = parameter not sent. */
  upstreamDateRole: string;
  /** RapidAPI also wants `X-RapidAPI-Host`; empty = not sent. */
  upstreamHostHeader: string;
  /** Upstream request budget, ms. */
  upstreamTimeoutMs: number;
}

export const DEFAULT_CONFIG: LookupConfig = {
  cacheMaxSeconds: 3 * 86_400,
  ipLimitPerMinute: 10,
  maxDaysAhead: 330,
  maxDaysBehind: 1,
  negativeCacheSeconds: 6 * 3600,
  upstreamAuthHeader: "x-api-market-key",
  upstreamBaseUrl: "https://prod.api.market/api/v1/aedbx/aerodatabox",
  upstreamDailyCap: 100,
  upstreamDateRole: "Departure",
  upstreamHostHeader: "",
  upstreamTimeoutMs: 6000,
};

const TRAILING_SLASHES_RE = /\/+$/;

function intVar(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }
  const parsed = Number(value);
  if (!(Number.isFinite(parsed) && String(value).trim() !== "")) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function stringVar(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

/** Reads the Worker vars; anything missing or malformed falls back safely. */
export function parseConfig(vars: Record<string, unknown>): LookupConfig {
  const d = DEFAULT_CONFIG;
  const base = stringVar(vars.UPSTREAM_BASE_URL, d.upstreamBaseUrl).replace(
    TRAILING_SLASHES_RE,
    ""
  );
  return {
    cacheMaxSeconds: intVar(
      vars.CACHE_MAX_SECONDS,
      d.cacheMaxSeconds,
      KV_MIN_TTL_SECONDS,
      30 * 86_400
    ),
    ipLimitPerMinute: intVar(
      vars.IP_LIMIT_PER_MINUTE,
      d.ipLimitPerMinute,
      1,
      1000
    ),
    maxDaysAhead: intVar(vars.MAX_DAYS_AHEAD, d.maxDaysAhead, 0, 400),
    maxDaysBehind: intVar(vars.MAX_DAYS_BEHIND, d.maxDaysBehind, 0, 30),
    negativeCacheSeconds: intVar(
      vars.NEGATIVE_CACHE_SECONDS,
      d.negativeCacheSeconds,
      KV_MIN_TTL_SECONDS,
      7 * 86_400
    ),
    upstreamAuthHeader:
      stringVar(vars.UPSTREAM_AUTH_HEADER, d.upstreamAuthHeader) ||
      d.upstreamAuthHeader,
    upstreamBaseUrl: base || d.upstreamBaseUrl,
    upstreamDailyCap: intVar(
      vars.UPSTREAM_DAILY_CAP,
      d.upstreamDailyCap,
      0,
      1_000_000
    ),
    upstreamDateRole: stringVar(vars.UPSTREAM_DATE_ROLE, d.upstreamDateRole),
    upstreamHostHeader: stringVar(
      vars.UPSTREAM_HOST_HEADER,
      d.upstreamHostHeader
    ),
    upstreamTimeoutMs: intVar(
      vars.UPSTREAM_TIMEOUT_MS,
      d.upstreamTimeoutMs,
      1000,
      20_000
    ),
  };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Airline designator + 1–4 digit flight number + optional operational suffix.
 * Designator: ICAO (3 letters) or IATA (2 characters, at least one a letter).
 * The ICAO branch is tried first; "AB1234" falls through to IATA "AB".
 */
const FLIGHT_NUMBER_RE =
  /^(?:([A-Z]{3})|([A-Z][0-9]|[0-9][A-Z]|[A-Z]{2}))([0-9]{1,4})([A-Z]?)$/;
const SEPARATORS_RE = /[\s\-_.]/g;

export interface FlightNumber {
  airline: string;
  digits: string;
  /** Canonical form used for the cache key and upstream, e.g. "OK123". */
  normalized: string;
  suffix: string;
}

/** Uppercases, strips spaces/dashes and validates; null when not a flight number. */
export function normalizeFlightNumber(raw: unknown): FlightNumber | null {
  if (typeof raw !== "string" || raw.length > 32) {
    return null;
  }
  const compact = raw.replace(SEPARATORS_RE, "").toUpperCase();
  const match = FLIGHT_NUMBER_RE.exec(compact);
  if (!match) {
    return null;
  }
  const airline = match[1] ?? match[2] ?? "";
  const digits = match[3] ?? "";
  const suffix = match[4] ?? "";
  return { airline, digits, normalized: compact, suffix };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight UTC of a real calendar date "YYYY-MM-DD", else null. */
export function parseIsoDate(date: unknown): number | null {
  if (typeof date !== "string") {
    return null;
  }
  const match = DATE_RE.exec(date);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/** "YYYY-MM-DD" of `nowMs` in UTC. */
export function utcDay(nowMs: number) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * The date must lie within [today − maxDaysBehind, today + maxDaysAhead]
 * (UTC days). Flight dates are airport-local, so ±1 day slack is built into
 * the defaults (behind = 1).
 */
export function isDateInWindow(
  date: string,
  nowMs: number,
  config: Pick<LookupConfig, "maxDaysAhead" | "maxDaysBehind">
) {
  const dateMs = parseIsoDate(date);
  if (dateMs === null) {
    return false;
  }
  const todayMs = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate()
  );
  const diffDays = Math.round((dateMs - todayMs) / DAY_MS);
  return diffDays >= -config.maxDaysBehind && diffDays <= config.maxDaysAhead;
}

export type ValidationResult =
  | { ok: true; number: string; date: string }
  | { ok: false; reason: "invalid_number" | "invalid_date" };

export function validateQuery(
  rawNumber: unknown,
  rawDate: unknown,
  nowMs: number,
  config: Pick<LookupConfig, "maxDaysAhead" | "maxDaysBehind">
): ValidationResult {
  const number = normalizeFlightNumber(rawNumber);
  if (!number) {
    return { ok: false, reason: "invalid_number" };
  }
  if (typeof rawDate !== "string" || !isDateInWindow(rawDate, nowMs, config)) {
    return { ok: false, reason: "invalid_date" };
  }
  return { date: rawDate, number: number.normalized, ok: true };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export function cacheKey(number: string, date: string) {
  return `${CACHE_KEY_VERSION}:${number}:${date}`;
}

/**
 * Positive TTL: until the end of the day after the flight date (UTC), capped
 * by `cacheMaxSeconds` so schedule changes for far-future flights are picked
 * up, and never below the KV minimum.
 */
export function positiveTtlSeconds(
  date: string,
  nowMs: number,
  config: Pick<LookupConfig, "cacheMaxSeconds">
) {
  const dateMs = parseIsoDate(date) ?? nowMs;
  const expiresAt = dateMs + 2 * DAY_MS;
  const seconds = Math.floor((expiresAt - nowMs) / 1000);
  return Math.max(
    KV_MIN_TTL_SECONDS,
    Math.min(config.cacheMaxSeconds, seconds)
  );
}

export function negativeTtlSeconds(
  date: string,
  nowMs: number,
  config: Pick<LookupConfig, "cacheMaxSeconds" | "negativeCacheSeconds">
) {
  return Math.min(
    config.negativeCacheSeconds,
    positiveTtlSeconds(date, nowMs, config)
  );
}

export type CachedEntry =
  | { kind: "found"; flight: NormalizedFlight }
  | { kind: "not_found" };

export function parseCachedEntry(raw: string | null): CachedEntry | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CachedEntry> | null;
    if (parsed?.kind === "not_found") {
      return { kind: "not_found" };
    }
    if (parsed?.kind === "found" && parsed.flight) {
      return { flight: parsed.flight, kind: "found" };
    }
  } catch {
    // A corrupt entry is a cache miss.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Abuse protection (pure decisions; storage is injected)
// ---------------------------------------------------------------------------

/**
 * Fixed-window per-key limiter kept in isolate memory. Only a fallback for
 * when the Workers Rate Limiting binding is not configured: an isolate is
 * per data centre and can be recycled any time, so this is best-effort.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<
    string,
    { count: number; start: number }
  >();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(limit: number, windowMs = MINUTE_MS, maxKeys = 5000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  /** true = allowed (and counted). */
  check(key: string, nowMs: number) {
    const current = this.windows.get(key);
    if (!current || nowMs - current.start >= this.windowMs) {
      if (this.windows.size >= this.maxKeys) {
        this.prune(nowMs);
      }
      this.windows.set(key, { count: 1, start: nowMs });
      return true;
    }
    if (current.count >= this.limit) {
      return false;
    }
    current.count += 1;
    return true;
  }

  get size() {
    return this.windows.size;
  }

  private prune(nowMs: number) {
    for (const [key, value] of this.windows) {
      if (nowMs - value.start >= this.windowMs) {
        this.windows.delete(key);
      }
    }
    // Still full (a burst of distinct keys): drop the oldest entries.
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.windows.delete(oldest);
    }
  }
}

export interface BudgetState {
  count: number;
  /** UTC day "YYYY-MM-DD" the count belongs to. */
  day: string;
}

/**
 * Global daily upstream budget: a new UTC day resets the count; a call is
 * allowed while `count < cap` and is counted immediately (even if upstream
 * then fails — a failing upstream must not be hammered either).
 */
export function takeBudget(
  state: BudgetState | null | undefined,
  nowMs: number,
  cap: number
): { allowed: boolean; state: BudgetState } {
  const day = utcDay(nowMs);
  const count = state && state.day === day ? state.count : 0;
  if (count >= cap) {
    return { allowed: false, state: { count, day } };
  }
  return { allowed: true, state: { count: count + 1, day } };
}

// ---------------------------------------------------------------------------
// Upstream (AeroDataBox) request + response normalization
// ---------------------------------------------------------------------------

export function buildUpstreamRequest(
  number: string,
  date: string,
  apiKey: string,
  config: LookupConfig
): { url: string; headers: Record<string, string> } {
  const params = new URLSearchParams({
    withAircraftImage: "false",
    withLocation: "false",
  });
  if (config.upstreamDateRole) {
    params.set("dateLocalRole", config.upstreamDateRole);
  }
  const url = `${config.upstreamBaseUrl}/flights/number/${encodeURIComponent(
    number
  )}/${date}?${params.toString()}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    [config.upstreamAuthHeader]: apiKey,
  };
  if (config.upstreamHostHeader) {
    try {
      headers[config.upstreamHostHeader] = new URL(config.upstreamBaseUrl).host;
    } catch {
      // Malformed base URL: the fetch itself will fail and map to 503.
    }
  }
  return { headers, url };
}

export type UpstreamClass = "ok" | "not_found" | "rate_limited" | "unavailable";

/**
 * AeroDataBox answers 204 (or 404) when it has no flight; 400 for a number it
 * cannot parse (our validation already passed, so treat it as "no such
 * flight"). 401/403 (bad key / plan) and 5xx are our problem, not the user's.
 */
export function classifyUpstreamStatus(status: number): UpstreamClass {
  if (status === 200) {
    return "ok";
  }
  if (status === 204 || status === 404 || status === 400) {
    return "not_found";
  }
  if (status === 429) {
    return "rate_limited";
  }
  return "unavailable";
}

export interface NormalizedAirport {
  /** Municipality, e.g. "Prague". */
  city?: string;
  iata?: string;
  icao?: string;
  name?: string;
  /** Airport-local wall time with offset, e.g. "2026-11-14T08:40+01:00". */
  scheduledLocal: string;
  /** UTC instant, ISO 8601, e.g. "2026-11-14T07:40:00.000Z". */
  scheduledUtc: string;
  timeZone?: string;
}

export interface NormalizedFlight {
  airline?: string;
  arrival: NormalizedAirport;
  /** Whether the queried number is the operating carrier's. */
  codeshareStatus: "operator" | "codeshare" | "unknown";
  /** Other flight numbers sold on the same leg (if upstream returned them). */
  codeshares?: string[];
  /** The date the client asked for (YYYY-MM-DD). */
  date: string;
  departure: NormalizedAirport;
  /** Arrival − departure (scheduled, UTC); null when implausible. */
  durationMinutes: number | null;
  /** Legs flown under this number that day (the earliest is returned). */
  legCount: number;
  number: string;
}

/**
 * AeroDataBox times look like "2026-11-14 07:40Z" (UTC) and
 * "2026-11-14 08:40+01:00" (local). ISO with "T" and seconds is accepted too.
 */
const UPSTREAM_TIME_RE =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export function parseUpstreamTime(
  value: unknown
): { ms: number; iso: string; localDate: string } | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = UPSTREAM_TIME_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, day, hm, seconds, zone] = match;
  const offset =
    zone === "Z" || zone.includes(":")
      ? zone
      : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const iso = `${day}T${hm}${seconds ? `:${seconds}` : ""}${offset}`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return null;
  }
  return { iso, localDate: day, ms };
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function optString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

interface ParsedMovement {
  airport: Omit<NormalizedAirport, "scheduledLocal" | "scheduledUtc">;
  local: { iso: string; localDate: string };
  utcMs: number;
}

function parseMovement(raw: unknown): ParsedMovement | null {
  const movement = asObject(raw);
  const airport = asObject(movement?.airport);
  if (!(movement && airport)) {
    return null;
  }
  const scheduled = asObject(movement.scheduledTime);
  // Older API versions used flat scheduledTimeUtc / scheduledTimeLocal.
  const utc = parseUpstreamTime(scheduled?.utc ?? movement.scheduledTimeUtc);
  const local = parseUpstreamTime(
    scheduled?.local ?? movement.scheduledTimeLocal
  );
  if (!utc) {
    return null;
  }
  const iata = optString(airport.iata)?.toUpperCase();
  const icao = optString(airport.icao)?.toUpperCase();
  if (!(iata || icao)) {
    return null;
  }
  return {
    airport: {
      city: optString(airport.municipalityName),
      iata,
      icao,
      name: optString(airport.name),
      timeZone: optString(airport.timeZone),
    },
    // Without a local time, fall back to UTC (still a correct instant).
    local: local ?? {
      iso: new Date(utc.ms).toISOString(),
      localDate: utc.localDate,
    },
    utcMs: utc.ms,
  };
}

interface ParsedLeg {
  airline?: string;
  arrival: ParsedMovement;
  codeshareStatus: NormalizedFlight["codeshareStatus"];
  departure: ParsedMovement;
  number: string;
}

function parseLeg(raw: unknown): ParsedLeg | null {
  const leg = asObject(raw);
  if (!leg) {
    return null;
  }
  const departure = parseMovement(leg.departure);
  const arrival = parseMovement(leg.arrival);
  if (!(departure && arrival)) {
    return null;
  }
  let codeshareStatus: NormalizedFlight["codeshareStatus"] = "unknown";
  if (leg.codeshareStatus === "IsOperator") {
    codeshareStatus = "operator";
  } else if (leg.codeshareStatus === "IsCodeshared") {
    codeshareStatus = "codeshare";
  }
  return {
    airline: optString(asObject(leg.airline)?.name),
    arrival,
    codeshareStatus,
    departure,
    number: (optString(leg.number) ?? "")
      .replace(SEPARATORS_RE, "")
      .toUpperCase(),
  };
}

function airportId(movement: ParsedMovement) {
  return movement.airport.icao ?? movement.airport.iata ?? "";
}

function toAirport(movement: ParsedMovement): NormalizedAirport {
  const airport: NormalizedAirport = {
    scheduledLocal: movement.local.iso,
    scheduledUtc: new Date(movement.utcMs).toISOString(),
  };
  for (const key of ["city", "iata", "icao", "name", "timeZone"] as const) {
    const value = movement.airport[key];
    if (value) {
      airport[key] = value;
    }
  }
  return airport;
}

/**
 * Maps the AeroDataBox `GET /flights/number/{n}/{date}` array to one leg.
 *
 * Leg choice: entries whose scheduled *departure* local date equals the
 * requested date win (the endpoint also returns flights merely *arriving* that
 * day); among those the earliest departure (first leg of a multi-leg
 * flight). With no departure match, the earliest entry is used.
 * Entries describing the same physical leg (same departure airport + time)
 * under another number are reported as codeshares.
 */
export function normalizeUpstream(
  body: unknown,
  number: string,
  date: string
): NormalizedFlight | null {
  const list = Array.isArray(body) ? body : [body];
  const legs = list
    .map(parseLeg)
    .filter((leg): leg is ParsedLeg => leg !== null)
    .sort((a, b) => a.departure.utcMs - b.departure.utcMs);
  if (legs.length === 0) {
    return null;
  }
  const sameDay = legs.filter((leg) => leg.departure.local.localDate === date);
  const pool = sameDay.length > 0 ? sameDay : legs;
  const ownNumber = pool.filter(
    (leg) => leg.number === "" || leg.number === number
  );
  const [chosen] = ownNumber.length > 0 ? ownNumber : pool;

  const sameLeg = legs.filter(
    (leg) =>
      leg.departure.utcMs === chosen.departure.utcMs &&
      airportId(leg.departure) === airportId(chosen.departure)
  );
  const codeshares = [
    ...new Set(
      sameLeg.map((leg) => leg.number).filter((n) => n !== "" && n !== number)
    ),
  ].sort();
  const distinctLegs = new Set(
    pool
      .filter((leg) => leg.number === chosen.number)
      .map((leg) => `${airportId(leg.departure)}>${airportId(leg.arrival)}`)
  );

  const minutes = Math.round(
    (chosen.arrival.utcMs - chosen.departure.utcMs) / MINUTE_MS
  );
  const flight: NormalizedFlight = {
    arrival: toAirport(chosen.arrival),
    codeshareStatus: chosen.codeshareStatus,
    date,
    departure: toAirport(chosen.departure),
    durationMinutes: minutes > 0 && minutes <= MAX_LEG_MINUTES ? minutes : null,
    legCount: Math.max(1, distinctLegs.size),
    number,
  };
  if (chosen.airline) {
    flight.airline = chosen.airline;
  }
  if (codeshares.length > 0) {
    flight.codeshares = codeshares;
  }
  return flight;
}

// ---------------------------------------------------------------------------
// Request flow
// ---------------------------------------------------------------------------

export type LookupErrorCode =
  | "invalid_number"
  | "invalid_date"
  | "not_found"
  | "rate_limited"
  | "upstream_unavailable";

export interface LookupResponse {
  body: NormalizedFlight | { error: LookupErrorCode };
  /** Seconds the client may reuse the answer (0 = no-store). */
  maxAge: number;
  status: 200 | 400 | 404 | 429 | 503;
}

export interface UpstreamResponse {
  json: () => Promise<unknown>;
  status: number;
}

export interface LookupDeps {
  apiKey: string | undefined;
  cacheGet: (key: string) => Promise<string | null>;
  cachePut: (key: string, value: string, ttlSeconds: number) => Promise<void>;
  /** Upstream fetch; rejects on network error / timeout. */
  fetchUpstream: (
    url: string,
    headers: Record<string, string>
  ) => Promise<UpstreamResponse>;
  now: () => number;
  /** Per-client limiter; true = allowed. */
  rateLimit: () => Promise<boolean>;
  /** Global daily upstream budget; true = a call may be made. */
  takeUpstreamBudget: () => Promise<boolean>;
}

function errorResponse(
  status: LookupResponse["status"],
  error: LookupErrorCode
): LookupResponse {
  return { body: { error }, maxAge: 0, status };
}

function found(flight: NormalizedFlight): LookupResponse {
  return { body: flight, maxAge: 600, status: 200 };
}

async function safePut(
  deps: LookupDeps,
  key: string,
  entry: CachedEntry,
  ttl: number
) {
  try {
    await deps.cachePut(key, JSON.stringify(entry), ttl);
  } catch {
    // KV write quota (free: 1,000/day) exhausted or transient: still answer.
  }
}

/**
 * The whole GET /v1/flight flow. Order matters for cost:
 * validate (free) → rate limit → KV read → daily budget → upstream →
 * KV write only for a definitive answer (found / not found).
 */
export async function handleLookup(
  rawNumber: unknown,
  rawDate: unknown,
  deps: LookupDeps,
  config: LookupConfig
): Promise<LookupResponse> {
  const nowMs = deps.now();
  const query = validateQuery(rawNumber, rawDate, nowMs, config);
  if (!query.ok) {
    return errorResponse(400, query.reason);
  }
  if (!(await deps.rateLimit())) {
    return errorResponse(429, "rate_limited");
  }

  const key = cacheKey(query.number, query.date);
  let cached: CachedEntry | null = null;
  try {
    cached = parseCachedEntry(await deps.cacheGet(key));
  } catch {
    cached = null;
  }
  if (cached?.kind === "found") {
    return found(cached.flight);
  }
  if (cached?.kind === "not_found") {
    return errorResponse(404, "not_found");
  }

  if (!deps.apiKey) {
    return errorResponse(503, "upstream_unavailable");
  }
  if (!(await deps.takeUpstreamBudget())) {
    return errorResponse(503, "upstream_unavailable");
  }

  const request = buildUpstreamRequest(
    query.number,
    query.date,
    deps.apiKey,
    config
  );
  let upstream: UpstreamResponse;
  try {
    upstream = await deps.fetchUpstream(request.url, request.headers);
  } catch {
    return errorResponse(503, "upstream_unavailable");
  }

  const kind = classifyUpstreamStatus(upstream.status);
  if (kind === "rate_limited" || kind === "unavailable") {
    return errorResponse(503, "upstream_unavailable");
  }
  if (kind === "not_found") {
    await safePut(
      deps,
      key,
      { kind: "not_found" },
      negativeTtlSeconds(query.date, nowMs, config)
    );
    return errorResponse(404, "not_found");
  }

  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return errorResponse(503, "upstream_unavailable");
  }
  const flight = normalizeUpstream(body, query.number, query.date);
  if (!flight) {
    await safePut(
      deps,
      key,
      { kind: "not_found" },
      negativeTtlSeconds(query.date, nowMs, config)
    );
    return errorResponse(404, "not_found");
  }
  await safePut(
    deps,
    key,
    { flight, kind: "found" },
    positiveTtlSeconds(query.date, nowMs, config)
  );
  return found(flight);
}
