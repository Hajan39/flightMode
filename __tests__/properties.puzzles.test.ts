/**
 * Property-based tests for the logic puzzles and the Box Breaker physics:
 * Sun & Moon, Nonogram, Runway Jam (Rush Hour) and Box Breaker. Seeded
 * random states; a failure prints the seed (helpers/property.ts).
 */
import {
  BALL_R,
  COLS as BRICK_COLS,
  BRICK_H,
  BRICK_TOP,
  BRICK_W,
  type BreakerState,
  step as breakerStep,
  FIELD_W,
  launch,
  MAX_LIVES,
  movePaddle,
  newGame as newBreaker,
  PADDLE_Y,
  paddleWidth,
  STEEL,
} from "@/games/box-breaker/logic";
import { NONOGRAM_LEVELS } from "@/games/nonogram/levels";
import {
  type CellState,
  deriveClues,
  EMPTY,
  FILLED,
  findForcedCell,
  isLineSatisfied,
  runsOf,
  solveByLineLogic,
  solveLine,
  UNKNOWN,
} from "@/games/nonogram/logic";
import { LEVELS as JAM_LEVELS } from "@/games/runway-jam/levels";
import {
  applyMove as applyJamMove,
  isSolved as isJamSolved,
  GRID_SIZE as JAM_SIZE,
  nextOptimalMove,
  type Piece,
  reachablePositions,
  solveBFS,
  validateLevel,
} from "@/games/runway-jam/logic";
import { LEVELS as SUN_MOON_LEVELS } from "@/games/sun-moon/levels";
import {
  countSolutions,
  findConflicts,
  getHintCell,
  isSolvedGrid,
  parseRows,
  type SunMoonCell,
  serializeRows,
} from "@/games/sun-moon/logic";

import { assert, forAll, type Gen } from "./helpers/property";

// ---------------------------------------------------------------------------
// Sun & Moon
// ---------------------------------------------------------------------------

/** Brute-force rule check of a complete grid. */
function bruteValid(cells: SunMoonCell[], size: number): boolean {
  const lines: SunMoonCell[][] = [];
  for (let i = 0; i < size; i += 1) {
    lines.push(cells.slice(i * size, (i + 1) * size));
    lines.push(Array.from({ length: size }, (_, r) => cells[r * size + i]));
  }
  return lines.every((line) => {
    const suns = line.filter((c) => c === "S").length;
    const triple = line.some(
      (c, i) => i >= 2 && c === line[i - 1] && c === line[i - 2]
    );
    return !triple && suns === size / 2 && line.every((c) => c !== ".");
  });
}

describe("sun-moon properties", () => {
  test("hints always agree with the solution and lead to a solved grid (2000 cases)", () => {
    forAll("sun-moon hints", 2000, (g) => {
      const level = g.pick(SUN_MOON_LEVELS);
      const solution = parseRows(level.solution);
      // Random player state: givens + some right, some wrong, some blank.
      const cells: string[] = parseRows(level.givens).map((c, i) => {
        if (c !== ".") {
          return c;
        }
        const roll = g.float(0, 1);
        if (roll < 0.4) {
          return solution[i];
        }
        if (roll >= 0.6) {
          return ".";
        }
        return solution[i] === "S" ? "M" : "S";
      });
      for (let steps = 0; steps <= cells.length; steps += 1) {
        const hint = getHintCell(cells, level);
        if (!hint) {
          break;
        }
        assert(
          hint.value === solution[hint.index],
          "hint disagrees with solution"
        );
        assert(
          cells[hint.index] !== hint.value,
          "hint for an already-right cell"
        );
        assert(
          cells.slice(0, hint.index).every((c, i) => c === solution[i]),
          "hint skipped a wrong cell"
        );
        cells[hint.index] = hint.value;
      }
      assert(getHintCell(cells, level) === null, "hints never converge");
      assert(
        isSolvedGrid(cells as SunMoonCell[], level.size),
        "hinted grid not solved"
      );
    });
  });

  test("isSolvedGrid = brute-force rules on random complete grids; blanks never conflict (5000 cases)", () => {
    forAll("sun-moon rules", 5000, (g) => {
      const size = g.pick([4, 6, 8]);
      const cells = Array.from({ length: size * size }, () =>
        g.bool() ? "S" : "M"
      ) as SunMoonCell[];
      assert(
        isSolvedGrid(cells, size) === bruteValid(cells, size),
        `rules disagree on ${serializeRows(cells, size).join("/")}`
      );
      const holed = cells.map((c) => (g.bool(0.3) ? "." : c)) as SunMoonCell[];
      for (const i of findConflicts(holed, size)) {
        assert(holed[i] !== ".", "blank cell reported as conflict");
      }
    });
  });

  test("blanking any cells of a level solution leaves ≥ 1 completion (countSolutions is sound) (1000 cases)", () => {
    forAll("sun-moon count", 1000, (g) => {
      const level = g.pick(SUN_MOON_LEVELS);
      const rate = g.float(0, 0.7);
      const rows = level.solution.map((row) =>
        [...row].map((c) => (g.bool(rate) ? "." : c)).join("")
      );
      assert(countSolutions(rows, level.size, 1) === 1, "solution lost");
    });
  });
});

