/**
 * Property-based tests for the pure converter / time-zone / date utils:
 * every property runs over many seeded random inputs (see
 * helpers/property.ts — a failure prints the seed to reproduce it).
 */
import { currencies } from "@/data/currencies";
import { destinations } from "@/data/destinations";
import {
  convertCurrency,
  convertUnit,
  type DecimalSeparator,
  formatCurrency,
  parseAmount,
  type UnitKind,
} from "@/utils/convert";
import {
  addDays,
  dateKeyDiffDays,
  getDayOfYear,
  nextStreakState,
  type StreakState,
  toLocalDateKey,
} from "@/utils/dates";
import {
  formatTimeInZone,
  getDayOffset,
  getHourInZone,
  getJetlagPlan,
  getJetlagReminderFireAt,
  getZoneOffsetMinutes,
  normalizeShiftHours,
  type ZoneRef,
} from "@/utils/timezone";

import { assert, forAll, type Gen } from "./helpers/property";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LEADING_SPACE_SPLIT = /^\S+ /;

// ---------------------------------------------------------------------------
// utils/convert.ts
// ---------------------------------------------------------------------------

/** Writes `value` (fixed to `decimals`) the way a user of a locale would. */
function formatForLocale(
  value: number,
  decimals: number,
  decimal: DecimalSeparator,
  grouping: "none" | "separator" | "space" | "nbsp"
): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const groupChar = {
    nbsp: " ",
    none: "",
    separator: decimal === "." ? "," : ".",
    space: " ",
  }[grouping];
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, groupChar);
  const sign = value < 0 ? "-" : "";
  return frac ? `${sign}${grouped}${decimal}${frac}` : `${sign}${grouped}`;
}

describe("convert: parseAmount properties", () => {
  test("format → parse round-trips in both separator conventions (3000 cases)", () => {
    forAll("parseAmount round-trip", 3000, (g) => {
      const decimal = g.pick([",", "."] as const);
      const decimals = g.int(0, 4);
      const magnitude = 10 ** g.int(0, 9);
      const value = (g.bool(0.2) ? -1 : 1) * g.float(0, magnitude);
      const grouping = g.pick(["none", "separator", "space", "nbsp"] as const);
      const text = formatForLocale(value, decimals, decimal, grouping);
      const expected = Number(Math.abs(value).toFixed(decimals));
      const parsed = parseAmount(text, decimal);
      assert(parsed !== null, `"${text}" (${decimal}) was rejected`);
      assert(
        Math.abs(Math.abs(parsed) - expected) <= 1e-9 * Math.max(1, expected),
        `"${text}" (${decimal}) parsed as ${parsed}, expected ${expected}`
      );
      assert(
        expected === 0 || Math.sign(parsed) === Math.sign(value),
        `"${text}" lost its sign: ${parsed}`
      );
    });
  });

  test("accepted input never yields NaN / Infinity; spaces are ignored; sign is symmetric (5000 cases)", () => {
    forAll("parseAmount finite + sign", 5000, (g) => {
      const decimal = g.pick([",", "."] as const);
      const body = g.string("0123456789.,", g.int(0, 14));
      const parsed = parseAmount(body, decimal);
      assert(
        parsed === null || Number.isFinite(parsed),
        `"${body}" → ${parsed}`
      );
      // Spaces anywhere are grouping only.
      const at = g.int(0, body.length);
      const spaced = `${body.slice(0, at)} ${body.slice(at)}`;
      assert(
        Object.is(parseAmount(spaced, decimal), parsed),
        `"${spaced}" vs "${body}"`
      );
      // A leading minus negates (or keeps rejecting).
      const negative = parseAmount(`-${body}`, decimal);
      if (parsed === null) {
        assert(negative === null, `"-${body}" accepted but "${body}" not`);
      } else {
        assert(
          negative !== null && negative === -parsed,
          `"-${body}" → ${negative}, "${body}" → ${parsed}`
        );
      }
    });
  });

  test("garbage (letters, symbols, misplaced minus) is rejected (3000 cases)", () => {
    forAll("parseAmount garbage", 3000, (g) => {
      const decimal = g.pick([",", "."] as const);
      const digits = g.string("0123456789.,", g.int(0, 8));
      const junk = g.pick([
        "a",
        "e",
        "E",
        "x",
        "+",
        "-",
        "€",
        "$",
        "'",
        "_",
        "/",
        "%",
        "(",
        "Infinity",
        "NaN",
        "0x",
      ]);
      const at = g.int(0, digits.length);
      // A minus is only legal as the very first character.
      const text =
        junk === "-" && at === 0
          ? `${digits}-`
          : `${digits.slice(0, at)}${junk}${digits.slice(at)}`;
      expect([text, parseAmount(text, decimal)]).toEqual([text, null]);
    });
  });

  test("formatCurrency → parseAmount round-trips (rounded to the currency's decimals) (2000 cases)", () => {
    forAll("formatCurrency round-trip", 2000, (g) => {
      const currency = g.pick(currencies);
      const amount = (g.bool(0.2) ? -1 : 1) * g.float(0, 10 ** g.int(0, 9));
      const text = formatCurrency(amount, currency.code);
      const numeric = text.replace(LEADING_SPACE_SPLIT, "");
      const decimals = currency.zeroDecimals ? 0 : 2;
      const parsed = parseAmount(numeric, ".");
      const expected = Number(amount.toFixed(decimals));
      assert(
        parsed !== null && Math.abs(parsed - expected) < 1e-6,
        `${currency.code} "${text}" → ${parsed}, expected ${expected}`
      );
    });
  });
});

