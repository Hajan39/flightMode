/**
 * Property-based tests for game rule modules (games/<id>/logic.ts):
 * 2048, Minesweeper, Sudoku, Snake, Sky Match, Cargo Blocks, Mahjong and
 * Solitaire, plus Code Breaker feedback. Random boards / random play from seeded RNGs, invariants checked
 * after every move; a failure prints the seed (helpers/property.ts).
 */
import {
  anyFits,
  BOARD_SIZE,
  COLOR_COUNT,
  canPlace,
  canPlayAny,
  dealTray,
  emptyBoard,
  findClears,
  idx,
  newGame as newCargoGame,
  placementCovering,
  playMove as playCargoMove,
  SHAPES,
  scoreMove,
} from "@/games/cargo-blocks/logic";
import { calcBullsCows } from "@/games/cross-code-breaker/logic";
import {
  canMatch,
  deal as dealMahjong,
  findPairs,
  isFree,
  LAYOUT_IDS,
  LAYOUTS,
  removePair,
  shuffleBoard as shuffleMahjong,
} from "@/games/mahjong/logic";
import {
  MINE_COUNT,
  COLS as MS_COLS,
  ROWS as MS_ROWS,
  type Cell as MsCell,
  makeEmptyBoard,
  neighbors,
  resolveTap,
  toggleFlag,
} from "@/games/minesweeper/logic";
import {
  createBoard,
  createIdGen,
  findGroups,
  findHint,
  playSwap,
  SIZE as SKY_SIZE,
  type Board as SkyBoard,
  shuffleBoard as shuffleSky,
} from "@/games/sky-match/logic";
import {
  CELL_COUNT,
  GRID_COLS,
  nextDirection,
  opposite,
  placeFood,
  type Direction as SnakeDir,
  step as snakeStep,
} from "@/games/snake/logic";
import {
  applyMove as applySolitaireMove,
  type Card,
  cardId,
  deal as dealSolitaire,
  draw,
  getPile,
  isLegalMove,
  isMovableRun,
  legalDestinations,
  type PileRef,
  type Move as SolitaireMove,
  type GameState as SolitaireState,
  undo,
} from "@/games/solitaire/logic";
import {
  applyMove as applySudokuMove,
  isValidCompleteGrid,
  transformPuzzle,
} from "@/games/sudoku/logic";
import { PUZZLES } from "@/games/sudoku/puzzles";
import {
  applyMove as apply2048,
  type Direction as Dir2048,
  GRID_SIZE,
  type Grid,
  isGameOver,
  playMove as play2048,
} from "@/games/twenty-forty-eight/logic";

import { assert, forAll, type Gen } from "./helpers/property";

// ---------------------------------------------------------------------------
// 2048
// ---------------------------------------------------------------------------

const DIRS_2048: Dir2048[] = ["left", "right", "up", "down"];

const sum = (grid: Grid) => grid.flat().reduce((a, b) => a + b, 0);
const nonZero = (grid: Grid) => grid.flat().filter((v) => v !== 0).length;
const mirror = (grid: Grid) => grid.map((row) => [...row].reverse());
const transpose = (grid: Grid) =>
  grid[0].map((_, c) => grid.map((row) => row[c]));

function random2048(g: Gen): Grid {
  const density = g.float(0.2, 1);
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () =>
      g.bool(density) ? 2 ** g.int(1, g.pick([3, 6, 11])) : 0
    )
  );
}