// ---------------------------------------------------------------------------
// Nonogram
// ---------------------------------------------------------------------------

/** Brute-force line solver: intersection of all 2^n lines matching clue + marks. */
function bruteSolveLine(
  clue: number[],
  cells: CellState[]
): CellState[] | null {
  const n = cells.length;
  let canFill = 0;
  let canEmpty = 0;
  let any = false;
  for (let mask = 0; mask < 1 << n; mask += 1) {
    const line = Array.from({ length: n }, (_, i) => Boolean(mask & (1 << i)));
    if (
      !(
        cells.every((c, i) => c === UNKNOWN || (c === FILLED) === line[i]) &&
        isLineSatisfied(clue, line)
      )
    ) {
      continue;
    }
    any = true;
    canFill |= mask;
    canEmpty |= ~mask;
  }
  if (!any) {
    return null;
  }
  return cells.map((_, i) => {
    const f = Boolean(canFill & (1 << i));
    const e = Boolean(canEmpty & (1 << i));
    if (f && !e) {
      return FILLED;
    }
    return e && !f ? EMPTY : UNKNOWN;
  });
}

function randomPicture(g: Gen, size: number): string[] {
  const density = g.float(0.2, 0.8);
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => (g.bool(density) ? "#" : ".")).join("")
  );
}

