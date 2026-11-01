/**
 * Pure logic of the six kids-only games (maze, colouring, shapes, shadows,
 * counting, dot-to-dot): generation, rounds and the small decisions the
 * screens make. Rendering is covered by `kidsGamesSmoke.test.ts`.
 */
import { KIDS_PICTURES } from "@/games/colouring/pictures";
import {
  canFinishColouring,
  countDots,
  decideDrop,
  emptyFills,
  filledCount,
  fillRegion,
  KIDS_COUNT_MAX,
  KIDS_DOT_PICTURES_BIG,
  KIDS_DOT_PICTURES_SMALL,
  KIDS_DOT_ROUNDS,
  KIDS_PAINTS,
  KIDS_SHADOW_OPTIONS,
  KIDS_SHAPES,
  type KidsDropTarget,
  makeCountRound,
  makeShadowRound,
  makeShapeRound,
  pickDotPictures,
  tapDot,
} from "@/utils/kidsGames";
import {
  canMove,
  cellAt,
  generateMaze,
  KIDS_MAZE_SIZES,
  mazeExits,
  mazeGoal,
  nextHintCell,
  solveMaze,
  stepToward,
} from "@/utils/kidsMaze";
import { seeded } from "./helpers/gameHarness";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

/* ------------------------------------------------------------------ maze */

describe("kids maze", () => {
  test("rounds grow 4×4 → 5×5 → 6×6", () => {
    expect([...KIDS_MAZE_SIZES]).toEqual([4, 5, 6]);
  });

  test("same seed → same maze; different seeds differ", () => {
    expect(generateMaze(5, 42)).toEqual(generateMaze(5, 42));
    const shapes = new Set(
      SEEDS.map((s) => JSON.stringify(generateMaze(5, s).rightOpen))
    );
    expect(shapes.size).toBeGreaterThan(10);
  });

  test.each(KIDS_MAZE_SIZES.map((s) => [s]))(
    "size %i: perfect maze — every cell connected, a tree, solvable",
    (size) => {
      for (const seed of SEEDS) {
        const maze = generateMaze(size, seed);
        const cells = size * size;
        // A spanning tree has exactly cells - 1 passages.
        const passages =
          maze.rightOpen.filter(Boolean).length +
          maze.downOpen.filter(Boolean).length;
        expect(passages).toBe(cells - 1);
        // Every cell reachable from the start.
        for (let c = 0; c < cells; c += 1) {
          expect(solveMaze(maze, 0, c)).not.toBeNull();
        }
        const path = solveMaze(maze) as number[];
        expect(path[0]).toBe(0);
        expect(path.at(-1)).toBe(mazeGoal(maze));
        for (let i = 1; i < path.length; i += 1) {
          expect(canMove(maze, path[i - 1], path[i])).toBe(true);
        }
      }
    }
  );

  test("walls are consistent: no openings through the outer border", () => {
    for (const seed of SEEDS) {
      const maze = generateMaze(6, seed);
      for (let c = 0; c < 36; c += 1) {
        if (c % 6 === 5) {
          expect(maze.rightOpen[c]).toBe(false);
        }
        if (c >= 30) {
          expect(maze.downOpen[c]).toBe(false);
        }
        // canMove is symmetric and matches the exits list.
        for (const n of mazeExits(maze, c)) {
          expect(canMove(maze, n, c)).toBe(true);
          expect(mazeExits(maze, n)).toContain(c);
        }
      }
      // No wrap-around between rows, no diagonal or far moves.
      expect(canMove(maze, 5, 6)).toBe(false);
      expect(canMove(maze, 0, 7)).toBe(false);
      expect(canMove(maze, 0, 2)).toBe(false);
      expect(canMove(maze, -1, 0)).toBe(false);
    }
  });

  test("movement: walls block, straight drags walk until a wall", () => {
    for (const seed of SEEDS) {
      const maze = generateMaze(5, seed);
      for (let from = 0; from < 25; from += 1) {
        for (let target = 0; target < 25; target += 1) {
          const end = stepToward(maze, from, target);
          // Every step on the way is open, and it never overshoots.
          const path = solveMaze(maze, from, end) as number[];
          expect(path).not.toBeNull();
          const sameLine =
            Math.floor(from / 5) === Math.floor(target / 5) ||
            from % 5 === target % 5;
          if (!sameLine) {
            expect(end).toBe(from);
          }
          if (canMove(maze, from, target)) {
            expect(end).toBe(target);
          }
        }
      }
    }
  });

  test("hint is the next cell on the way to the goal", () => {
    const maze = generateMaze(6, 7);
    const path = solveMaze(maze) as number[];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(nextHintCell(maze, path[i])).toBe(path[i + 1]);
    }
    expect(nextHintCell(maze, mazeGoal(maze))).toBeNull();
  });

  test("cellAt maps board pixels to cells and rejects outside points", () => {
    expect(cellAt(4, 80, 10, 10)).toBe(0);
    expect(cellAt(4, 80, 319, 319)).toBe(15);
    expect(cellAt(4, 80, 90, 170)).toBe(9);
    expect(cellAt(4, 80, -1, 10)).toBe(-1);
    expect(cellAt(4, 80, 10, 320)).toBe(-1);
  });
});