describe("2048 properties", () => {
  test("a move preserves the tile sum (+ the one new tile); no move ⇒ same grid (5000 cases)", () => {
    forAll("2048 sum", 5000, (g) => {
      const grid = random2048(g);
      const snapshot = JSON.stringify(grid);
      const dir = g.pick(DIRS_2048);
      const slid = apply2048(grid, dir);
      const out = play2048(grid, dir, g.rng);
      assert(JSON.stringify(grid) === snapshot, "input mutated");
      assert(sum(slid.grid) === sum(grid), "slide changed the tile sum");
      assert(
        slid.moved === (JSON.stringify(slid.grid) !== snapshot),
        "moved flag wrong"
      );
      assert(
        Math.max(...slid.grid.flat()) <= 2 * Math.max(...grid.flat()),
        "a tile merged twice"
      );
      if (!out.moved) {
        assert(out.grid === grid && out.gained === 0, "no-op changed state");
        return;
      }
      const added = sum(out.grid) - sum(grid);
      assert(added === 2 || added === 4, `new tile worth ${added}`);
      assert(
        nonZero(out.grid) === nonZero(slid.grid) + 1,
        "not exactly one new tile"
      );
      // Score = total value of the merged tiles = sum over created tiles.
      assert(out.gained === slid.score && out.gained % 4 === 0, "score");
      assert(out.over === isGameOver(out.grid), "over flag");
    });
  });

  test("directions are symmetric: right = mirror∘left∘mirror, up = transpose∘left∘transpose (2000 cases)", () => {
    forAll("2048 symmetry", 2000, (g) => {
      const grid = random2048(g);
      const left = apply2048(grid, "left");
      const same = (a: Grid, b: Grid) =>
        JSON.stringify(a) === JSON.stringify(b);
      assert(
        same(apply2048(mirror(grid), "right").grid, mirror(left.grid)),
        "right ≠ mirrored left"
      );
      assert(
        same(apply2048(transpose(grid), "up").grid, transpose(left.grid)),
        "up ≠ transposed left"
      );
      assert(
        apply2048(mirror(grid), "right").score === left.score,
        "mirrored score differs"
      );
    });
  });

  test("isGameOver iff no direction moves (3000 cases)", () => {
    forAll("2048 game over", 3000, (g) => {
      const grid = random2048(g);
      if (nonZero(grid) === 0) {
        return; // an empty grid has no move but is not "over" (never in play)
      }
      const anyMove = DIRS_2048.some((d) => apply2048(grid, d).moved);
      assert(isGameOver(grid) === !anyMove, "isGameOver disagrees");
    });
  });
});

// ---------------------------------------------------------------------------
// Minesweeper
// ---------------------------------------------------------------------------

function msCheck(
  board: MsCell[][],
  label: string,
  before: MsCell[][] | null = null
) {
  let mines = 0;
  for (let r = 0; r < MS_ROWS; r += 1) {
    for (let c = 0; c < MS_COLS; c += 1) {
      const cell = board[r][c];
      if (cell.isMine) {
        mines += 1;
        continue;
      }
      const count = neighbors(r, c).filter(
        ([a, b]) => board[a][b].isMine
      ).length;
      assert(
        cell.adjacentMines === count,
        `${label}: wrong count at ${r},${c}`
      );
      // Flood closure: a revealed 0 has every safe unflagged neighbour revealed.
      // (Only for cells revealed by this tap: un-flagging later may expose
      // a covered neighbour of an old 0, which is fine.)
      const fresh = !before?.[r][c].isRevealed;
      if (fresh && cell.isRevealed && cell.adjacentMines === 0) {
        for (const [a, b] of neighbors(r, c)) {
          const n = board[a][b];
          assert(
            n.isMine || n.isFlagged || n.isRevealed,
            `${label}: flood stopped at ${a},${b}`
          );
        }
      }
    }
  }
  assert(mines === MINE_COUNT, `${label}: ${mines} mines`);
}

const safeLeft = (board: MsCell[][]) =>
  board.flat().filter((c) => !(c.isMine || c.isRevealed)).length;

