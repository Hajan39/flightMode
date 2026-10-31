/**
 * Flight-lookup Worker core (services/flight-lookup/src/core.ts): validation,
 * AeroDataBox normalization, cache keys/TTLs, abuse-protection decisions and
 * the full request flow with injected (fake) bindings.
 */
import {
  buildUpstreamRequest,
  cacheKey,
  classifyUpstreamStatus,
  DEFAULT_CONFIG,
  FixedWindowLimiter,
  handleLookup,
  isDateInWindow,
  KV_MIN_TTL_SECONDS,
  type LookupDeps,
  type NormalizedFlight,
  negativeTtlSeconds,
  normalizeFlightNumber,
  normalizeUpstream,
  parseCachedEntry,
  parseConfig,
  parseUpstreamTime,
  positiveTtlSeconds,
  takeBudget,
  validateQuery,
} from "@/services/flight-lookup/src/core";
import { normalizeFlightNumberInput } from "@/utils/flightLookup";

import {
  codeshare,
  legacyFlatTimes,
  missingArrival,
  multiLeg,
  singleLeg,
} from "./helpers/aerodataboxFixtures";
import { forAll } from "./helpers/property";

const NOW = Date.UTC(2026, 9, 31, 12, 0); // 2026-10-31 12:00Z

describe("normalizeFlightNumber", () => {
  it.each([
    ["ok123", "OK123", "OK"],
    [" OK 123 ", "OK123", "OK"],
    ["ok-0123", "OK0123", "OK"],
    ["U2 1234", "U21234", "U2"],
    ["2b123", "2B123", "2B"],
    ["CSA766", "CSA766", "CSA"],
    ["klm 1395", "KLM1395", "KLM"],
    ["BA1A", "BA1A", "BA"],
  ])("%s → %s", (raw, normalized, airline) => {
    expect(normalizeFlightNumber(raw)).toMatchObject({ airline, normalized });
  });

  it.each([
    "",
    "OK",
    "123",
    "OK12345",
    "12345",
    "11123",
    "OK123AB",
    "ABCD123",
    "OK 1 2 3 4 5",
    "OK123; DROP",
    "ÖK123",
    "x".repeat(40),
  ])("rejects %p", (raw) => {
    expect(normalizeFlightNumber(raw)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(normalizeFlightNumber(123)).toBeNull();
    expect(normalizeFlightNumber(null)).toBeNull();
  });

  it("property: valid shapes normalize; the app client agrees with the Worker", () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const noise = " -_.";
    forAll("flight number normalization", 300, (g) => {
      const airline = g.bool()
        ? g.string(letters, 3)
        : g.pick([
            g.string(letters, 2),
            g.string(letters, 1) + g.string(digits, 1),
            g.string(digits, 1) + g.string(letters, 1),
          ]);
      const number = g.string(digits, g.int(1, 4));
      const suffix = g.bool(0.2) ? g.string(letters, 1) : "";
      const canonical = `${airline}${number}${suffix}`;
      // Random case + separators must not change the result.
      const messy = [...canonical]
        .map((ch) => (g.bool() ? ch.toLowerCase() : ch))
        .map((ch) => (g.bool(0.2) ? `${g.pick([...noise])}${ch}` : ch))
        .join("");
      const worker = normalizeFlightNumber(messy);
      expect(worker?.normalized).toBe(canonical);
      expect(normalizeFlightNumberInput(messy)).toBe(canonical);
      expect(normalizeFlightNumber(worker?.normalized)?.normalized).toBe(
        canonical
      );

      // Arbitrary junk: both sides accept or reject identically.
      const junk = g.string(`${letters}${digits}${noise}#/?`, g.int(0, 10));
      expect(normalizeFlightNumberInput(junk)).toBe(
        normalizeFlightNumber(junk)?.normalized ?? null
      );
    });
  });
});

