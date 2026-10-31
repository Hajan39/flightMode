/**
 * App side of the optional flight lookup: the Worker client
 * (utils/flightLookup.ts) and the edit-screen fill logic
 * (utils/flightLookupFill.ts + data/destinationAirports.ts).
 */
import {
  destinationAirports,
  findDestinationIdByAirport,
} from "@/data/destinationAirports";
import { destinations } from "@/data/destinations";
import {
  type FlightLookupData,
  type FlightLookupResult,
  flightLookupAnalyticsResult,
  getFlightLookupAvailability,
  getFlightLookupBaseUrl,
  isFlightLookupEnabled,
  lookupFlight,
  mapLookupStatus,
  parseFlightLookupBody,
} from "@/utils/flightLookup";
import { fieldsToApply, mapLookupToForm } from "@/utils/flightLookupFill";

const IATA_RE = /^[A-Z]{3}$/;
const BASE = "https://flight-lookup.example.workers.dev";
const WIFI = { isInternetReachable: true, type: "WIFI" as const };
const CELL = { isInternetReachable: true, type: "CELLULAR" as const };
const OFFLINE = { isInternetReachable: false, type: "NONE" as const };

const flightBody = {
  arrival: {
    city: "Paris",
    iata: "CDG",
    icao: "LFPG",
    name: "Paris Charles de Gaulle",
    scheduledLocal: "2026-11-14T10:55+01:00",
    scheduledUtc: "2026-11-14T09:55:00.000Z",
  },
  codeshareStatus: "operator",
  date: "2026-11-14",
  departure: {
    city: "Prague",
    iata: "PRG",
    icao: "LKPR",
    scheduledLocal: "2026-11-14T09:00+01:00",
    scheduledUtc: "2026-11-14T08:00:00.000Z",
  },
  durationMinutes: 115,
  legCount: 1,
  number: "OK766",
};

function fakeFetch(status: number, body: unknown = flightBody) {
  return jest.fn(async () => ({
    json: async () => body,
    status,
  })) as unknown as typeof fetch & jest.Mock;
}

describe("feature flag", () => {
  const original = process.env.EXPO_PUBLIC_FLIGHT_LOOKUP_URL;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_FLIGHT_LOOKUP_URL;
    } else {
      process.env.EXPO_PUBLIC_FLIGHT_LOOKUP_URL = original;
    }
  });

  it("is disabled without a URL (the production default)", () => {
    delete process.env.EXPO_PUBLIC_FLIGHT_LOOKUP_URL;
    expect(getFlightLookupBaseUrl()).toBe("");
    expect(isFlightLookupEnabled()).toBe(false);
  });

  it("reads the env URL (trailing slash stripped); https only", () => {
    process.env.EXPO_PUBLIC_FLIGHT_LOOKUP_URL = `${BASE}/`;
    expect(getFlightLookupBaseUrl()).toBe(BASE);
    expect(isFlightLookupEnabled()).toBe(true);
    expect(isFlightLookupEnabled("http://insecure.example")).toBe(false);
    expect(isFlightLookupEnabled("   ")).toBe(false);
  });
});

describe("availability (Settings → Online Sync)", () => {
  it.each([
    ["", "wifi_and_mobile", WIFI, "disabled"],
    [BASE, "off", WIFI, "sync_off"],
    [BASE, "wifi_only", CELL, "wifi_only"],
    [BASE, "wifi_only", WIFI, "ok"],
    [BASE, "wifi_and_mobile", CELL, "ok"],
    [BASE, "wifi_and_mobile", OFFLINE, "offline"],
    [BASE, "wifi_only", OFFLINE, "offline"],
  ] as const)("url=%p policy=%s → %s", (url, policy, network, expected) => {
    expect(getFlightLookupAvailability(network, policy, url)).toBe(expected);
  });
});