describe("convert: conversion properties", () => {
  const codes = currencies.map((c) => c.code);

  test("currency A→B→A ≈ identity, A→A = identity, linear (5000 cases)", () => {
    forAll("currency round-trip", 5000, (g) => {
      const amount = g.float(-1e9, 1e9);
      const a = g.pick(codes);
      const b = g.pick(codes);
      const there = convertCurrency(amount, a, b);
      assert(there !== null && Number.isFinite(there), `${a}→${b} null`);
      const back = convertCurrency(there, b, a);
      assert(back !== null, `${b}→${a} null`);
      const tol = 1e-9 * Math.max(1, Math.abs(amount));
      assert(
        Math.abs(back - amount) <= tol,
        `${amount} ${a}→${b}→${a} = ${back}`
      );
      const same = convertCurrency(amount, a.toLowerCase(), a);
      assert(same !== null && Math.abs(same - amount) <= tol, `${a}→${a}`);
      const other = g.float(-1e6, 1e6);
      const sum = convertCurrency(amount + other, a, b);
      const parts =
        (convertCurrency(amount, a, b) ?? 0) +
        (convertCurrency(other, a, b) ?? 0);
      assert(
        sum !== null &&
          Math.abs(sum - parts) <= 1e-6 * Math.max(1, Math.abs(sum)),
        `not linear: ${sum} vs ${parts}`
      );
    });
  });

  test("unknown codes and non-finite amounts give null (1000 cases)", () => {
    forAll("currency rejects", 1000, (g) => {
      const known = g.pick(codes);
      const unknown = `X${g.string("QZJ", 2)}`;
      expect(convertCurrency(g.float(-10, 10), unknown, known)).toBeNull();
      expect(convertCurrency(g.float(-10, 10), known, unknown)).toBeNull();
      expect(
        convertCurrency(
          g.pick([
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
          ]),
          known,
          known
        )
      ).toBeNull();
    });
  });

  test("units: metric→imperial→metric ≈ identity and strictly increasing (5000 cases)", () => {
    forAll("unit round-trip", 5000, (g) => {
      const kind = g.pick<UnitKind>(["temperature", "distance", "weight"]);
      const value = g.float(-1e6, 1e6);
      const imperial = convertUnit(value, kind, "metricToImperial");
      const back = convertUnit(imperial, kind, "imperialToMetric");
      const tol = 1e-9 * Math.max(1, Math.abs(value));
      assert(Math.abs(back - value) <= tol, `${kind} ${value} → ${back}`);
      const bigger = value + g.float(0.001, 100);
      assert(
        convertUnit(bigger, kind, "metricToImperial") > imperial,
        `${kind} not increasing at ${value}`
      );
    });
    // Fixed points as sanity anchors.
    expect(convertUnit(-40, "temperature", "metricToImperial")).toBe(-40);
    expect(convertUnit(100, "temperature", "metricToImperial")).toBe(212);
  });
});