describe("date window", () => {
  const cfg = { maxDaysAhead: 330, maxDaysBehind: 1 };

  it("accepts yesterday … today+330 (UTC days)", () => {
    expect(isDateInWindow("2026-10-30", NOW, cfg)).toBe(true);
    expect(isDateInWindow("2026-10-31", NOW, cfg)).toBe(true);
    expect(isDateInWindow("2027-09-26", NOW, cfg)).toBe(true); // +330
  });

  it("rejects outside the window and impossible dates", () => {
    expect(isDateInWindow("2026-10-29", NOW, cfg)).toBe(false);
    expect(isDateInWindow("2027-09-27", NOW, cfg)).toBe(false); // +331
    expect(isDateInWindow("2026-02-30", NOW, cfg)).toBe(false);
    expect(isDateInWindow("2026-11-1", NOW, cfg)).toBe(false);
    expect(isDateInWindow("14.11.2026", NOW, cfg)).toBe(false);
  });

  it("validateQuery reports which input is wrong", () => {
    expect(validateQuery("ok 766", "2026-11-14", NOW, cfg)).toEqual({
      date: "2026-11-14",
      number: "OK766",
      ok: true,
    });
    expect(validateQuery("nope", "2026-11-14", NOW, cfg)).toEqual({
      ok: false,
      reason: "invalid_number",
    });
    expect(validateQuery("OK766", undefined, NOW, cfg)).toEqual({
      ok: false,
      reason: "invalid_date",
    });
  });
});

describe("config", () => {
  it("falls back to defaults for missing / malformed vars", () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG);
    expect(
      parseConfig({ CACHE_MAX_SECONDS: "abc", UPSTREAM_DAILY_CAP: "" })
    ).toEqual(DEFAULT_CONFIG);
  });

  it("reads and clamps vars, strips a trailing slash", () => {
    const cfg = parseConfig({
      CACHE_MAX_SECONDS: "5",
      UPSTREAM_AUTH_HEADER: "X-RapidAPI-Key",
      UPSTREAM_BASE_URL: "https://aerodatabox.p.rapidapi.com/",
      UPSTREAM_DAILY_CAP: "250",
      UPSTREAM_DATE_ROLE: "",
      UPSTREAM_HOST_HEADER: "X-RapidAPI-Host",
    });
    expect(cfg.cacheMaxSeconds).toBe(KV_MIN_TTL_SECONDS);
    expect(cfg.upstreamDailyCap).toBe(250);
    expect(cfg.upstreamBaseUrl).toBe("https://aerodatabox.p.rapidapi.com");
    expect(cfg.upstreamDateRole).toBe("");
  });
});

describe("upstream request", () => {
  it("API.Market: key header, dateLocalRole, no images/location", () => {
    const req = buildUpstreamRequest(
      "OK766",
      "2026-11-14",
      "k",
      DEFAULT_CONFIG
    );
    expect(req.url).toBe(
      "https://prod.api.market/api/v1/aedbx/aerodatabox/flights/number/OK766/2026-11-14?withAircraftImage=false&withLocation=false&dateLocalRole=Departure"
    );
    expect(req.headers).toEqual({
      Accept: "application/json",
      "x-api-market-key": "k",
    });
  });

  it("RapidAPI: switched by vars only", () => {
    const cfg = parseConfig({
      UPSTREAM_AUTH_HEADER: "X-RapidAPI-Key",
      UPSTREAM_BASE_URL: "https://aerodatabox.p.rapidapi.com",
      UPSTREAM_DATE_ROLE: "",
      UPSTREAM_HOST_HEADER: "X-RapidAPI-Host",
    });
    const req = buildUpstreamRequest("OK766", "2026-11-14", "k", cfg);
    expect(req.url).toBe(
      "https://aerodatabox.p.rapidapi.com/flights/number/OK766/2026-11-14?withAircraftImage=false&withLocation=false"
    );
    expect(req.headers).toEqual({
      Accept: "application/json",
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      "X-RapidAPI-Key": "k",
    });
  });

  it.each([
    [200, "ok"],
    [204, "not_found"],
    [404, "not_found"],
    [400, "not_found"],
    [429, "rate_limited"],
    [401, "unavailable"],
    [403, "unavailable"],
    [500, "unavailable"],
    [502, "unavailable"],
  ])("status %i → %s", (status, kind) => {
    expect(classifyUpstreamStatus(status)).toBe(kind);
  });
});

