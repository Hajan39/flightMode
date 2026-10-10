import {
  type Board,
  canMatch,
  deal,
  FACES,
  finalScore,
  findPairs,
  isFree,
  LAYOUT_IDS,
  LAYOUTS,
  type Rng,
  removePair,
  shuffleBoard,
} from "@/games/mahjong/logic";

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = Math.trunc(a + 0x6d_2b_79_f5);
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const byId = (board: Board, id: number) => {
  const tile = board.find((t) => t.id === id);
  if (!tile) {
    throw new Error(`tile ${id} missing`);
  }
  return tile;
};

describe("mahjong layouts", () => {
  test.each(LAYOUT_IDS)("%s has an even tile count and no overlaps", (id) => {
    const slots = LAYOUTS[id];
    expect(slots.length % 2).toBe(0);
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const a = slots[i];
        const b = slots[j];
        const overlap =
          a.z === b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
        expect(overlap).toBe(false);
      }
    }
  });

  test("tile counts match the menu", () => {
    expect(LAYOUTS.easy).toHaveLength(48);
    expect(LAYOUTS.turtle).toHaveLength(84);
    expect(LAYOUTS.jet).toHaveLength(78);
  });
});

describe("isFree", () => {
  const row = [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ];

  test("ends of a row are free, the middle is not", () => {
    expect(isFree(row, row[0])).toBe(true);
    expect(isFree(row, row[1])).toBe(false);
    expect(isFree(row, row[2])).toBe(true);
  });

  test("a tile on top blocks the tiles it overlaps, even half-offset", () => {
    const top = { x: 1, y: 0, z: 1 };
    const tiles = [...row, top];
    expect(isFree(tiles, row[0])).toBe(false);
    expect(isFree(tiles, row[1])).toBe(false);
    expect(isFree(tiles, row[2])).toBe(true);
    expect(isFree(tiles, top)).toBe(true);
  });
});

describe("deal", () => {
  test.each(LAYOUT_IDS)("%s deals are solvable by their own solution", (id) => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const { board, solution } = deal(LAYOUTS[id], seeded(seed));
      expect(board).toHaveLength(LAYOUTS[id].length);
      let current = board;
      for (const [a, b] of solution) {
        expect(canMatch(current, byId(current, a), byId(current, b))).toBe(
          true
        );
        current = removePair(current, a, b);
      }
      expect(current).toHaveLength(0);
    }
  });

  test("faces appear 4 times, at most one face only twice", () => {
    const { board } = deal(LAYOUTS.turtle, seeded(7));
    const counts = new Map<number, number>();
    for (const t of board) {
      expect(t.face).toBeGreaterThanOrEqual(0);
      expect(t.face).toBeLessThan(FACES.length);
      counts.set(t.face, (counts.get(t.face) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(values.every((n) => n === 4 || n === 2)).toBe(true);
    expect(values.filter((n) => n === 2).length).toBeLessThanOrEqual(1);
  });

  test("a fresh deal always has a move", () => {
    for (const id of LAYOUT_IDS) {
      expect(
        findPairs(deal(LAYOUTS[id], seeded(3)).board).length
      ).toBeGreaterThan(0);
    }
  });
});

describe("shuffleBoard", () => {
  test("keeps tiles and faces and leaves a move mid-game", () => {
    const rng = seeded(11);
    const { board, solution } = deal(LAYOUTS.jet, rng);
    let current = board;
    for (const [a, b] of solution.slice(0, 15)) {
      current = removePair(current, a, b);
    }
    const next = shuffleBoard(current, rng);
    expect(next.map((t) => t.id)).toEqual(current.map((t) => t.id));
    const faces = (b: Board) => b.map((t) => t.face).sort((x, y) => x - y);
    expect(faces(next)).toEqual(faces(current));
    // Greedy play may dead-end, but a move must exist right after a shuffle.
    expect(findPairs(next).length).toBeGreaterThan(0);
  });
});

describe("finalScore", () => {
  test("faster and fewer helps scores higher, never below the tile count", () => {
    expect(finalScore(48, 60, 0, 0)).toBeGreaterThan(finalScore(48, 300, 0, 0));
    expect(finalScore(48, 60, 0, 0)).toBeGreaterThan(finalScore(48, 60, 2, 1));
    expect(finalScore(48, 99_999, 50, 50)).toBe(48);
  });
});
