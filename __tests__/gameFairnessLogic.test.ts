import {
  buildMatchDeck,
  clampScore,
  responseDelta,
} from "@/games/color-clash/logic";
import {
  codeBreakerRounds,
  firstGuesser,
  MIN_ROUNDS,
} from "@/games/cross-code-breaker/logic";
import { diceStanding, diceStandings, ROUNDS } from "@/games/duel-dice/logic";
import { applyBulletHit } from "@/games/sky-defense/logic";
import { getSoleWinnerIndex, rankStandings } from "@/utils/multiplayerScoring";
import { shuffle } from "@/utils/shuffle";

describe("shuffle (Fisher–Yates)", () => {
  it("returns a permutation and leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["x"])).toEqual(["x"]);
  });

  it("places every element in every slot about equally often", () => {
    // Deterministic LCG so the test never flakes.
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const n = 4;
    const trials = 24_000;
    const counts = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let t = 0; t < trials; t += 1) {
      const out = shuffle([0, 1, 2, 3], random);
      out.forEach((value, slot) => {
        counts[value][slot] += 1;
      });
    }
    const expected = trials / n;
    for (const row of counts) {
      for (const c of row) {
        // Loose bound (±8 %); the biased sort shuffle misses this by far.
        expect(Math.abs(c - expected)).toBeLessThan(expected * 0.08);
      }
    }
  });
});

describe("duel-dice ranking", () => {
  it("round wins always beat total pips", () => {
    // Old formula (wins*10 + total) crowned seat 0: 3*10+40 = 70 > 4*10+25 = 65.
    const standings = diceStandings([3, 4], [40, 25]);
    expect(getSoleWinnerIndex(standings)).toBe(1);
  });

  it("even the max pip total cannot outweigh one extra round win", () => {
    const maxPips = ROUNDS * 6;
    expect(diceStanding(1, 0).score).toBeGreaterThan(
      diceStanding(0, maxPips).score
    );
  });

  it("total pips break ties in wins; a full tie is a draw", () => {
    expect(getSoleWinnerIndex(diceStandings([4, 4], [30, 31]))).toBe(1);
    expect(getSoleWinnerIndex(diceStandings([4, 4], [30, 30]))).toBeNull();
    const ranked = rankStandings(diceStandings([2, 5, 5], [50, 20, 22]));
    expect(ranked.map((r) => r.index)).toEqual([2, 1, 0]);
  });
});

describe("sky-defense bullet hits", () => {
  it("grants the reward once, on the alive → dead transition only", () => {
    const enemy = { hp: 30, reward: 5 };
    // Three bullets land on the same enemy in one tick.
    const total =
      applyBulletHit(enemy, 20) +
      applyBulletHit(enemy, 20) +
      applyBulletHit(enemy, 20);
    expect(total).toBe(5);
    expect(enemy.hp).toBe(-10);
  });

  it("grants nothing for non-lethal hits or hits on a dead enemy", () => {
    const enemy = { hp: 60, reward: 10 };
    expect(applyBulletHit(enemy, 20)).toBe(0);
    expect(applyBulletHit(enemy, 40)).toBe(10);
    expect(applyBulletHit(enemy, 40)).toBe(0);
  });
});

describe("color-clash scoring", () => {
  it("deals exactly half matches", () => {
    for (let i = 0; i < 20; i += 1) {
      const deck = buildMatchDeck(20);
      expect(deck).toHaveLength(20);
      expect(deck.filter(Boolean)).toHaveLength(10);
    }
  });

  it("idling or tapping everything nets zero; perfect play scores every round", () => {
    const deck = buildMatchDeck(20);
    const play = (respond: (isMatch: boolean) => "tap" | "skip") =>
      clampScore(
        deck.reduce(
          (sum, isMatch) => sum + responseDelta(isMatch, respond(isMatch)),
          0
        )
      );
    expect(play(() => "skip")).toBe(0);
    expect(play(() => "tap")).toBe(0);
    expect(play((isMatch) => (isMatch ? "tap" : "skip"))).toBe(20);
    expect(play((isMatch) => (isMatch ? "skip" : "tap"))).toBe(0);
  });
});

describe("code breaker first-guesser rotation", () => {
  it.each([2, 3, 4, 5, 6])(
    "%i players: everyone guesses first equally often, at least 3 rounds",
    (players) => {
      const rounds = codeBreakerRounds(players);
      expect(rounds).toBeGreaterThanOrEqual(MIN_ROUNDS);
      const opens = new Array(players).fill(0);
      for (let round = 1; round <= rounds; round += 1) {
        opens[firstGuesser(round, players)] += 1;
      }
      expect(new Set(opens).size).toBe(1);
    }
  );
});