describe("parseUpstreamTime", () => {
  it("parses AeroDataBox and ISO formats", () => {
    expect(parseUpstreamTime("2026-11-14 08:00Z")?.ms).toBe(
      Date.UTC(2026, 10, 14, 8, 0)
    );
    expect(parseUpstreamTime("2026-11-14 09:00+01:00")).toEqual({
      iso: "2026-11-14T09:00+01:00",
      localDate: "2026-11-14",
      ms: Date.UTC(2026, 10, 14, 8, 0),
    });
    expect(parseUpstreamTime("2026-11-14T09:00:00+0100")?.ms).toBe(
      Date.UTC(2026, 10, 14, 8, 0)
    );
    expect(parseUpstreamTime("2026-11-14T08:00:00.000Z")?.ms).toBe(
      Date.UTC(2026, 10, 14, 8, 0)
    );
  });

  it("rejects junk", () => {
    expect(parseUpstreamTime("tomorrow")).toBeNull();
    expect(parseUpstreamTime("2026-11-14 08:00")).toBeNull(); // no zone
    expect(parseUpstreamTime(42)).toBeNull();
  });
});

describe("normalizeUpstream", () => {
  it("maps a single leg", () => {
    expect(normalizeUpstream(singleLeg, "OK766", "2026-11-14")).toEqual({
      airline: "CSA Czech Airlines",
      arrival: {
        city: "Paris",
        iata: "CDG",
        icao: "LFPG",
        name: "Paris Charles de Gaulle",
        scheduledLocal: "2026-11-14T10:55+01:00",
        scheduledUtc: "2026-11-14T09:55:00.000Z",
        timeZone: "Europe/Paris",
      },
      codeshareStatus: "operator",
      date: "2026-11-14",
      departure: {
        city: "Prague",
        iata: "PRG",
        icao: "LKPR",
        name: "Prague Vaclav Havel",
        scheduledLocal: "2026-11-14T09:00+01:00",
        scheduledUtc: "2026-11-14T08:00:00.000Z",
        timeZone: "Europe/Prague",
      },
      durationMinutes: 115,
      legCount: 1,
      number: "OK766",
    });
  });

  it("picks the leg departing on the requested date, not one arriving", () => {
    const flight = normalizeUpstream(multiLeg, "QR920", "2026-11-14");
    expect(flight?.departure.iata).toBe("DOH");
    expect(flight?.departure.scheduledUtc).toBe("2026-11-14T05:00:00.000Z");
    expect(flight?.arrival.iata).toBe("SYD");
    expect(flight?.durationMinutes).toBe(14 * 60);

    const next = normalizeUpstream(multiLeg, "QR920", "2026-11-15");
    expect(next?.departure.iata).toBe("SYD");
    expect(next?.arrival.iata).toBe("AKL");
  });

  it("with two legs the same day, returns the first and counts both", () => {
    const sameDay = [
      {
        arrival: {
          airport: { iata: "SYD", icao: "YSSY" },
          scheduledTime: { utc: "2026-11-14 12:00Z" },
        },
        departure: {
          airport: { iata: "MEL", icao: "YMML" },
          scheduledTime: { utc: "2026-11-14 10:30Z" },
        },
        number: "QF 1",
      },
      {
        arrival: {
          airport: { iata: "MEL", icao: "YMML" },
          scheduledTime: { utc: "2026-11-14 10:00Z" },
        },
        departure: {
          airport: { iata: "ADL", icao: "YPAD" },
          scheduledTime: { utc: "2026-11-14 08:45Z" },
        },
        number: "QF 1",
      },
    ];
    const flight = normalizeUpstream(sameDay, "QF1", "2026-11-14");
    expect(flight?.departure.iata).toBe("ADL");
    expect(flight?.legCount).toBe(2);
    // No local time upstream: falls back to the UTC instant.
    expect(flight?.departure.scheduledLocal).toBe("2026-11-14T08:45:00.000Z");
  });

  it("reports codeshare status and the other numbers of the same leg", () => {
    const flight = normalizeUpstream(codeshare, "AF4911", "2026-11-14");
    expect(flight?.codeshareStatus).toBe("codeshare");
    expect(flight?.number).toBe("AF4911");
    expect(flight?.codeshares).toEqual(["KL2286", "OK766"]);

    const operator = normalizeUpstream(codeshare, "OK766", "2026-11-14");
    expect(operator?.codeshareStatus).toBe("operator");
    expect(operator?.codeshares).toEqual(["AF4911", "KL2286"]);
  });

  it("an ICAO query keeps the queried number", () => {
    const flight = normalizeUpstream(singleLeg, "CSA766", "2026-11-14");
    expect(flight?.number).toBe("CSA766");
    expect(flight?.departure.iata).toBe("PRG");
    expect(flight?.codeshares).toEqual(["OK766"]);
  });

  it("accepts legacy flat time fields", () => {
    const flight = normalizeUpstream(legacyFlatTimes, "OK766", "2026-11-14");
    expect(flight?.durationMinutes).toBe(115);
    expect(flight?.departure.scheduledLocal).toBe("2026-11-14T09:00:00+01:00");
  });

  it("returns null for empty / unusable / non-array bodies", () => {
    expect(normalizeUpstream([], "OK766", "2026-11-14")).toBeNull();
    expect(normalizeUpstream(missingArrival, "OK766", "2026-11-14")).toBeNull();
    expect(normalizeUpstream(null, "OK766", "2026-11-14")).toBeNull();
    expect(normalizeUpstream("<html>", "OK766", "2026-11-14")).toBeNull();
  });

  it("drops an implausible duration instead of inventing one", () => {
    const broken = [
      {
        ...singleLeg[0],
        arrival: {
          ...singleLeg[0].arrival,
          scheduledTime: { utc: "2026-11-14 07:00Z" },
        },
      },
    ];
    expect(
      normalizeUpstream(broken, "OK766", "2026-11-14")?.durationMinutes
    ).toBeNull();
  });
});