// ---------------------------------------------------------------------------
// utils/timezone.ts
// ---------------------------------------------------------------------------

const zones: ZoneRef[] = destinations.map((d) => ({
  timezone: d.timezone,
  utcOffsetMinutes: d.utcOffsetMinutes,
}));

function randomZone(g: Gen): ZoneRef {
  if (g.bool(0.7)) {
    return g.pick(zones);
  }
  // Synthetic zone that only the offset fallback understands.
  return {
    timezone: g.pick(["Invalid/Zone", "Mars/Olympus"]),
    utcOffsetMinutes: g.int(-48, 56) * 15,
  };
}

const instant = (g: Gen) => g.int(Date.UTC(2020, 0, 1), Date.UTC(2032, 0, 1));

/** Independent oracle: Intl's own wall-clock "HH:MM" in `timezone`. */
function intlClock(atMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: timezone,
  }).formatToParts(new Date(atMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("hour")}:${get("minute")}`;
}

describe("timezone properties", () => {
  test("normalizeShiftHours lands in (-12, 12], stays ≡ input mod 24, is idempotent (5000 cases)", () => {
    forAll("normalizeShiftHours", 5000, (g) => {
      const hours = g.bool(0.5) ? g.int(-2000, 2000) / 2 : g.float(-1e4, 1e4);
      const out = normalizeShiftHours(hours);
      assert(out > -12 && out <= 12, `${hours} → ${out}`);
      const drift = (((out - hours) % 24) + 24) % 24;
      assert(
        Math.min(drift, 24 - drift) < 1e-6,
        `${hours} → ${out} not ≡ mod 24`
      );
      assert(normalizeShiftHours(out) === out, `not idempotent at ${hours}`);
    });
  });

  test("zone offsets are sane and wall clock matches Intl directly (2000 cases)", () => {
    forAll("zone clock", 2000, (g) => {
      const zone = g.pick(zones);
      const at = instant(g);
      const offset = getZoneOffsetMinutes(at, zone);
      assert(
        Number.isInteger(offset) && offset >= -720 && offset <= 840,
        `${zone.timezone} offset ${offset}`
      );
      assert(offset % 15 === 0, `${zone.timezone} offset ${offset} not /15`);
      const dst = offset - zone.utcOffsetMinutes;
      assert(
        // Morocco (Africa/Casablanca) observes "negative DST" in Ramadan.
        dst === 0 || dst === 60 || dst === -60,
        `${zone.timezone}: bundled standard offset ${zone.utcOffsetMinutes} vs Intl ${offset}`
      );
      expect(formatTimeInZone(at, zone)).toBe(intlClock(at, zone.timezone));
      // Fallback path agrees with Intl when fed the Intl offset.
      expect(
        formatTimeInZone(
          at,
          { ...zone, utcOffsetMinutes: offset },
          { useIntl: false }
        )
      ).toBe(intlClock(at, zone.timezone));
    });
  });

  test("offset fallback: +1 h moves the local hour by exactly 1 (mod 24); day offset ∈ {-1,0,1} (3000 cases)", () => {
    forAll("fallback clock", 3000, (g) => {
      const zone = randomZone(g);
      const at = instant(g);
      const opts = { useIntl: g.bool() };
      const h = getHourInZone(at, zone, opts);
      assert(Number.isInteger(h) && h >= 0 && h <= 23, `hour ${h}`);
      if (!opts.useIntl) {
        expect(getHourInZone(at + HOUR, zone, opts)).toBe((h + 1) % 24);
        const [hh, mm] = formatTimeInZone(at, zone, opts)
          .split(":")
          .map(Number);
        const shifted = new Date(at + zone.utcOffsetMinutes * MINUTE);
        expect([hh, mm]).toEqual([
          shifted.getUTCHours(),
          shifted.getUTCMinutes(),
        ]);
      }
      expect([-1, 0, 1]).toContain(
        getDayOffset(at, zone, at + g.int(-DAY, DAY), opts)
      );
    });
  });

  test("jet-lag plan invariants for random flights (5000 cases)", () => {
    forAll("jetlag plan", 5000, (g) => {
      const departureTime = instant(g);
      const duration = g.bool(0.1) ? g.int(0, 30) : g.int(30, 20 * 60);
      const arrival = departureTime + duration * MINUTE;
      const nowMs =
        departureTime + g.int(-2 * DAY, duration * MINUTE + 2 * DAY);
      const destination = randomZone(g);
      const opts = { useIntl: g.bool(0.6) };
      const homeOffsetMinutes = g.int(-48, 56) * 15;
      const plan = getJetlagPlan({
        departureTime,
        destination,
        duration,
        homeOffsetMinutes,
        nowMs,
        opts,
      });
      const abs = Math.abs(plan.shiftHours);
      assert(plan.shiftHours > -12 && plan.shiftHours <= 12, "shift range");
      assert(Number.isInteger(plan.shiftHours * 2), "shift not on 0.5 h");
      assert(
        Number.isInteger(plan.arrivalLocalHour) &&
          plan.arrivalLocalHour >= 0 &&
          plan.arrivalLocalHour <= 23,
        `arrival hour ${plan.arrivalLocalHour}`
      );
      expect(plan.arrivalLocalHour).toBe(
        getHourInZone(arrival, destination, opts)
      );
      let expectedDirection = "none";
      if (abs >= 2) {
        expectedDirection = plan.shiftHours > 0 ? "east" : "west";
      }
      expect(plan.direction).toBe(expectedDirection);
      let severity = "severe";
      if (abs < 2) {
        severity = "none";
      } else if (abs < 5) {
        severity = "mild";
      } else if (abs < 8) {
        severity = "moderate";
      }
      expect(plan.severity).toBe(severity);
      if (plan.direction === "none") {
        expect(plan.adviceKey).toBe("jetlagAdviceNone");
        expect(plan.sleepWindow).toBeNull();
      }
      const window = plan.sleepWindow;
      if (window) {
        const fromMs = Math.max(nowMs, departureTime);
        assert(window.startMs < window.endMs, "empty / inverted window");
        assert(window.startMs >= fromMs, "window starts before boarding/now");
        assert(window.endMs <= arrival, "window ends after landing");
        assert(window.endMs - window.startMs <= 4 * HOUR, "window > 4 h");
        expect(plan.adviceKey).not.toBe("jetlagAdviceStayAwake");
        const fireAt = getJetlagReminderFireAt(plan, nowMs);
        if (fireAt !== null) {
          expect(fireAt).toBe(window.startMs - 10 * MINUTE);
          assert(fireAt > nowMs + 2 * MINUTE, "reminder too soon");
        }
      } else {
        expect(getJetlagReminderFireAt(plan, nowMs)).toBeNull();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// utils/dates.ts
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` for a UTC day number (days since 1970-01-01). */
const keyOfDay = (day: number) =>
  new Date(day * DAY).toISOString().slice(0, 10);

/**
 * A Date whose calendar fields are the wall clock in `timezone` (Jest can't
 * switch the process zone at runtime) — getDayOfYear only reads those.
 */
function zonedDate(atMs: number, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(atMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    getDate: () => get("day"),
    getFullYear: () => get("year"),
    getMonth: () => get("month") - 1,
    getTime: () => atMs,
  } as Date;
}

describe("dates properties", () => {
  test("dateKeyDiffDays is antisymmetric, zero on the diagonal, additive, exact (5000 cases)", () => {
    forAll("dateKeyDiffDays", 5000, (g) => {
      const a = g.int(0, 60_000);
      const b = g.int(0, 60_000);
      const c = g.int(0, 60_000);
      const [ka, kb, kc] = [keyOfDay(a), keyOfDay(b), keyOfDay(c)];
      const ab = dateKeyDiffDays(ka, kb);
      assert(ab === b - a, `${ka}→${kb} = ${ab}, expected ${b - a}`);
      assert(dateKeyDiffDays(kb, ka) === -ab, "not antisymmetric");
      assert(dateKeyDiffDays(ka, ka) === 0, "diagonal not 0");
      assert(
        ab + dateKeyDiffDays(kb, kc) === dateKeyDiffDays(ka, kc),
        "not additive"
      );
    });
  });

  test("addDays + toLocalDateKey agree with dateKeyDiffDays in the runner's zone (3000 cases)", () => {
    forAll("addDays diff", 3000, (g) => {
      const start = new Date(instant(g));
      const n = g.int(-800, 800);
      const moved = addDays(start, n);
      expect(
        dateKeyDiffDays(toLocalDateKey(start), toLocalDateKey(moved))
      ).toBe(n);
      // Wall-clock time of day survives the shift.
      expect([moved.getHours(), moved.getMinutes()]).toEqual([
        start.getHours(),
        start.getMinutes(),
      ]);
    });
  });

  test("getDayOfYear ∈ 1..366 and steps +1 per local day (wraps to 1 on Jan 1) (3000 cases)", () => {
    forAll("getDayOfYear step", 3000, (g) => {
      const d = new Date(instant(g));
      const doy = getDayOfYear(d);
      const next = addDays(d, 1);
      assert(doy >= 1 && doy <= 366, `doy ${doy}`);
      const expected = next.getFullYear() === d.getFullYear() ? doy + 1 : 1;
      expect(getDayOfYear(next)).toBe(expected);
    });
  });

  test("getDayOfYear in DST zones matches the zone's calendar at every instant (3000 cases)", () => {
    const dstZones = [
      "Europe/Prague",
      "America/New_York",
      "Australia/Sydney",
      "America/Santiago",
      "Pacific/Auckland",
    ];
    forAll("getDayOfYear DST", 3000, (g) => {
      const tz = g.pick(dstZones);
      const at = instant(g);
      const d = zonedDate(at, tz);
      const y = d.getFullYear();
      const oracle =
        (Date.UTC(y, d.getMonth(), d.getDate()) - Date.UTC(y, 0, 1)) / DAY + 1;
      expect(getDayOfYear(d)).toBe(oracle);
      // 24 h later the day advanced by 0..2 (23/25 h days), modulo year wrap.
      const later = zonedDate(at + DAY, tz);
      const step = getDayOfYear(later) - getDayOfYear(d);
      const wrapped = later.getFullYear() !== y;
      assert(wrapped || (step >= 0 && step <= 2), `step ${step} in ${tz}`);
    });
  });

  test("nextStreakState over random open sequences (2000 sequences)", () => {
    forAll("streak sequence", 2000, (g) => {
      let state: StreakState = { lastActiveDate: null, streakDays: 0 };
      let day = g.int(19_000, 22_000);
      let offset = g.int(-48, 56) * 15;
      let distinctDays = 0;
      const steps = g.int(1, 40);
      for (let i = 0; i < steps; i += 1) {
        const jump = g.pick([-1, 0, 0, 1, 1, 1, 1, 2, 2, 3, 7]);
        day += jump;
        if (g.bool(0.2)) {
          offset = g.int(-48, 56) * 15;
        }
        const today = keyOfDay(day);
        const prev = state;
        state = nextStreakState(prev, today, offset);
        assert(state.streakDays >= 1, "streak below 1 after an open");
        assert(state.lastActiveOffsetMinutes === offset, "offset not stored");
        if (prev.lastActiveDate && prev.lastActiveDate >= today) {
          // Same day / west over the date line: unchanged.
          assert(
            state.streakDays === prev.streakDays &&
              state.lastActiveDate === prev.lastActiveDate,
            `${today} after ${prev.lastActiveDate} changed the streak`
          );
          continue;
        }
        distinctDays += 1;
        assert(state.lastActiveDate === today, "lastActiveDate not moved");
        const gap = prev.lastActiveDate
          ? dateKeyDiffDays(prev.lastActiveDate, today)
          : Number.NaN;
        const eastJump =
          gap === 2 &&
          typeof prev.lastActiveOffsetMinutes === "number" &&
          offset - prev.lastActiveOffsetMinutes >= 600;
        const expected = gap === 1 || eastJump ? prev.streakDays + 1 : 1;
        assert(
          state.streakDays === expected,
          `gap ${gap}: streak ${state.streakDays}, expected ${expected}`
        );
        assert(
          state.streakDays <= distinctDays,
          `streak ${state.streakDays} > ${distinctDays} active days`
        );
      }
    });
  });
});