describe("nonogram properties", () => {
  test("solveLine equals a brute-force enumeration (1200 lines, n ≤ 10)", () => {
    forAll("nonogram solveLine", 1200, (g) => {
      const n = g.int(1, 10);
      const hidden = Array.from({ length: n }, () => g.bool(g.float(0.2, 0.8)));
      // Usually the line's own clue; sometimes a random one (contradictions).
      const clue = g.bool(0.85)
        ? runsOf(hidden)
        : Array.from({ length: g.int(0, 3) }, () => g.int(1, 4));
      const consistent = g.bool(0.8);
      const cells: CellState[] = hidden.map((filled) => {
        if (!g.bool(0.35)) {
          return UNKNOWN;
        }
        const truth = consistent ? filled : g.bool();
        return truth ? FILLED : EMPTY;
      });
      const got = JSON.stringify(solveLine(clue, cells));
      const want = JSON.stringify(bruteSolveLine(clue, cells));
      assert(got === want, `clue ${clue} cells ${cells}: ${got} ≠ ${want}`);
    });
  });

  test("hints (findForcedCell) on random pictures + correct partial marks always agree with the picture (800 cases)", () => {
    forAll("nonogram hint", 800, (g) => {
      const fromBank = g.bool(0.4);
      const picture = fromBank
        ? g.pick(NONOGRAM_LEVELS).solution
        : randomPicture(g, g.int(3, 10));
      const size = picture.length;
      const clues = deriveClues(picture);
      const rate = g.float(0, 0.9);
      const grid: CellState[][] = picture.map((row) =>
        [...row].map((ch) => {
          if (!g.bool(rate)) {
            return UNKNOWN;
          }
          return ch === "#" ? FILLED : EMPTY;
        })
      );
      for (let k = 0; k < size * size; k += 1) {
        const hint = findForcedCell(clues, grid);
        if (!hint) {
          break;
        }
        assert(grid[hint.r][hint.c] === UNKNOWN, "hint on a decided cell");
        const truth = picture[hint.r][hint.c] === "#" ? FILLED : EMPTY;
        assert(
          hint.state === truth,
          `hint ${hint.r},${hint.c}=${hint.state} contradicts the picture`
        );
        grid[hint.r][hint.c] = hint.state;
      }
      if (grid.every((row) => row.every((c) => c !== UNKNOWN))) {
        assert(findForcedCell(clues, grid) === null, "hint on a full grid");
      }
    });
  });

  test("solveByLineLogic: a non-null answer is the (unique) picture (1500 random pictures)", () => {
    forAll("nonogram solver", 1500, (g) => {
      const picture = randomPicture(g, g.int(2, 10));
      const solved = solveByLineLogic(deriveClues(picture), picture.length);
      assert(
        solved === null || solved.join("/") === picture.join("/"),
        `solver returned ${solved?.join("/")} for ${picture.join("/")}`
      );
    });
    for (const level of NONOGRAM_LEVELS) {
      expect(solveByLineLogic(deriveClues(level.solution), level.size)).toEqual(
        level.solution
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Runway Jam
// ---------------------------------------------------------------------------

function randomWalk(g: Gen, start: Piece[], steps: number): Piece[] {
  let pieces = start;
  for (let s = 0; s < steps; s += 1) {
    const piece = g.pick(pieces);
    const options = reachablePositions(pieces, piece.id);
    for (const pos of options) {
      assert(
        piece.horiz ? pos.row === piece.row : pos.col === piece.col,
        "move off its axis"
      );
      assert(
        pos.row !== piece.row || pos.col !== piece.col,
        "current position offered"
      );
    }
    assert(
      new Set(options.map((p) => `${p.row},${p.col}`)).size === options.length,
      "duplicate position"
    );
    if (options.length === 0) {
      continue;
    }
    const pos = g.pick(options);
    pieces = applyJamMove(pieces, piece.id, pos.row, pos.col);
    const problem = validateLevel(pieces);
    assert(problem === null, `after moving ${piece.id}: ${problem}`);
  }
  return pieces;
}

describe("runway-jam properties", () => {
  test("random walks keep every piece in bounds and non-overlapping (1000 walks × 60 moves)", () => {
    forAll("runway-jam walk", 1000, (g) => {
      const level = g.pick(JAM_LEVELS);
      const end = randomWalk(g, level.pieces, 60);
      for (const p of end) {
        const len = p.len - 1;
        assert(p.row >= 0 && p.col >= 0, "negative origin");
        assert(
          (p.horiz ? p.col + len : p.row + len) < JAM_SIZE,
          "past the edge"
        );
      }
    });
  });

  test("the hint is always optimal: it lowers the BFS distance by exactly 1 (40 random positions)", () => {
    forAll("runway-jam hint", 40, (g) => {
      const level = g.pick(JAM_LEVELS.slice(0, 4));
      const pieces = randomWalk(g, level.pieces, g.int(0, 15));
      const distance = solveBFS(pieces);
      const move = nextOptimalMove(pieces);
      if (distance === null || distance === 0) {
        assert(move === null, "hint without a solution");
        return;
      }
      assert(move !== null, "no hint for a solvable position");
      const legal = reachablePositions(pieces, move.id).some(
        (p) => p.row === move.row && p.col === move.col
      );
      assert(legal, "hint is not a legal move");
      const after = applyJamMove(pieces, move.id, move.row, move.col);
      const d2 = isJamSolved(after) ? 0 : solveBFS(after);
      assert(d2 === distance - 1, `hint went ${distance} → ${d2}`);
    });
  });
});

// ---------------------------------------------------------------------------
// Box Breaker
// ---------------------------------------------------------------------------

/** Box index under the ball centre, or -1 outside the box area. */
function boxUnder(x: number, y: number, bricks: number[]): number {
  if (y < BRICK_TOP) {
    return -1;
  }
  const row = Math.floor((y - BRICK_TOP) / BRICK_H);
  const col = Math.floor(x / BRICK_W);
  const i = row * BRICK_COLS + col;
  return col >= 0 && col < BRICK_COLS && i < bricks.length ? i : -1;
}

describe("box-breaker properties", () => {
  test("random play: balls stay in the field, never sit inside a live box, hp never grows (60 games × 1200 frames)", () => {
    forAll("box-breaker physics", 60, (g) => {
      let state: BreakerState = newBreaker(g.int(1, 12));
      let now = 1000;
      let aim = g.float(-0.8, 0.8);
      for (let frame = 0; frame < 1200; frame += 1) {
        now += g.pick([4, 16, 16, 16, 33, 50, 120]);
        if (g.bool(0.02)) {
          aim = g.float(-0.9, 0.9);
        }
        const target =
          state.balls.find((b) => !b.stuck && b.vy > 0) ?? state.balls[0];
        const x = g.bool(0.85)
          ? (target?.x ?? 0.5) + aim * 0.1
          : g.float(-0.2, 1.2);
        state = movePaddle(state, x, now);
        const half = paddleWidth(state, now) / 2;
        assert(
          state.paddleX >= half - 1e-9 &&
            state.paddleX <= FIELD_W - half + 1e-9,
          "paddle outside the field"
        );
        if (state.balls.some((b) => b.stuck) && g.bool(0.3)) {
          state = launch(state, g.rng);
        }
        const before = state;
        const { events, state: next } = breakerStep(
          state,
          g.pick([1, 16, 33, 80]),
          now,
          g.rng
        );
        const sameLevel = next.level === before.level;
        if (sameLevel) {
          next.bricks.forEach((hp, i) => {
            const old = before.bricks[i];
            assert(
              old === STEEL ? hp === STEEL : hp <= old && hp >= 0,
              `box ${i} hp ${old} → ${hp}`
            );
          });
        }
        assert(next.score >= before.score, "score went down");
        assert(
          next.lives >= 0 && next.lives <= MAX_LIVES,
          `lives ${next.lives}`
        );
        for (const b of next.balls) {
          assert(Number.isFinite(b.x + b.y + b.vx + b.vy), "non-finite ball");
          if (b.stuck) {
            continue;
          }
          assert(
            b.x >= BALL_R - 1e-9 && b.x <= FIELD_W - BALL_R + 1e-9,
            `ball x ${b.x}`
          );
          assert(b.y >= BALL_R - 1e-9, `ball y ${b.y}`);
          const i = boxUnder(b.x, b.y, next.bricks);
          assert(
            i < 0 || next.bricks[i] === 0,
            `frame ${frame}: ball tunnelled into box ${i} (hp ${next.bricks[i]})`
          );
        }
        state = next;
        if (events.over) {
          break;
        }
      }
    });
  });

  // Formerly a KNOWN BUG (fixed in review round 8): splitBalls counted only
  // the balls already pushed, so a "multi" catch with n ≥ 3 balls gave n + 6
  // (3 → 9 → 15 …). The total is now capped at 9.
  test("a multi-ball catch never takes the ball count above max(n, 9) (property, n = 1…12)", () => {
    forAll("box-breaker multi cap", 200, (g) => {
      const n = g.int(1, 12);
      const base = newBreaker(1);
      const state: BreakerState = {
        ...base,
        balls: Array.from({ length: n }, () => ({
          stuck: false,
          vx: g.float(-0.3, 0.3),
          vy: -0.6,
          x: g.float(0.1, 0.9),
          y: 1.0,
        })),
        drops: [{ kind: "multi", x: base.paddleX, y: PADDLE_Y }],
      };
      const { events, state: next } = breakerStep(state, 1, 1000, g.rng);
      assert(events.power === "multi", "drop not caught");
      assert(
        next.balls.length <= Math.max(n, 9),
        `${n} balls → ${next.balls.length}`
      );
    });
  });
});
