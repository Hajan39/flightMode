import {
  applyGravity,
  type Board,
  createBoard,
  createIdGen,
  findGroups,
  findHint,
  getLevel,
  index,
  KINDS,
  playSwap,
  type Rng,
  SIZE,
  type Special,
  shuffleBoard,
  specialFor,
  starsFor,
  type Tile,
} from "@/games/sky-match/logic";

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

/** Builds a board from rows of digits (kind) — `.` is an empty cell. */
function boardFrom(rows: string[], special: Record<number, Special> = {}) {
  const nextId = createIdGen();
  const board: Board = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < SIZE; c += 1) {
      const ch = line[c];
      const i = index(r, c);
      board.push(
        ch === "."
          ? null
          : {
              id: nextId(),
              kind: ch === "*" ? -1 : Number(ch),
              special: special[i] ?? (ch === "*" ? "color" : "none"),
            }
      );
    }
  });
  return board;
}

// No runs anywhere: a repeating 6-colour diagonal pattern.
const CALM = [
  "01234501",
  "12345012",
  "23450123",
  "34501234",
  "45012345",
  "50123450",
  "01234501",
  "12345012",
];

describe("sky-match board", () => {
  test("new boards have no runs and at least one move", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const board = createBoard(seeded(seed), createIdGen());
      expect(board).toHaveLength(SIZE * SIZE);
      expect(findGroups(board)).toHaveLength(0);
      expect(findHint(board)).not.toBeNull();
      for (const tile of board) {
        expect(tile?.kind).toBeGreaterThanOrEqual(0);
        expect(tile?.kind).toBeLessThan(KINDS);
      }
    }
  });

  test("gravity drops tiles and refills from the top", () => {
    const board = boardFrom(CALM);
    const bottom = board[index(7, 0)] as Tile;
    board[index(7, 0)] = null;
    const above = board[index(6, 0)] as Tile;
    const after = applyGravity(board, seeded(1), createIdGen(1000));
    expect(after[index(7, 0)]?.id).toBe(above.id);
    expect(after.every((t) => t !== null)).toBe(true);
    expect(after[index(0, 0)]?.id).toBeGreaterThanOrEqual(1000);
    expect(after.some((t) => t?.id === bottom.id)).toBe(false);
  });

  test("shuffle keeps the same tiles", () => {
    const board = createBoard(seeded(3), createIdGen());
    const after = shuffleBoard(board, seeded(4), createIdGen(5000));
    const ids = (b: Board) => b.map((t) => t?.id).sort();
    expect(ids(after)).toEqual(ids(board));
    expect(findGroups(after)).toHaveLength(0);
  });
});