describe("minesweeper properties", () => {
  test("first tap is never a mine (nor its neighbours); random play: flood never reveals a mine, win iff all safe revealed (800 games)", () => {
    forAll("minesweeper play", 800, (g) => {
      const r0 = g.int(0, MS_ROWS - 1);
      const c0 = g.int(0, MS_COLS - 1);
      let { board, result } = resolveTap(
        makeEmptyBoard(),
        r0,
        c0,
        false,
        g.rng
      );
      assert(result === "started" || result === "win", `first tap ${result}`);
      assert(!board[r0][c0].isMine, "first tap on a mine");
      for (const [a, b] of neighbors(r0, c0)) {
        assert(!board[a][b].isMine, "mine next to the first tap");
      }
      msCheck(board, "after first tap");
      for (
        let move = 0;
        move < 120 && result !== "lose" && result !== "win";
        move += 1
      ) {
        const r = g.int(0, MS_ROWS - 1);
        const c = g.int(0, MS_COLS - 1);
        if (g.bool(0.15)) {
          board = toggleFlag(board, r, c);
          continue;
        }
        const before = board;
        const tapped = before[r][c];
        ({ board, result } = resolveTap(before, r, c, true, g.rng));
        if (tapped.isFlagged || tapped.isRevealed) {
          assert(
            result === "ignored" && board === before,
            "flag/revealed tap not ignored"
          );
          continue;
        }
        if (tapped.isMine) {
          assert(result === "lose", "mine tap did not lose");
          assert(
            board.flat().every((x) => !x.isMine || x.isRevealed),
            "mines hidden after loss"
          );
          continue;
        }
        for (let i = 0; i < MS_ROWS; i += 1) {
          for (let j = 0; j < MS_COLS; j += 1) {
            const now = board[i][j];
            assert(!(now.isMine && now.isRevealed), "flood revealed a mine");
            assert(
              !before[i][j].isRevealed || now.isRevealed,
              "cell got covered"
            );
            assert(
              !(now.isFlagged && now.isRevealed),
              "revealed a flagged cell"
            );
          }
        }
        msCheck(board, `move ${move}`, before);
        assert(
          (result === "win") === (safeLeft(board) === 0),
          `${result} with ${safeLeft(board)} safe left`
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Sudoku
// ---------------------------------------------------------------------------

describe("sudoku properties", () => {
  test("transformed bank puzzles stay valid with givens ⊂ solution (1500 cases)", () => {
    forAll("sudoku transform", 1500, (g) => {
      const base = g.pick(PUZZLES);
      const p = transformPuzzle(base, g.rng);
      assert(
        isValidCompleteGrid(p.solution, p.clues),
        "invalid transformed solution"
      );
      assert(
        p.clues.filter((v) => v !== 0).length ===
          base.clues.filter((v) => v !== 0).length,
        "clue count changed"
      );
      assert(p.difficulty === base.difficulty, "difficulty lost");
    });
  });

  test("any single-cell change or same-row swap of a valid grid is invalid (1500 cases)", () => {
    forAll("sudoku mutation", 1500, (g) => {
      const { solution } = transformPuzzle(g.pick(PUZZLES), g.rng);
      const changed = [...solution];
      const i = g.int(0, 80);
      changed[i] = ((solution[i] + g.int(0, 7)) % 9) + 1;
      assert(!isValidCompleteGrid(changed), "changed cell still valid");
      const swapped = [...solution];
      const row = g.int(0, 8);
      const a = row * 9 + g.int(0, 8);
      const b = row * 9 + (((a % 9) + g.int(1, 8)) % 9);
      [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
      assert(!isValidCompleteGrid(swapped), "row swap still valid");
    });
  });

  test("applyMove on random partial boards: won iff complete & correct; errors = wrong filled cells (3000 cases)", () => {
    forAll("sudoku applyMove", 3000, (g) => {
      const { clues, solution } = transformPuzzle(g.pick(PUZZLES), g.rng);
      const fillRate = g.pick([0.3, 0.9, 1]);
      const wrongRate = g.pick([0, 0, 0.05]);
      const board = clues.map((v, i) => {
        if (v !== 0) {
          return v;
        }
        if (!g.bool(fillRate)) {
          return 0;
        }
        return g.bool(wrongRate) ? g.int(1, 9) : solution[i];
      });
      const empties = board
        .map((_, i) => (clues[i] === 0 ? i : -1))
        .filter((i) => i >= 0);
      const at = empties.length > 0 ? g.pick(empties) : 0;
      const num = g.bool(0.7) ? solution[at] : g.int(0, 9);
      const snapshot = [...board];
      const out = applySudokuMove(board, solution, at, num, clues);
      assert(
        board.every((v, i) => v === snapshot[i]),
        "input mutated"
      );
      const next = [...board];
      next[at] = num;
      assert(
        out.board.every((v, i) => v === next[i]),
        "board after move"
      );
      const correct = next.every((v, i) => v === solution[i]);
      assert(out.won === correct, `won=${out.won}, correct=${correct}`);
      const wrong = next.flatMap((v, i) =>
        v !== 0 && v !== solution[i] ? [i] : []
      );
      const errors = [...out.errors].sort((x, y) => x - y);
      const expected = out.won ? [] : wrong;
      assert(
        errors.length === expected.length &&
          errors.every((v, i) => v === expected[i]),
        `errors ${errors} ≠ ${expected}`
      );
      assert(
        out.isError === (!out.won && num !== 0 && num !== solution[at]),
        "isError"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Snake
// ---------------------------------------------------------------------------

const SNAKE_DIRS: SnakeDir[] = ["up", "down", "left", "right"];
const adjacent = (a: number, b: number) => {
  const dr = Math.abs(Math.floor(a / GRID_COLS) - Math.floor(b / GRID_COLS));
  const dc = Math.abs((a % GRID_COLS) - (b % GRID_COLS));
  return dr + dc === 1;
};

describe("snake properties", () => {
  test("nextDirection never reverses into the neck, for any press sequence (5000 cases)", () => {
    forAll("snake nextDirection", 5000, (g) => {
      const last = g.pick(SNAKE_DIRS);
      let pending = g.bool(0.5)
        ? last
        : g.pick(SNAKE_DIRS.filter((d) => d !== opposite(last)));
      for (let i = 0; i < g.int(1, 6); i += 1) {
        const requested = g.pick(SNAKE_DIRS);
        const next = nextDirection(last, pending, requested);
        assert(
          next !== opposite(last),
          `${last}: ${pending} + ${requested} → ${next}`
        );
        assert(
          next === (requested === opposite(last) ? pending : requested),
          "wrong pick"
        );
        pending = next;
      }
    });
  });

  test("random games: body stays connected, unique, in bounds; grows only by eating; food never on the snake (1000 games)", () => {
    forAll("snake play", 1000, (g) => {
      let snake = [GRID_COLS * 9 + 9, GRID_COLS * 9 + 8, GRID_COLS * 9 + 7];
      let lastMoved: SnakeDir = "right";
      let pending: SnakeDir = "right";
      let food = placeFood(snake, g.rng);
      for (let tick = 0; tick < 400; tick += 1) {
        for (let k = g.int(0, 2); k > 0; k -= 1) {
          pending = nextDirection(lastMoved, pending, g.pick(SNAKE_DIRS));
        }
        // Steer towards the food half of the time so the snake grows.
        if (g.bool(0.5)) {
          const fr = Math.floor(food / GRID_COLS);
          const fc = food % GRID_COLS;
          const hr = Math.floor(snake[0] / GRID_COLS);
          const hc = snake[0] % GRID_COLS;
          let want: SnakeDir = fc > hc ? "right" : "left";
          if (fr !== hr) {
            want = fr > hr ? "down" : "up";
          }
          pending = nextDirection(lastMoved, pending, want);
        }
        const [, neck] = snake;
        const res = snakeStep(snake, pending, food);
        lastMoved = pending;
        if (res.dead) {
          break;
        }
        assert(res.snake[0] !== neck, "head went into the neck");
        assert(res.snake.length === snake.length + (res.ate ? 1 : 0), "length");
        assert(new Set(res.snake).size === res.snake.length, "self overlap");
        for (let i = 1; i < res.snake.length; i += 1) {
          assert(adjacent(res.snake[i - 1], res.snake[i]), "body disconnected");
        }
        assert(
          res.snake.every((c) => c >= 0 && c < CELL_COUNT),
          "out of bounds"
        );
        ({ snake } = res);
        if (res.ate) {
          food = placeFood(snake, g.rng);
        }
        assert(
          food === -1 ? snake.length === CELL_COUNT : !snake.includes(food),
          "food on snake"
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Sky Match
// ---------------------------------------------------------------------------

function skyCheck(board: SkyBoard, label: string) {
  assert(board.length === SKY_SIZE * SKY_SIZE, `${label}: size`);
  assert(
    board.every((t) => t !== null),
    `${label}: hole`
  );
  const ids = board.map((t) => t?.id);
  assert(new Set(ids).size === ids.length, `${label}: duplicate tile id`);
}

describe("sky-match properties", () => {
  test("random play: legal swaps cascade to a full board with no matches; illegal swaps are rejected (300 games × 25 moves)", () => {
    forAll("sky-match play", 300, (g) => {
      const nextId = createIdGen();
      let board = createBoard(g.rng, nextId);
      skyCheck(board, "new");
      assert(findGroups(board).length === 0, "new board has a match");
      assert(findHint(board) !== null, "new board has no move");
      for (let move = 0; move < 25; move += 1) {
        const hint = findHint(board);
        if (!hint) {
          board = shuffleSky(board, g.rng, nextId);
          skyCheck(board, "shuffled");
          assert(
            findGroups(board).length === 0 && findHint(board),
            "bad shuffle"
          );
          continue;
        }
        let [a, b] = hint;
        if (g.bool(0.3)) {
          a = g.int(0, SKY_SIZE * SKY_SIZE - 1);
          b = g.pick([a - 1, a + 1, a - SKY_SIZE, a + SKY_SIZE, g.int(0, 63)]);
        }
        if (b < 0 || b >= SKY_SIZE * SKY_SIZE) {
          continue;
        }
        const steps = playSwap(board, a, b, g.rng, nextId);
        if (!steps) {
          const legal = [a, b].sort((x, y) => x - y);
          assert(
            !(hint[0] === legal[0] && hint[1] === legal[1]),
            "the hinted swap was rejected"
          );
          continue;
        }
        assert(steps.length > 0, "legal swap with no cascade");
        for (const s of steps) {
          skyCheck(s.afterFall, `move ${move}`);
          assert(s.points > 0, "cascade step without points");
          for (const c of s.cleared) {
            assert(
              s.afterClear[c] === null || s.created.includes(c),
              "cleared cell kept a tile"
            );
          }
        }
        board = (steps.at(-1) as (typeof steps)[number]).afterFall;
        assert(
          findGroups(board).length === 0,
          `move ${move}: board still has a match after the cascade`
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Cargo Blocks
// ---------------------------------------------------------------------------

describe("cargo-blocks properties", () => {
  test("random games: no full line survives, cell bookkeeping and score add up, over iff no piece fits (400 games)", () => {
    forAll("cargo-blocks play", 400, (g) => {
      let state = newCargoGame(g.rng);
      for (let move = 0; move < 80; move += 1) {
        const options: [number, number, number][] = [];
        state.tray.forEach((trayPiece, traySlot) => {
          if (!trayPiece) {
            return;
          }
          for (let r = 0; r < BOARD_SIZE; r += 1) {
            for (let c = 0; c < BOARD_SIZE; c += 1) {
              if (canPlace(state.board, trayPiece.shape, r, c)) {
                options.push([traySlot, r, c]);
              }
            }
          }
        });
        assert(
          options.length > 0 === canPlayAny(state.board, state.tray),
          "canPlayAny"
        );
        if (options.length === 0) {
          break;
        }
        // An illegal placement is refused.
        const bad = playCargoMove(state, g.int(0, 2), g.int(-2, 9), 9, g.rng);
        assert(bad === null, "out-of-bounds move accepted");
        const [slot, r, c] = g.pick(options);
        const piece = state.tray[slot];
        assert(piece !== null, "picked empty slot");
        const filledBefore = state.board.filter((v) => v !== 0).length;
        const res = playCargoMove(state, slot, r, c, g.rng);
        assert(res !== null, "legal move refused");
        const { board } = res.state;
        assert(
          board.every((v) => Number.isInteger(v) && v >= 0 && v <= COLOR_COUNT),
          "bad cell value"
        );
        const clears = findClears(board);
        assert(
          clears.rows.length + clears.cols.length === 0,
          "full line left on board"
        );
        const filledAfter = board.filter((v) => v !== 0).length;
        assert(
          filledAfter ===
            filledBefore + piece.shape.cells.length - res.cleared.length,
          `cells: ${filledBefore} + ${piece.shape.cells.length} - ${res.cleared.length} ≠ ${filledAfter}`
        );
        assert(
          res.cleared.every((i) => board[i] === 0),
          "cleared cell not empty"
        );
        assert(
          res.gained ===
            scoreMove(piece.shape.cells.length, res.lines, res.state.streak),
          "gained"
        );
        assert(res.state.score === state.score + res.gained, "score sum");
        assert(
          res.state.streak === (res.lines > 0 ? state.streak + 1 : 0),
          "streak"
        );
        assert(res.over === !canPlayAny(board, res.state.tray), "over flag");
        assert(
          res.state.tray.some((p) => p !== null),
          "empty tray not refilled"
        );
        ({ state } = res);
        if (res.over) {
          break;
        }
      }
    });
  });

  test("dealTray never deals a dead tray while some shape still fits (1500 random boards)", () => {
    forAll("cargo-blocks dealTray", 1500, (g) => {
      const density = g.float(0.3, 0.98);
      const board = emptyBoard().map(() =>
        g.bool(density) ? g.int(1, COLOR_COUNT) : 0
      );
      const tray = dealTray(board, g.rng);
      const someFits = SHAPES.some((s) => anyFits(board, s));
      assert(
        !someFits || tray.some((p) => anyFits(board, p.shape)),
        "dead tray dealt"
      );
    });
  });

  test("placementCovering finds a covering placement iff one exists (3000 cases)", () => {
    forAll("cargo-blocks covering", 3000, (g) => {
      const board = emptyBoard().map(() => (g.bool(0.4) ? 1 : 0));
      const shape = g.pick(SHAPES);
      const row = g.int(0, BOARD_SIZE - 1);
      const col = g.int(0, BOARD_SIZE - 1);
      const found = placementCovering(board, shape, row, col);
      const exists = shape.cells.some(([r, c]) =>
        canPlace(board, shape, row - r, col - c)
      );
      assert((found !== null) === exists, "existence mismatch");
      if (found) {
        assert(
          canPlace(board, shape, found.row, found.col),
          "returned placement does not fit"
        );
        assert(
          shape.cells.some(
            ([r, c]) => idx(found.row + r, found.col + c) === idx(row, col)
          ),
          "placement does not cover the tapped cell"
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Mahjong
// ---------------------------------------------------------------------------

describe("mahjong properties", () => {
  test("every random deal is solvable by replaying its own solution (20 deals per layout)", () => {
    for (const layout of LAYOUT_IDS) {
      forAll(`mahjong deal ${layout}`, 20, (g) => {
        const { board, solution } = dealMahjong(LAYOUTS[layout], g.rng);
        const faces = new Map<number, number>();
        for (const t of board) {
          assert(t.face >= 0, "unassigned face");
          faces.set(t.face, (faces.get(t.face) ?? 0) + 1);
        }
        assert(
          [...faces.values()].every((n) => n % 2 === 0),
          "odd face count"
        );
        let rest = board;
        for (const [a, b] of solution) {
          const ta = rest.find((t) => t.id === a);
          const tb = rest.find((t) => t.id === b);
          assert(
            ta && tb && canMatch(rest, ta, tb),
            `${layout}: pair ${a}/${b} not playable`
          );
          rest = removePair(rest, a, b);
        }
        assert(rest.length === 0, `${layout}: ${rest.length} tiles left`);
      });
    }
  });

  test("shuffle mid-game keeps the tiles and always leaves a move (25 games)", () => {
    forAll("mahjong shuffle", 25, (g) => {
      const layout = g.pick(LAYOUT_IDS);
      let { board } = dealMahjong(LAYOUTS[layout], g.rng);
      for (let k = g.int(0, 30); k > 0; k -= 1) {
        const pairs = findPairs(board);
        if (pairs.length === 0) {
          break;
        }
        const [a, b] = g.pick(pairs);
        board = removePair(board, a, b);
      }
      if (board.length < 2) {
        return;
      }
      const next = shuffleMahjong(board, g.rng);
      const key = (t: {
        face: number;
        id: number;
        x: number;
        y: number;
        z: number;
      }) => `${t.id}@${t.x},${t.y},${t.z}`;
      expect(next.map(key)).toEqual(board.map(key));
      expect(next.map((t) => t.face).sort((x, y) => x - y)).toEqual(
        board.map((t) => t.face).sort((x, y) => x - y)
      );
      const free = next.filter((t) => isFree(next, t)).length;
      assert(
        free < 2 || findPairs(next).length > 0,
        `${layout}: shuffle left no move`
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Solitaire
// ---------------------------------------------------------------------------

function allCards(s: SolitaireState): Card[] {
  return [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flat()];
}

function solitaireCheck(s: SolitaireState, label: string) {
  const cards = allCards(s);
  assert(cards.length === 52, `${label}: ${cards.length} cards`);
  assert(new Set(cards.map(cardId)).size === 52, `${label}: duplicate card`);
  assert(s.score >= 0, `${label}: negative score`);
  assert(
    s.stock.every((c) => !c.up) && s.waste.every((c) => c.up),
    `${label}: stock/waste faces`
  );
  for (const pile of s.foundations) {
    for (const [i, c] of pile.entries()) {
      assert(
        c.up && c.rank === i + 1 && c.suit === pile[0].suit,
        `${label}: foundation order`
      );
    }
  }
  for (const [p, pile] of s.tableau.entries()) {
    if (pile.length === 0) {
      continue;
    }
    const firstUp = pile.findIndex((c) => c.up);
    assert(firstUp >= 0, `${label}: pile ${p} has no face-up card on top`);
    assert(
      pile.slice(firstUp).every((c) => c.up),
      `${label}: face-down card above a face-up one`
    );
    assert(
      isMovableRun(pile, firstUp),
      `${label}: pile ${p} face-up cards are not a valid run`
    );
  }
}

function legalMoves(s: SolitaireState): SolitaireMove[] {
  const sources: PileRef[] = [
    { kind: "waste" },
    ...[0, 1, 2, 3].map((index): PileRef => ({ index, kind: "foundation" })),
    ...[0, 1, 2, 3, 4, 5, 6].map(
      (index): PileRef => ({ index, kind: "tableau" })
    ),
  ];
  const moves: SolitaireMove[] = [];
  for (const from of sources) {
    const pile = getPile(s, from);
    for (let cardIndex = 0; cardIndex < pile.length; cardIndex += 1) {
      for (const to of legalDestinations(s, from, cardIndex)) {
        moves.push({ cardIndex, from, to });
      }
    }
  }
  return moves;
}

describe("solitaire properties", () => {
  test("random legal play (moves, draws, undos) keeps 52 unique cards and every pile well-formed (150 games × 150 actions)", () => {
    forAll("solitaire play", 150, (g) => {
      let s = dealSolitaire(g.pick([1, 3] as const), g.rng);
      solitaireCheck(s, "deal");
      for (let a = 0; a < 150; a += 1) {
        const roll = g.float(0, 1);
        if (roll < 0.08 && s.history.length > 0) {
          const prev = s.history.at(-1);
          s = undo(s);
          const { history: _h, drawCount: _d, ...board } = s;
          expect(board).toEqual(prev);
          solitaireCheck(s, `undo ${a}`);
          continue;
        }
        const moves = legalMoves(s);
        if (roll < 0.35 || moves.length === 0) {
          const next = draw(s);
          if (next) {
            s = next;
            solitaireCheck(s, `draw ${a}`);
          }
          continue;
        }
        const move = g.pick(moves);
        assert(
          isLegalMove(s, move),
          "legalDestinations offered an illegal move"
        );
        const next = applySolitaireMove(s, move);
        assert(next !== null, "legal move refused");
        assert(
          next.moves === s.moves + 1 &&
            next.history.length === s.history.length + 1,
          "bookkeeping"
        );
        s = next;
        solitaireCheck(s, `move ${a}`);
        // A random (mostly illegal) move is refused iff isLegalMove says so.
        const kinds: PileRef[] = [
          { kind: "stock" },
          { kind: "waste" },
          { index: g.int(0, 3), kind: "foundation" },
          { index: g.int(0, 6), kind: "tableau" },
        ];
        const random: SolitaireMove = {
          cardIndex: g.int(-1, 12),
          from: g.pick(kinds),
          to: g.pick(kinds),
        };
        assert(
          (applySolitaireMove(s, random) === null) === !isLegalMove(s, random),
          "applyMove/isLegalMove disagree"
        );
      }
    });
  });
});

// ─── cross-code-breaker ────────────────────────────────────────────────────

describe("cross-code-breaker properties", () => {
  /** Brute-force multiset intersection of two digit arrays. */
  const commonDigits = (a: readonly number[], b: readonly number[]) => {
    const rest = [...b];
    let common = 0;
    for (const d of a) {
      const at = rest.indexOf(d);
      if (at !== -1) {
        rest.splice(at, 1);
        common += 1;
      }
    }
    return common;
  };

  test("bulls/cows: bounded, bulls = exact matches, bulls + cows = multiset intersection, symmetric (5000 cases)", () => {
    forAll("code-breaker feedback", 5000, (g) => {
      const length = g.int(1, 6);
      // Small alphabets force repeated digits (the tricky case).
      const alphabet = g.int(1, 10);
      const code = () => Array.from({ length }, () => g.int(0, alphabet - 1));
      const secret = code();
      const guess = g.bool(0.1) ? [...secret] : code();
      const { bulls, cows } = calcBullsCows(secret, guess);
      const exact = secret.filter((d, i) => guess[i] === d).length;
      assert(bulls >= 0 && cows >= 0, "negative feedback");
      assert(bulls + cows <= length, `${bulls}+${cows} > ${length}`);
      assert(bulls === exact, `bulls ${bulls} ≠ exact ${exact}`);
      assert(
        bulls + cows === commonDigits(secret, guess),
        `bulls+cows ${bulls + cows} ≠ intersection | ${secret} vs ${guess}`
      );
      const swapped = calcBullsCows(guess, secret);
      assert(
        swapped.bulls === bulls && swapped.cows === cows,
        "feedback not symmetric"
      );
      if (bulls === length) {
        assert(
          secret.every((d, i) => d === guess[i]),
          "all bulls but codes differ"
        );
      }
    });
  });
});
