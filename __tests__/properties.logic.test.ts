/**
 * Property-based tests: flight passport / phase / progress, shuffle,
 * multiplayer scoring, small game rule helpers and the content-feed parser.
 * Seeded random inputs; a failure prints the seed (helpers/property.ts).
 */
import { destinations } from "@/data/destinations";
import {
  codeBreakerRounds,
  firstGuesser,
  MIN_ROUNDS,
} from "@/games/cross-code-breaker/logic";
import { diceStandings, ROUNDS } from "@/games/duel-dice/logic";
import {
  baseLetter,
  countWrong,
  isRevealed,
  isSolved,
  wordHasLetter,
} from "@/games/duel-hangman/logic";
import { getWordPool } from "@/games/duel-hangman/words";
import { supportedLanguages } from "@/i18n/translations";
import {
  getElapsedMinutes,
  getFlightProgress,
  getRemainingMinutes,
} from "@/store/useFlightStore";
import { useGameStore } from "@/store/useGameStore";
import type { Flight, LoggedFlight } from "@/types/flight";
import { isContentItem, parseContentFeed } from "@/utils/contentSync";
import {
  type FlightPhase,
  getCurrentFlight,
  getFlightPhase,
  LANDED_WINDOW_MS,
} from "@/utils/flightPhase";
import {
  BEST_RUN_KEY,
  getSoleWinnerIndex,
  HOSTED_KEY,
  rankStandings,
  recordMatch,
  type Standing,
} from "@/utils/multiplayerScoring";
import { getPassportSummary, upsertLoggedFlight } from "@/utils/passport";
import { shuffle } from "@/utils/shuffle";

import { assert, forAll, type Gen } from "./helpers/property";

const MINUTE = 60_000;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 26, 12);

// ---------------------------------------------------------------------------
// Passport
// ---------------------------------------------------------------------------

const destinationIds = destinations.map((d) => d.id);

function randomLog(g: Gen, prefix: string, count: number): LoggedFlight[] {
  return Array.from({ length: count }, (_, i) => {
    let duration = g.int(0, 20 * 60);
    if (g.bool(0.1)) {
      duration = g.pick([
        -g.int(1, 500),
        Number.NaN,
        Number.NEGATIVE_INFINITY,
        g.float(0, 300),
      ]);
    }
    const flight: LoggedFlight = {
      departureTime: NOW + g.int(-400 * DAY, 30 * DAY),
      duration,
      id: `${prefix}${i}`,
    };
    if (g.bool(0.7)) {
      flight.destinationId = g.bool(0.9) ? g.pick(destinationIds) : "nowhere";
    }
    return flight;
  });
}