describe("cache key + TTL", () => {
  it("keys by version, number and date", () => {
    expect(cacheKey("OK766", "2026-11-14")).toBe("v1:OK766:2026-11-14");
  });

  it("positive TTL runs to the end of the day after the flight, capped", () => {
    const cfg = { cacheMaxSeconds: 30 * 86_400 };
    // Flight tomorrow (2026-11-01): expires 2026-11-03 00:00Z.
    expect(positiveTtlSeconds("2026-11-01", NOW, cfg)).toBe(
      (Date.UTC(2026, 10, 3) - NOW) / 1000
    );
    // Far future: capped.
    expect(
      positiveTtlSeconds("2027-06-01", NOW, { cacheMaxSeconds: 259_200 })
    ).toBe(259_200);
    // Yesterday's flight: still ≥ KV minimum.
    expect(positiveTtlSeconds("2026-10-30", NOW, cfg)).toBe(
      (Date.UTC(2026, 10, 1) - NOW) / 1000
    );
    expect(positiveTtlSeconds("2026-10-29", NOW + 2 * 86_400_000, cfg)).toBe(
      KV_MIN_TTL_SECONDS
    );
  });

  it("negative TTL is the shorter of its own setting and the positive TTL", () => {
    const cfg = { cacheMaxSeconds: 259_200, negativeCacheSeconds: 21_600 };
    expect(negativeTtlSeconds("2027-01-01", NOW, cfg)).toBe(21_600);
    expect(negativeTtlSeconds("2026-10-30", NOW, cfg)).toBe(21_600);
    expect(
      negativeTtlSeconds("2026-10-30", Date.UTC(2026, 9, 31, 23, 0), cfg)
    ).toBe(3600);
  });

  it("parses cached entries defensively", () => {
    expect(parseCachedEntry(null)).toBeNull();
    expect(parseCachedEntry("{oops")).toBeNull();
    expect(parseCachedEntry('{"kind":"found"}')).toBeNull();
    expect(parseCachedEntry('{"kind":"not_found"}')).toEqual({
      kind: "not_found",
    });
  });
});