/* ------------------------------------------------------------- colouring */

describe("kids colouring", () => {
  test("pictures: 3–5 regions each, big enough to tap, inside the canvas", () => {
    expect(KIDS_PICTURES.length).toBeGreaterThanOrEqual(3);
    for (const picture of KIDS_PICTURES) {
      expect(picture.regions.length).toBeGreaterThanOrEqual(3);
      expect(picture.regions.length).toBeLessThanOrEqual(5);
      for (const r of [...picture.regions, ...picture.decor]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(1);
        expect(r.y + r.h).toBeLessThanOrEqual(1);
      }
      // ≥ 64 dp on the smallest canvas (≈ 320 dp): 0.2 of it.
      for (const r of picture.regions) {
        expect(Math.max(r.w, r.h)).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  test("region fill state: paint, repaint, done once anything is coloured", () => {
    expect(KIDS_PAINTS).toHaveLength(6);
    let fills = emptyFills(4);
    expect(filledCount(fills)).toBe(0);
    expect(canFinishColouring(fills)).toBe(false);
    fills = fillRegion(fills, 2, 1);
    expect(fills).toEqual([null, null, 1, null]);
    expect(canFinishColouring(fills)).toBe(true);
    const repainted = fillRegion(fills, 2, 5);
    expect(repainted[2]).toBe(5);
    expect(fills[2]).toBe(1); // immutable
    expect(fillRegion(fills, 9, 0)).toEqual(fills); // out of range: no-op
    expect(fillRegion(fills, 0, 99)[0]).toBe(KIDS_PAINTS.length - 1);
    expect(filledCount(fillRegion(repainted, 0, 0))).toBe(2);
  });
});

/* ---------------------------------------------------------------- shapes */

describe("kids shapes", () => {
  test("round 0 has 3 shapes, later 4; tray is a shuffle of the board", () => {
    const rnd = seeded(5);
    for (let i = 0; i < 50; i += 1) {
      const round = i % 3;
      const { pieces, targets } = makeShapeRound(round, rnd);
      expect(targets).toHaveLength(round === 0 ? 3 : 4);
      expect(new Set(targets).size).toBe(targets.length);
      expect([...pieces].sort()).toEqual([...targets].sort());
      expect(pieces).not.toEqual(targets);
      for (const s of targets) {
        expect(KIDS_SHAPES).toContain(s);
      }
    }
  });

  const targets: KidsDropTarget[] = [
    { cx: 100, cy: 100, filled: false, shape: "circle" },
    { cx: 250, cy: 100, filled: false, shape: "star" },
    { cx: 400, cy: 100, filled: true, shape: "square" },
  ];

  test("snaps into the matching outline when close", () => {
    expect(decideDrop("circle", 130, 120, targets, 60)).toEqual({
      kind: "snap",
      target: 0,
    });
    expect(decideDrop("star", 250, 100, targets, 60)).toEqual({
      kind: "snap",
      target: 1,
    });
  });

  test("wrong outline → back (wrong); far away → back; filled ignored", () => {
    expect(decideDrop("star", 100, 100, targets, 60)).toEqual({
      kind: "return",
      wrong: true,
    });
    expect(decideDrop("circle", 100, 300, targets, 60)).toEqual({
      kind: "return",
      wrong: false,
    });
    expect(decideDrop("square", 400, 100, targets, 60)).toEqual({
      kind: "return",
      wrong: false,
    });
  });

  test("the nearest outline in range decides", () => {
    const close: KidsDropTarget[] = [
      { cx: 0, cy: 0, filled: false, shape: "circle" },
      { cx: 50, cy: 0, filled: false, shape: "triangle" },
    ];
    expect(decideDrop("triangle", 40, 0, close, 60)).toEqual({
      kind: "snap",
      target: 1,
    });
    expect(decideDrop("triangle", 10, 0, close, 60).kind).toBe("return");
  });
});

/* --------------------------------------------------------------- shadows */

describe("kids shadows", () => {
  test("three different options, the animal among them, never twice in a row", () => {
    const rnd = seeded(11);
    let previous: string | null = null;
    for (let i = 0; i < 200; i += 1) {
      const round = makeShadowRound(previous, rnd);
      expect(round.options).toHaveLength(KIDS_SHADOW_OPTIONS);
      expect(new Set(round.options).size).toBe(KIDS_SHADOW_OPTIONS);
      expect(round.options[round.answerIndex]).toBe(round.animal);
      expect(round.options.filter((o) => o === round.animal)).toHaveLength(1);
      expect(round.animal).not.toBe(previous);
      previous = round.animal;
    }
  });

  test("the answer moves around", () => {
    const rnd = seeded(3);
    const spots = new Set(
      Array.from({ length: 60 }, () => makeShadowRound(null, rnd).answerIndex)
    );
    expect(spots.size).toBe(KIDS_SHADOW_OPTIONS);
  });
});

/* -------------------------------------------------------------- counting */

describe("kids counting", () => {
  test("rounds 0–1 count to 3, later to 5; never the same twice in a row", () => {
    const rnd = seeded(9);
    let previous: number | null = null;
    const seenLate = new Set<number>();
    for (let i = 0; i < 300; i += 1) {
      const round = i % 5;
      const { count, emoji } = makeCountRound(round, previous, rnd);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(round < 2 ? 3 : KIDS_COUNT_MAX);
      expect(count).not.toBe(previous);
      expect(emoji.length).toBeGreaterThan(0);
      if (round >= 2) {
        seenLate.add(count);
      }
      previous = count;
    }
    expect([...seenLate].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("dice faces show exactly n dots in distinct cells", () => {
    for (let n = 1; n <= KIDS_COUNT_MAX; n += 1) {
      const dots = countDots(n);
      expect(dots).toHaveLength(n);
      expect(new Set(dots).size).toBe(n);
      for (const d of dots) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(9);
      }
    }
  });
});

/* ------------------------------------------------------------ dot to dot */

describe("kids dot to dot", () => {
  test("two 5-dot pictures, then one 7-dot picture", () => {
    const rnd = seeded(4);
    for (let i = 0; i < 20; i += 1) {
      const pictures = pickDotPictures(rnd);
      expect(pictures).toHaveLength(KIDS_DOT_ROUNDS);
      expect(pictures.map((p) => p.points.length)).toEqual([5, 5, 7]);
      expect(new Set(pictures.map((p) => p.id)).size).toBe(3);
    }
  });

  test("dots sit inside the canvas and far enough apart to tap", () => {
    for (const picture of [
      ...KIDS_DOT_PICTURES_SMALL,
      ...KIDS_DOT_PICTURES_BIG,
    ]) {
      for (const [x, y] of picture.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
      picture.points.forEach(([ax, ay], i) => {
        for (const [bx, by] of picture.points.slice(i + 1)) {
          expect(Math.hypot(ax - bx, ay - by)).toBeGreaterThanOrEqual(0.2);
        }
      });
    }
  });

  test("dot order: right tap advances, wrong tap only wiggles", () => {
    expect(tapDot(0, 0, 5)).toEqual({ complete: false, next: 1, ok: true });
    expect(tapDot(1, 3, 5)).toEqual({ complete: false, next: 1, ok: false });
    expect(tapDot(1, 0, 5)).toEqual({ complete: false, next: 1, ok: false });
    expect(tapDot(4, 4, 5)).toEqual({ complete: true, next: 5, ok: true });
    expect(tapDot(5, 0, 5)).toEqual({ complete: true, next: 5, ok: false });
    // Full run in order.
    let next = 0;
    for (let i = 0; i < 7; i += 1) {
      const r = tapDot(next, i, 7);
      expect(r.ok).toBe(true);
      ({ next } = r);
    }
    expect(next).toBe(7);
  });
});