describe("passport properties", () => {
  test("totals are finite, non-negative, bounded and consistent (3000 cases)", () => {
    forAll("passport totals", 3000, (g) => {
      const log = randomLog(g, "f", g.int(0, 25));
      const now = NOW + g.int(-30 * DAY, 30 * DAY);
      const s = getPassportSummary(log, now);
      assert(
        Number.isFinite(s.minutesInAir) && s.minutesInAir >= 0,
        `minutesInAir ${s.minutesInAir}`
      );
      assert(
        Number.isInteger(s.minutesInAir) ||
          log.some((f) => !Number.isInteger(f.duration)),
        "fractional minutes from integer durations"
      );
      const departed = log.filter((f) => f.departureTime <= now);
      assert(s.flights === departed.length, "flights ≠ departed count");
      assert(s.stamps.length === s.flights, "stamps ≠ flights");
      assert(
        s.countries <= s.cities && s.cities <= s.flights,
        "cities/countries bound"
      );
      for (let i = 1; i < s.stamps.length; i += 1) {
        assert(
          s.stamps[i - 1].departureTime >= s.stamps[i].departureTime,
          "stamps not newest first"
        );
      }
      const cap = departed.reduce(
        (sum, f) =>
          sum +
          (Number.isFinite(f.duration) && f.duration > 0 ? f.duration : 0),
        0
      );
      assert(s.minutesInAir <= cap, `minutesInAir ${s.minutesInAir} > ${cap}`);
    });
  });

  // Formerly a KNOWN BUG (fixed in review round 8): `Math.min(Infinity,
  // elapsed)` counted every minute since departure for a duration of
  // Infinity. Unreachable from the edit screen (steppers clamp to 24 h) and
  // from JSON persistence (Infinity → null), so defensive only.
  test("a flight with duration Infinity counts 0 minutes (documented corrupt-duration guard)", () => {
    const log: LoggedFlight[] = [
      {
        departureTime: NOW - 10 * DAY,
        duration: Number.POSITIVE_INFINITY,
        id: "x",
      },
    ];
    expect(getPassportSummary(log, NOW).minutesInAir).toBe(0);
  });

  test("totals are additive over disjoint logs and monotone in time (3000 cases)", () => {
    forAll("passport additive", 3000, (g) => {
      const a = randomLog(g, "a", g.int(0, 12));
      const b = randomLog(g, "b", g.int(0, 12));
      const now = NOW + g.int(-30 * DAY, 30 * DAY);
      const sa = getPassportSummary(a, now);
      const sb = getPassportSummary(b, now);
      const sab = getPassportSummary([...a, ...b], now);
      assert(sab.flights === sa.flights + sb.flights, "flights not additive");
      assert(
        Math.abs(sab.minutesInAir - (sa.minutesInAir + sb.minutesInAir)) < 1e-9,
        "minutes not additive"
      );
      assert(sab.cities <= sa.cities + sb.cities, "cities superadditive");
      const later = getPassportSummary([...a, ...b], now + g.int(0, 5 * DAY));
      assert(later.minutesInAir >= sab.minutesInAir, "minutes went down");
      assert(later.flights >= sab.flights, "flights went down");
    });
  });

  test("random upserts keep ids unique and the last write per id (3000 cases)", () => {
    forAll("passport upsert", 3000, (g) => {
      let log: LoggedFlight[] = [];
      const last = new Map<string, LoggedFlight>();
      const ops = g.int(1, 30);
      for (let i = 0; i < ops; i += 1) {
        const flight: LoggedFlight = {
          departureTime: NOW + g.int(-DAY, DAY),
          duration: g.int(1, 900),
          id: `id${g.int(0, 6)}`,
          ...(g.bool() ? { destinationId: g.pick(destinationIds) } : {}),
        };
        const before = log.length;
        log = upsertLoggedFlight(log, flight);
        assert(
          log.length === before + (last.has(flight.id) ? 0 : 1),
          "length changed wrongly"
        );
        last.set(flight.id, flight);
      }
      assert(new Set(log.map((f) => f.id)).size === log.length, "duplicate id");
      assert(log.length === last.size, "lost an id");
      for (const f of log) {
        assert(
          JSON.stringify(f) === JSON.stringify(last.get(f.id)),
          `entry ${f.id} is not the last write`
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Flight phase + progress
// ---------------------------------------------------------------------------

const PHASE_RANK: Record<FlightPhase, number> = {
  inflight: 1,
  landed: 2,
  none: 3,
  preflight: 0,
};

function randomFlight(g: Gen): Flight {
  return {
    departureTime: NOW + g.int(-5 * DAY, 5 * DAY),
    duration: g.bool(0.05) ? 0 : g.int(1, 22 * 60),
    id: "f",
  };
}

describe("flight phase + progress properties", () => {
  test("phase is monotone in time: preflight → inflight → landed → none (2000 flights × 30 instants)", () => {
    forAll("phase monotone", 2000, (g) => {
      const flight = randomFlight(g);
      const arrival = flight.departureTime + flight.duration * MINUTE;
      const times = Array.from({ length: 30 }, () =>
        g.bool(0.2)
          ? g.pick([
              flight.departureTime - 1,
              flight.departureTime,
              arrival - 1,
              arrival,
              arrival + LANDED_WINDOW_MS - 1,
              arrival + LANDED_WINDOW_MS,
            ])
          : flight.departureTime + g.int(-3 * DAY, 5 * DAY)
      ).sort((x, y) => x - y);
      let rank = -1;
      for (const t of times) {
        const phase = getFlightPhase(flight, t);
        const r = PHASE_RANK[phase];
        assert(r >= rank, `phase went back to ${phase} at ${t}`);
        rank = r;
        // Phase agrees with the definition.
        let expected: FlightPhase = "none";
        if (t < flight.departureTime) {
          expected = "preflight";
        } else if (t < arrival) {
          expected = "inflight";
        } else if (t - arrival < LANDED_WINDOW_MS) {
          expected = "landed";
        }
        assert(phase === expected, `${phase} ≠ ${expected}`);
        assert(
          (getCurrentFlight(flight, t) === null) === (phase === "none"),
          "getCurrentFlight disagrees with phase"
        );
      }
      assert(getFlightPhase(null, NOW) === "none", "null flight");
    });
  });

  test("progress ∈ [0,1], monotone; elapsed + remaining = duration; consistent with phase (5000 cases)", () => {
    forAll("progress", 5000, (g) => {
      const flight = randomFlight(g);
      const t = flight.departureTime + g.int(-DAY, 2 * DAY);
      const t2 = t + g.int(0, DAY);
      const p = getFlightProgress(flight, t);
      const elapsed = getElapsedMinutes(flight, t);
      const remaining = getRemainingMinutes(flight, t);
      assert(p >= 0 && p <= 1, `progress ${p}`);
      assert(getFlightProgress(flight, t2) >= p, "progress went down");
      assert(elapsed >= 0 && elapsed <= flight.duration, `elapsed ${elapsed}`);
      assert(remaining >= 0, `remaining ${remaining}`);
      assert(
        Math.abs(elapsed + remaining - flight.duration) < 1e-9,
        `${elapsed} + ${remaining} ≠ ${flight.duration}`
      );
      const phase = getFlightPhase(flight, t);
      if (phase === "preflight") {
        assert(p === 0 && elapsed === 0, "progress before departure");
      }
      if (phase === "inflight") {
        assert(p < 1 && remaining > 0, "finished while in flight");
      }
      if (phase === "landed" && flight.duration > 0) {
        assert(p === 1 && remaining === 0, "not finished after landing");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// shuffle
// ---------------------------------------------------------------------------

describe("shuffle properties", () => {
  test("returns a permutation, never mutates the input, survives rng → 1⁻ (3000 cases)", () => {
    forAll("shuffle permutation", 3000, (g) => {
      const items = Array.from({ length: g.int(0, 40) }, () => g.int(0, 9));
      const copy = [...items];
      const edge = g.bool(0.1);
      const rng = edge ? () => 1 - Number.EPSILON / 2 : g.rng;
      const out = shuffle(items, rng);
      expect(items).toEqual(copy);
      assert(out !== items, "returned the input array");
      expect([...out].sort()).toEqual([...items].sort());
    });
  });

  test("all 24 orders of 4 items are (roughly) equally likely", () => {
    const counts = new Map<string, number>();
    forAll("shuffle uniform", 1, (g) => {
      for (let i = 0; i < 24_000; i += 1) {
        const key = shuffle([0, 1, 2, 3], g.rng).join("");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    });
    expect(counts.size).toBe(24);
    for (const n of counts.values()) {
      // Expected 1000 each; ±20 % is > 6σ.
      expect(n).toBeGreaterThan(800);
      expect(n).toBeLessThan(1200);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiplayer scoring
// ---------------------------------------------------------------------------

function randomStandings(g: Gen): Standing[] {
  const n = g.int(1, 6);
  const withTiebreak = g.bool(0.4);
  return Array.from({ length: n }, () => ({
    score: g.int(-2, 4),
    ...(withTiebreak && g.bool(0.8) ? { tiebreak: g.int(0, 2) } : {}),
  }));
}

const better = (a: Standing, b: Standing) =>
  a.score > b.score ||
  (a.score === b.score && (a.tiebreak ?? 0) > (b.tiebreak ?? 0));

describe("multiplayer scoring properties", () => {
  test("rankStandings = competition ranking by (score, tiebreak) (5000 cases)", () => {
    forAll("rankStandings", 5000, (g) => {
      const standings = randomStandings(g);
      const ranked = rankStandings(standings);
      expect(ranked.map((r) => r.index).sort()).toEqual(
        standings.map((_, i) => i)
      );
      for (const r of ranked) {
        const self = standings[r.index];
        const strictlyBetter = standings.filter((s) => better(s, self)).length;
        assert(
          r.rank === 1 + strictlyBetter,
          `rank ${r.rank} ≠ 1 + ${strictlyBetter}`
        );
        assert(r.score === self.score, "standing data lost");
      }
      for (let i = 1; i < ranked.length; i += 1) {
        assert(ranked[i - 1].rank <= ranked[i].rank, "ranks not sorted");
      }
      const leaders = standings
        .map((_, i) => i)
        .filter((i) => !standings.some((s) => better(s, standings[i])));
      expect(getSoleWinnerIndex(standings)).toBe(
        leaders.length === 1 ? leaders[0] : null
      );
    });
    expect(getSoleWinnerIndex([])).toBeNull();
  });

  test("recordMatch: won iff the host is the sole winner; host counters match a brute-force replay (400 match series)", () => {
    forAll("recordMatch series", 400, (g) => {
      const gameId = g.pick(["duel-dice", "duel-connect4", "duel-hangman"]);
      useGameStore.setState({ progress: {} });
      const matches = g.int(1, 12);
      let run = 0;
      let bestRun = 0;
      let best = 0;
      for (let m = 0; m < matches; m += 1) {
        const standings = randomStandings(g);
        const hostIndex = g.bool(0.8) ? 0 : g.int(0, standings.length - 1);
        const bonusIfWon = g.bool(0.3) ? g.int(1, 50) : undefined;
        const won = getSoleWinnerIndex(standings) === hostIndex;
        const result = recordMatch(gameId, standings, {
          bonusIfWon,
          hostIndex,
        });
        const expectedScore =
          Math.max(0, Math.round(standings[hostIndex].score)) +
          (won ? (bonusIfWon ?? 0) : 0);
        run = won ? run + 1 : 0;
        bestRun = Math.max(bestRun, run);
        best = Math.max(best, expectedScore);
        assert(
          result.last === expectedScore,
          `score ${result.last} ≠ ${expectedScore}`
        );
        assert(
          result.currentStreak === run,
          `streak ${result.currentStreak} ≠ ${run}`
        );
        assert(result.best === best, "highScore");
        const p = useGameStore.getState().progress[gameId];
        assert(p.levelStars?.[HOSTED_KEY] === m + 1, "mp:hosted");
        assert(
          p.levelStars?.[BEST_RUN_KEY] === bestRun,
          `mp:bestRun ${p.levelStars?.[BEST_RUN_KEY]} ≠ ${bestRun}`
        );
        assert(p.bestStreak === bestRun, "bestStreak");
      }
    });
    useGameStore.setState({ progress: {} });
  });

  test("duel-dice standings: round wins always dominate, pips only break ties (5000 cases)", () => {
    forAll("dice standings", 5000, (g) => {
      const n = g.int(2, 6);
      const wins = Array.from({ length: n }, () => g.int(0, ROUNDS));
      const totals = Array.from({ length: n }, () => g.int(0, ROUNDS * 6));
      const s = diceStandings(wins, totals);
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          const lexi =
            wins[i] > wins[j] || (wins[i] === wins[j] && totals[i] > totals[j]);
          assert(lexi === s[i].score > s[j].score, `seats ${i}/${j}`);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Small game rules
// ---------------------------------------------------------------------------

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORD_CHARS = `${LETTERS}ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽÄÖÜ`;

describe("hangman properties", () => {
  test("isSolved iff every letter's base form was guessed, incl. diacritics (5000 cases)", () => {
    forAll("hangman solved", 5000, (g) => {
      const word = g.string(WORD_CHARS, g.int(1, 12));
      const guessed = new Set(
        [...LETTERS].filter(() => g.bool(g.pick([0.2, 0.6, 0.95])))
      );
      for (const ch of word) {
        assert(LETTERS.includes(baseLetter(ch)), `${ch} has no A–Z key`);
        assert(wordHasLetter(word, baseLetter(ch)), "letter not in word");
      }
      const brute = [...word].every((ch) => guessed.has(baseLetter(ch)));
      assert(isSolved(word, guessed) === brute, `isSolved(${word})`);
      assert(
        [...word].every(
          (ch) => isRevealed(ch, guessed) === guessed.has(baseLetter(ch))
        ),
        "isRevealed"
      );
      const wrong = [...guessed].filter(
        (l) => ![...word].some((ch) => baseLetter(ch) === l)
      ).length;
      assert(countWrong(word, guessed) === wrong, "countWrong");
      // Guessing the whole keyboard solves any word with zero misses on its letters.
      assert(isSolved(word, new Set(LETTERS)), "full keyboard does not solve");
    });
    expect(isSolved("", new Set(LETTERS))).toBe(false);
  });

  test("every bundled hangman word is solvable with the A–Z keyboard", () => {
    const keyboard = new Set(LETTERS);
    const unsolvable: string[] = [];
    for (const { code: lang } of supportedLanguages) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        for (const word of getWordPool(lang, difficulty)) {
          if (!isSolved(word, keyboard)) {
            unsolvable.push(`${lang}:${word}`);
          }
        }
      }
    }
    expect(unsolvable).toEqual([]);
  });
});

describe("code-breaker match length properties", () => {
  test("rounds are the smallest multiple of the player count ≥ MIN_ROUNDS; every seat opens equally often", () => {
    for (let players = 1; players <= 12; players += 1) {
      const rounds = codeBreakerRounds(players);
      expect(rounds % players).toBe(0);
      expect(rounds).toBeGreaterThanOrEqual(MIN_ROUNDS);
      expect(rounds - players).toBeLessThan(MIN_ROUNDS);
      const opens = new Array(players).fill(0);
      for (let round = 1; round <= rounds; round += 1) {
        opens[firstGuesser(round, players)] += 1;
      }
      expect(new Set(opens).size).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Content feed parser
// ---------------------------------------------------------------------------

const FEED_KEYS = [
  "id",
  "readTime",
  "title",
  "category",
  "body",
  "image",
  "en",
  "cs",
  "version",
  "items",
];

/** Random JSON value biased towards almost-valid feed shapes. */
function jsonish(g: Gen, depth: number): unknown {
  const roll = g.int(0, depth <= 0 ? 4 : 7);
  switch (roll) {
    case 0:
      return null;
    case 1:
      return g.pick([0, -1, 1, 2.5, 1e9]);
    case 2:
      return g.pick(["", " ", "x", "1", "en", "v2"]);
    case 3:
      return g.bool();
    case 4:
      return g.pick([{}, []]);
    case 5:
      return Array.from({ length: g.int(0, 4) }, () => jsonish(g, depth - 1));
    case 6:
      return almostItem(g, depth);
    default: {
      const obj: Record<string, unknown> = {};
      for (let i = g.int(0, 4); i > 0; i -= 1) {
        obj[g.pick(FEED_KEYS)] = jsonish(g, depth - 1);
      }
      return obj;
    }
  }
}

function almostItem(g: Gen, depth: number): Record<string, unknown> {
  const text = () =>
    g.bool(0.8)
      ? { cs: "x", en: g.pick(["Title", " ", ""]) }
      : jsonish(g, depth - 1);
  const item: Record<string, unknown> = {
    body: text(),
    category: text(),
    id: g.bool(0.9) ? `a${g.int(0, 9)}` : jsonish(g, 0),
    readTime: g.bool(0.85) ? g.int(-1, 9) : jsonish(g, 0),
    title: text(),
  };
  if (g.bool(0.3)) {
    item.image = g.bool(0.7) ? "https://x/y.png" : jsonish(g, 0);
  }
  if (g.bool(0.2)) {
    delete item[g.pick(Object.keys(item))];
  }
  return item;
}

describe("content feed parser properties", () => {
  test("isContentItem never throws on arbitrary JSON (5000 cases)", () => {
    forAll("isContentItem total", 5000, (g) => {
      const value = JSON.parse(JSON.stringify(jsonish(g, 3) ?? null));
      expect(typeof isContentItem(value)).toBe("boolean");
    });
    expect(isContentItem(undefined)).toBe(false);
  });

  test("parseContentFeed: malformed tops throw a plain Error, valid tops never throw and keep exactly the valid items (5000 cases)", () => {
    forAll("parseContentFeed", 5000, (g) => {
      const feed: Record<string, unknown> = g.bool(0.75)
        ? {
            items: g.bool(0.9)
              ? Array.from({ length: g.int(0, 8) }, () =>
                  g.bool(0.6) ? almostItem(g, 2) : jsonish(g, 2)
                )
              : jsonish(g, 1),
            version: g.bool(0.9) ? g.pick(["1", "2", "v3"]) : jsonish(g, 0),
          }
        : ((jsonish(g, 2) ?? {}) as Record<string, unknown>);
      const top = JSON.parse(JSON.stringify(feed));
      const current = g.pick([null, "1", "2"]);
      const wellFormed =
        typeof top.version === "string" && Array.isArray(top.items);
      if (!wellFormed) {
        expect(() => parseContentFeed(top, current)).toThrow(
          "Content feed is malformed"
        );
        return;
      }
      const result = parseContentFeed(top, current);
      if (current === top.version) {
        expect(result).toBeNull();
        return;
      }
      assert(result !== null, "null for a new version");
      expect(result.version).toBe(top.version);
      expect(result.items).toEqual(top.items.filter(isContentItem));
      for (const item of result.items) {
        assert(isContentItem(item), "invalid item kept");
        assert(
          item.readTime > 0 && item.title.en.trim() !== "",
          "weak validation"
        );
      }
    });
  });
});