describe("abuse protection", () => {
  it("fixed-window limiter allows `limit` per window per key", () => {
    const limiter = new FixedWindowLimiter(3, 60_000);
    expect([1, 2, 3, 4].map(() => limiter.check("a", 0))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(limiter.check("b", 0)).toBe(true);
    expect(limiter.check("a", 59_999)).toBe(false);
    expect(limiter.check("a", 60_000)).toBe(true);
  });

  it("limiter memory stays bounded", () => {
    const limiter = new FixedWindowLimiter(1, 60_000, 100);
    for (let i = 0; i < 1000; i += 1) {
      limiter.check(`ip${i}`, i);
    }
    expect(limiter.size).toBeLessThanOrEqual(100);
  });

  it("daily budget counts up to the cap and resets on a new UTC day", () => {
    let state = takeBudget(null, NOW, 2);
    expect(state).toEqual({
      allowed: true,
      state: { count: 1, day: "2026-10-31" },
    });
    state = takeBudget(state.state, NOW, 2);
    expect(state.allowed).toBe(true);
    state = takeBudget(state.state, NOW, 2);
    expect(state).toEqual({
      allowed: false,
      state: { count: 2, day: "2026-10-31" },
    });
    const tomorrow = takeBudget(state.state, NOW + 86_400_000, 2);
    expect(tomorrow).toEqual({
      allowed: true,
      state: { count: 1, day: "2026-11-01" },
    });
    expect(takeBudget(null, NOW, 0).allowed).toBe(false);
  });
});

describe("handleLookup flow", () => {
  function makeDeps(overrides: Partial<LookupDeps> = {}) {
    const kv = new Map<string, { value: string; ttl: number }>();
    const calls = { budget: 0, upstream: 0, urls: [] as string[] };
    const deps: LookupDeps = {
      apiKey: "secret",
      cacheGet: async (key) => kv.get(key)?.value ?? null,
      cachePut: (key, value, ttl) => {
        kv.set(key, { ttl, value });
        return Promise.resolve();
      },
      fetchUpstream: (url) => {
        calls.upstream += 1;
        calls.urls.push(url);
        return Promise.resolve({
          json: () => Promise.resolve(singleLeg),
          status: 200,
        });
      },
      now: () => NOW,
      rateLimit: () => Promise.resolve(true),
      takeUpstreamBudget: () => {
        calls.budget += 1;
        return Promise.resolve(true);
      },
      ...overrides,
    };
    return { calls, deps, kv };
  }

  it("400 without touching rate limit, cache or upstream", async () => {
    const rateLimit = jest.fn(async () => true);
    const { calls, deps, kv } = makeDeps({ rateLimit });
    const res = await handleLookup(
      "DROP TABLE",
      "2026-11-14",
      deps,
      DEFAULT_CONFIG
    );
    expect(res).toEqual({
      body: { error: "invalid_number" },
      maxAge: 0,
      status: 400,
    });
    const badDate = await handleLookup(
      "OK766",
      "2030-01-01",
      deps,
      DEFAULT_CONFIG
    );
    expect(badDate.body).toEqual({ error: "invalid_date" });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(calls.upstream).toBe(0);
    expect(kv.size).toBe(0);
  });

  it("miss → upstream → cached; hit → no upstream", async () => {
    const { calls, deps, kv } = makeDeps();
    const first = await handleLookup(
      "ok 766",
      "2026-11-14",
      deps,
      DEFAULT_CONFIG
    );
    expect(first.status).toBe(200);
    expect((first.body as NormalizedFlight).arrival.iata).toBe("CDG");
    expect(calls.upstream).toBe(1);
    expect(calls.urls[0]).toContain("/flights/number/OK766/2026-11-14?");
    const entry = kv.get("v1:OK766:2026-11-14");
    expect(entry?.ttl).toBe(DEFAULT_CONFIG.cacheMaxSeconds);
    expect(JSON.parse(entry?.value ?? "{}").kind).toBe("found");

    const second = await handleLookup(
      "OK766",
      "2026-11-14",
      deps,
      DEFAULT_CONFIG
    );
    expect(second).toEqual(first);
    expect(calls.upstream).toBe(1);
    expect(calls.budget).toBe(1);
  });

  it("not found (204) is cached negatively with the short TTL", async () => {
    const { calls, deps, kv } = makeDeps({
      fetchUpstream: () => {
        calls.upstream += 1;
        return Promise.resolve({
          json: () => Promise.reject(new Error("no body")),
          status: 204,
        });
      },
    });
    const res = await handleLookup("OK999", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(res).toEqual({
      body: { error: "not_found" },
      maxAge: 0,
      status: 404,
    });
    expect(kv.get("v1:OK999:2026-11-14")?.ttl).toBe(
      DEFAULT_CONFIG.negativeCacheSeconds
    );
    await handleLookup("OK999", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(calls.upstream).toBe(1);
  });

  it("an unusable 200 body counts as not found", async () => {
    const { deps, kv } = makeDeps({
      fetchUpstream: async () => ({ json: async () => [], status: 200 }),
    });
    const res = await handleLookup("OK766", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(res.status).toBe(404);
    expect(kv.size).toBe(1);
  });

  it("429 when the client is rate limited (before the cache)", async () => {
    const cacheGet = jest.fn(async () => null);
    const { calls, deps } = makeDeps({
      cacheGet,
      rateLimit: async () => false,
    });
    const res = await handleLookup("OK766", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(res).toEqual({
      body: { error: "rate_limited" },
      maxAge: 0,
      status: 429,
    });
    expect(cacheGet).not.toHaveBeenCalled();
    expect(calls.upstream).toBe(0);
  });

  it("503 without upstream call when the daily cap is reached", async () => {
    const { calls, deps } = makeDeps({ takeUpstreamBudget: async () => false });
    const res = await handleLookup("OK766", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "upstream_unavailable" });
    expect(calls.upstream).toBe(0);
  });

  it("503 without upstream call when the API key secret is missing", async () => {
    const { calls, deps } = makeDeps({ apiKey: undefined });
    const res = await handleLookup("OK766", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(res.status).toBe(503);
    expect(calls.upstream).toBe(0);
    expect(calls.budget).toBe(0);
  });

  it.each([401, 403, 429, 500, 503])(
    "upstream %i → 503, nothing cached",
    async (status) => {
      const { deps, kv } = makeDeps({
        fetchUpstream: async () => ({ json: async () => ({}), status }),
      });
      const res = await handleLookup(
        "OK766",
        "2026-11-14",
        deps,
        DEFAULT_CONFIG
      );
      expect(res.status).toBe(503);
      expect(kv.size).toBe(0);
    }
  );

  it.each([
    ["network error / timeout", () => Promise.reject(new Error("timeout"))],
    [
      "bad JSON",
      () =>
        Promise.resolve({
          json: () => Promise.reject(new SyntaxError("bad json")),
          status: 200,
        }),
    ],
  ] as [string, LookupDeps["fetchUpstream"]][])(
    "%s → 503, nothing cached",
    async (_label, fetchUpstream) => {
      const { deps, kv } = makeDeps({ fetchUpstream });
      const res = await handleLookup(
        "OK766",
        "2026-11-14",
        deps,
        DEFAULT_CONFIG
      );
      expect(res.status).toBe(503);
      expect(kv.size).toBe(0);
    }
  );

  it("still answers when the KV write quota is exhausted or KV reads fail", async () => {
    const { deps } = makeDeps({
      cacheGet: () => Promise.reject(new Error("kv down")),
      cachePut: () => Promise.reject(new Error("KV put() limit exceeded")),
    });
    const res = await handleLookup("OK766", "2026-11-14", deps, DEFAULT_CONFIG);
    expect(res.status).toBe(200);
  });
});