describe("sky-match matching", () => {
  test("an L shape is one group and earns a bomb", () => {
    const board = boardFrom([
      "00012345",
      "01234501",
      "02345012",
      "34501234",
      "45012345",
      "50123450",
      "01234501",
      "12345012",
    ]);
    const groups = findGroups(board);
    const zeros = groups.find((g) => g.kind === 0);
    expect(zeros?.cells.sort((a, b) => a - b)).toEqual([0, 1, 2, 8, 16]);
    expect(zeros && specialFor(zeros, [])).toEqual({ at: 0, special: "bomb" });
  });

  test("runs of 4 make line tiles, runs of 5 a color tile", () => {
    const four = boardFrom(
      ["0000", "", "", "", "", "", "", ""].map((r) => r.padEnd(SIZE, "."))
    );
    const [g4] = findGroups(four);
    expect(specialFor(g4, [2])).toEqual({ at: 2, special: "row" });
    const five = boardFrom(
      ["00000...", "", "", "", "", "", "", ""].map((r) => r.padEnd(SIZE, "."))
    );
    expect(specialFor(findGroups(five)[0], [])?.special).toBe("color");
  });

  test("a swap without a match is rejected", () => {
    const board = boardFrom(CALM);
    expect(playSwap(board, 0, 1, seeded(1), createIdGen(100))).toBeNull();
    expect(playSwap(board, 0, 9, seeded(1), createIdGen(100))).toBeNull();
  });

  test("a matching swap clears the run and scores", () => {
    // Swapping (0,3)=3 with (1,3)=4... set up a run: row 0 "001" + 0 below.
    const board = boardFrom([
      "00134501",
      "12045012",
      "23450123",
      "34501234",
      "45012345",
      "50123450",
      "01234501",
      "12345012",
    ]);
    // Swap (0,2)=1 with (1,2)=0 → row 0 becomes 000…
    const steps = playSwap(board, 2, 10, seeded(1), createIdGen(100));
    expect(steps).not.toBeNull();
    expect(steps?.[0].cleared.sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(steps?.[0].points).toBe(30);
  });

  test("a color tile swapped with a tile clears that whole kind", () => {
    const board = boardFrom(CALM);
    board[index(0, 0)] = { id: 999, kind: -1, special: "color" };
    const kindRight = board[1]?.kind;
    const count = board.filter((t) => t?.kind === kindRight).length;
    const steps = playSwap(board, 0, 1, seeded(2), createIdGen(100));
    expect(steps?.[0].cleared).toHaveLength(count + 1);
  });

  test("a line tile caught in a match clears its row", () => {
    const board = boardFrom(
      [
        "00134501",
        "12045012",
        "23450123",
        "34501234",
        "45012345",
        "50123450",
        "01234501",
        "12345012",
      ],
      { 1: "row" }
    );
    const steps = playSwap(board, 2, 10, seeded(1), createIdGen(100));
    expect(steps?.[0].cleared.length).toBe(SIZE);
  });
});

describe("sky-match levels", () => {
  test("stars rise with score", () => {
    const level = getLevel(1);
    expect(starsFor(level, level.target - 1)).toBe(0);
    expect(starsFor(level, level.target)).toBe(1);
    expect(starsFor(level, Math.round(level.target * 1.3))).toBe(2);
    expect(starsFor(level, Math.round(level.target * 1.6))).toBe(3);
  });

  /** A greedy player: always takes the move worth the most right now. */
  function playLevel(levelId: number, seed: number): number {
    const rng = seeded(seed);
    const nextId = createIdGen();
    let board = createBoard(rng, nextId);
    let score = 0;
    for (let move = 0; move < getLevel(levelId).moves; move += 1) {
      let best: { a: number; b: number; points: number } | null = null;
      for (let a = 0; a < SIZE * SIZE; a += 1) {
        for (const b of [a + 1, a + SIZE]) {
          if (b >= SIZE * SIZE || (b === a + 1 && b % SIZE === 0)) {
            continue;
          }
          // Peek with a throwaway rng so the real game's rng is untouched.
          const steps = playSwap(
            board,
            a,
            b,
            seeded(a * 100 + b),
            createIdGen(1e6)
          );
          const pts = steps?.reduce((s, x) => s + x.points, 0) ?? -1;
          if (steps && (!best || pts > best.points)) {
            best = { a, b, points: pts };
          }
        }
      }
      if (!best) {
        board = shuffleBoard(board, rng, nextId);
        continue;
      }
      const steps = playSwap(board, best.a, best.b, rng, nextId) ?? [];
      score += steps.reduce((s, x) => s + x.points, 0);
      board = steps.at(-1)?.afterFall ?? board;
      if (!findHint(board)) {
        board = shuffleBoard(board, rng, nextId);
      }
    }
    return score;
  }

  test("a greedy player passes early levels and the last level stays hard", () => {
    const runs = 12;
    const passRate = (levelId: number) => {
      let passed = 0;
      for (let seed = 1; seed <= runs; seed += 1) {
        if (playLevel(levelId, seed) >= getLevel(levelId).target) {
          passed += 1;
        }
      }
      return passed / runs;
    };
    expect(passRate(1)).toBeGreaterThanOrEqual(0.9);
    expect(passRate(30)).toBeLessThan(0.9);
  });
});