describe("lookupFlight", () => {
  const ok = { baseUrl: BASE, network: WIFI, policy: "wifi_only" } as const;

  it("never calls the network when disabled or blocked by policy", async () => {
    const fetchImpl = fakeFetch(200);
    await expect(
      lookupFlight("OK766", "2026-11-14", { ...ok, baseUrl: "", fetchImpl })
    ).resolves.toEqual({ error: "disabled", ok: false });
    await expect(
      lookupFlight("OK766", "2026-11-14", { ...ok, fetchImpl, policy: "off" })
    ).resolves.toEqual({ error: "sync_off", ok: false });
    await expect(
      lookupFlight("OK766", "2026-11-14", { ...ok, fetchImpl, network: CELL })
    ).resolves.toEqual({ error: "wifi_only", ok: false });
    await expect(
      lookupFlight("OK766", "2026-11-14", {
        ...ok,
        fetchImpl,
        network: OFFLINE,
      })
    ).resolves.toEqual({ error: "offline", ok: false });
    await expect(
      lookupFlight("hello", "2026-11-14", { ...ok, fetchImpl })
    ).resolves.toEqual({ error: "invalid", ok: false });
    await expect(
      lookupFlight("OK766", "14.11.2026", { ...ok, fetchImpl })
    ).resolves.toEqual({ error: "invalid", ok: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends only the normalized number and the date", async () => {
    const fetchImpl = fakeFetch(200);
    const result = await lookupFlight(" ok 766 ", "2026-11-14", {
      ...ok,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/flight?number=OK766&date=2026-11-14`);
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it.each([
    [400, "invalid"],
    [404, "not_found"],
    [429, "rate_limited"],
    [503, "unavailable"],
    [500, "error"],
    [418, "error"],
  ])("HTTP %i → %s", async (status, error) => {
    await expect(
      lookupFlight("OK766", "2026-11-14", {
        ...ok,
        fetchImpl: fakeFetch(status, { error: "x" }),
      })
    ).resolves.toEqual({ error, ok: false });
  });

  it("a malformed 200 body or a thrown fetch is an error, not a crash", async () => {
    await expect(
      lookupFlight("OK766", "2026-11-14", {
        ...ok,
        fetchImpl: fakeFetch(200, "<html>captive portal</html>"),
      })
    ).resolves.toEqual({ error: "error", ok: false });
    await expect(
      lookupFlight("OK766", "2026-11-14", {
        ...ok,
        fetchImpl: jest.fn(() =>
          Promise.reject(new TypeError("Network request failed"))
        ) as unknown as typeof fetch,
      })
    ).resolves.toEqual({ error: "error", ok: false });
  });

  it("times out (and aborts) a hanging request", async () => {
    jest.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fetchImpl = jest.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined); // never settles
      }) as unknown as typeof fetch;
      const pending = lookupFlight("OK766", "2026-11-14", {
        ...ok,
        fetchImpl,
        timeoutMs: 8000,
      });
      jest.advanceTimersByTime(8000);
      await expect(pending).resolves.toEqual({ error: "timeout", ok: false });
      expect(signal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("status mapping covers 200", () => {
    expect(mapLookupStatus(200)).toBeNull();
  });
});

describe("parseFlightLookupBody", () => {
  it("keeps the fields the app uses", () => {
    expect(parseFlightLookupBody(flightBody)).toMatchObject({
      arrival: { iata: "CDG" },
      departure: { iata: "PRG", scheduledUtc: "2026-11-14T08:00:00.000Z" },
      durationMinutes: 115,
    });
  });

  it("rejects bodies without parseable times", () => {
    expect(parseFlightLookupBody({ error: "not_found" })).toBeNull();
    expect(
      parseFlightLookupBody({
        ...flightBody,
        departure: { ...flightBody.departure, scheduledUtc: "soon" },
      })
    ).toBeNull();
  });

  it("drops a non-positive duration", () => {
    expect(
      parseFlightLookupBody({ ...flightBody, durationMinutes: -5 })
        ?.durationMinutes
    ).toBeNull();
  });
});

describe("analytics payload", () => {
  it.each([
    [{ flight: {} as FlightLookupData, ok: true }, "filled"],
    [{ error: "not_found", ok: false }, "not_found"],
    [{ error: "offline", ok: false }, "offline"],
    [{ error: "sync_off", ok: false }, "offline"],
    [{ error: "wifi_only", ok: false }, "offline"],
    [{ error: "rate_limited", ok: false }, "error"],
    [{ error: "timeout", ok: false }, "error"],
    [{ error: "unavailable", ok: false }, "error"],
    [{ error: "invalid", ok: false }, null],
    [{ error: "disabled", ok: false }, null],
  ] as [FlightLookupResult, string | null][])("%o → %p", (result, expected) => {
    expect(flightLookupAnalyticsResult(result)).toBe(expected);
  });
});

describe("destination airports", () => {
  it("covers every destination and nothing else", () => {
    expect(Object.keys(destinationAirports).sort()).toEqual(
      destinations.map((d) => d.id).sort()
    );
  });

  it("codes are 3 uppercase letters and map to one destination only", () => {
    const seen = new Map<string, string>();
    for (const [id, codes] of Object.entries(destinationAirports)) {
      for (const code of codes) {
        expect(code).toMatch(IATA_RE);
        expect(seen.get(code)).toBeUndefined();
        seen.set(code, id);
      }
    }
  });

  it("finds by IATA, case-insensitive", () => {
    expect(findDestinationIdByAirport("cdg")).toBe("paris");
    expect(findDestinationIdByAirport("KIX")).toBe("osaka");
    expect(findDestinationIdByAirport("XXX")).toBeUndefined();
    expect(findDestinationIdByAirport(undefined)).toBeUndefined();
  });
});

describe("mapLookupToForm", () => {
  const flight = parseFlightLookupBody(flightBody) as FlightLookupData;

  it("shows the scheduled UTC departure in the device's local time", () => {
    const fill = mapLookupToForm(flight);
    const local = new Date(Date.UTC(2026, 10, 14, 8, 0));
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(fill?.departureDate).toBe(
      `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
    );
    expect(fill?.departureClock).toBe(
      `${pad(local.getHours())}:${pad(local.getMinutes())}`
    );
    // The round trip is exact whatever the test machine's zone is.
    const [y, m, d] = (fill?.departureDate ?? "").split("-").map(Number);
    const [hh, mm] = (fill?.departureClock ?? "").split(":").map(Number);
    expect(new Date(y, m - 1, d, hh, mm).getTime()).toBe(local.getTime());
  });

  it("is not the airport-local wall time when zones differ", () => {
    // Departure 23:30Z: in UTC+ zones this is the next calendar day.
    const late = mapLookupToForm({
      ...flight,
      departure: {
        ...flight.departure,
        scheduledLocal: "2026-11-14T23:30+00:00",
        scheduledUtc: "2026-11-14T23:30:00.000Z",
      },
    });
    const local = new Date(Date.UTC(2026, 10, 14, 23, 30));
    expect(
      late?.departureDate.endsWith(String(local.getDate()).padStart(2, "0"))
    ).toBe(true);
  });

  it("fills duration in stepper format and matches the destination", () => {
    expect(mapLookupToForm(flight)).toMatchObject({
      destinationId: "paris",
      durationHours: "1",
      durationMinutes: "55",
      route: { from: "PRG", to: "CDG" },
    });
  });

  it("leaves duration / destination out when unknown", () => {
    const fill = mapLookupToForm({
      ...flight,
      arrival: { ...flight.arrival, iata: "BRQ" },
      durationMinutes: null,
    });
    expect(fill?.durationHours).toBeUndefined();
    expect(fill?.destinationId).toBeUndefined();
  });

  it("caps duration at the steppers' 24:00", () => {
    expect(mapLookupToForm({ ...flight, durationMinutes: 2000 })).toMatchObject(
      { durationHours: "24", durationMinutes: "00" }
    );
  });

  it("falls back to ICAO codes for the route line", () => {
    const fill = mapLookupToForm({
      ...flight,
      arrival: { ...flight.arrival, iata: undefined },
    });
    expect(fill?.route.to).toBe("LFPG");
  });
});

describe("fieldsToApply", () => {
  const fill = {
    departureClock: "09:00",
    departureDate: "2026-11-14",
    destinationId: "paris",
    durationHours: "1",
    durationMinutes: "55",
    route: { from: "PRG", to: "CDG" },
  };

  it("applies everything when nothing was touched", () => {
    expect(fieldsToApply(fill, new Set())).toEqual({
      departureClock: "09:00",
      departureDate: "2026-11-14",
      destinationId: "paris",
      durationHours: "1",
      durationMinutes: "55",
    });
  });

  it("never overwrites a field the user edited during the lookup", () => {
    expect(fieldsToApply(fill, new Set(["duration", "destination"]))).toEqual({
      departureClock: "09:00",
      departureDate: "2026-11-14",
    });
    expect(fieldsToApply(fill, new Set(["departure"]))).not.toHaveProperty(
      "departureDate"
    );
  });

  it("does not clear the destination when none matched", () => {
    expect(
      fieldsToApply({ ...fill, destinationId: undefined }, new Set())
    ).not.toHaveProperty("destinationId");
  });
});
