import { calculateScore, checkMatch, createDeck } from "@/games/memory/logic";

describe("memory createDeck", () => {
  test("deals every emoji exactly twice, face down, with unique ids", () => {
    for (const pairs of [2, 6, 8, 12]) {
      const deck = createDeck(pairs);
      expect(deck).toHaveLength(pairs * 2);
      expect(new Set(deck.map((c) => c.id)).size).toBe(pairs * 2);
      const counts = new Map<string, number>();
      for (const card of deck) {
        counts.set(card.emoji, (counts.get(card.emoji) ?? 0) + 1);
        expect(card.isFlipped).toBe(false);
        expect(card.isMatched).toBe(false);
      }
      expect(counts.size).toBe(pairs);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    }
  });

  test("ids are the card positions so lookups by id are stable", () => {
    const deck = createDeck();
    expect(deck.map((c) => c.id)).toEqual(deck.map((_, i) => i));
  });

  test("the shuffle actually moves cards (not always the sorted order)", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      // rng 0 → every swap takes j = 0, which must change the sorted order.
      const deck = createDeck(3);
      const sorted = ["✈️", "🧳", "🛫", "✈️", "🧳", "🛫"];
      expect(deck.map((c) => c.emoji)).not.toEqual(sorted);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("memory checkMatch", () => {
  const deck = [
    { emoji: "A", id: 0, isFlipped: false, isMatched: false },
    { emoji: "B", id: 1, isFlipped: false, isMatched: false },
    { emoji: "A", id: 2, isFlipped: false, isMatched: false },
  ];

  test("same emoji matches, different emoji does not", () => {
    expect(checkMatch(deck, 0, 2)).toBe(true);
    expect(checkMatch(deck, 0, 1)).toBe(false);
  });

  test("unknown ids never match", () => {
    expect(checkMatch(deck, 0, 99)).toBe(false);
    expect(checkMatch(deck, 99, 0)).toBe(false);
    expect(checkMatch(deck, 98, 99)).toBe(false);
  });
});

describe("memory calculateScore", () => {
  test("a perfect game scores 100 per pair", () => {
    expect(calculateScore(6, 6)).toBe(600);
    // Fewer moves than pairs can't happen, but must not exceed perfect.
    expect(calculateScore(3, 6)).toBe(600);
  });

  test("each extra move costs 10 points", () => {
    expect(calculateScore(7, 6)).toBe(590);
    expect(calculateScore(16, 6)).toBe(500);
  });

  test("never goes negative", () => {
    expect(calculateScore(1000, 6)).toBe(0);
  });
});
