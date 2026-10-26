/**
 * The game smoke suite (specs + drivers); see `__tests__/gamesSmoke.test.ts`.
 * Test files import `./gameMocks` first, then call `defineGamesSmoke`.
 */
import { StyleSheet } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { type GameDefinition, gameRegistry } from "@/data/games";
import { SCRAMBLE_WORDS } from "@/games/word-scramble/words";
import { CLASSIC_WORDS } from "@/games/word-search/words";
import {
  FORWARD,
  type Harness,
  labelOf,
  type MonkeyOptions,
  mountGame,
  must,
  nodeText,
  repeat,
  seeded,
  touchEvent,
} from "./gameHarness";
import {
  findMatchSwap,
  findWord,
  solveLightsOut,
  solveSlidingPuzzle,
  solveStackSort,
  solveSudoku,
} from "./gameSolvers";

type Node = ReactTestInstance;
const styleOf = (n: Node) => StyleSheet.flatten(n.props.style) ?? {};
const param = (label: string, key: string) =>
  Number(new RegExp(`${key}=(\\d+)`).exec(label)?.[1] ?? Number.NaN);

const MEMORY_CONTROLS = /^memoryMode|^newGame/;
const STACK_COLUMN = /^#\d+/;
const STACK_GOAL = /^stackSortGoal/;
const EF_NEXT = /^efNextRound|^efSeeResult/;
const CAPITAL_LETTER = /^\p{Lu}$/u;
const DIGITS_OR_BLANK = /^\d*$/;
const WS_CLASSIC = /^wsModeClassic/;
const HM_NEXT = /^hmNextRound|^hmSeeResult/;
const RADAR_CELL = /^[A-Z]\d+$/;
const LEVEL_ONE = /^levelLabel\(level=1\)/;
const GRID_CELL = /^a11yRowCol/;
const RJ_PIECE = /^rjamA11y(Plane|Vehicle)/;
const SM_TILE = /a11yRowCol\(/;
const MJ_EASY = /^mjLayoutEasy/;
const MJ_TILE = /^mjA11yTile/;

/** Runs `body` up to `times` times, sequentially, until the game recorded a result. */
const untilEnd = (h: Harness, times: number, body: (i: number) => unknown) =>
  repeat(times, (i) => (h.calls.length > 0 ? false : body(i)));

/* ------------------------------------------------------------ drivers */

/** Remembers every revealed face and flips known pairs. */
async function playMemory(h: Harness) {
  const cards = () => h.findAll((l) => !MEMORY_CONTROLS.test(l));
  const known = new Map<number, string>();
  const flip = (i: number) => {
    h.pressNode(cards()[i]);
    const card = cards()[i]; // gone once the result screen replaces the board
    const face = card ? nodeText(card) : "?";
    if (face !== "?") {
      known.set(i, face);
    }
  };
  await untilEnd(h, 60, async () => {
    const hidden = cards()
      .map((c, i) => (nodeText(c) === "?" ? i : -1))
      .filter((i) => i >= 0);
    const partnerOf = (a: number) =>
      hidden.find(
        (b) => b !== a && known.has(b) && known.get(b) === known.get(a)
      );
    const knownPair = hidden.find(
      (a) => known.has(a) && partnerOf(a) !== undefined
    );
    const first = knownPair ?? hidden.find((i) => !known.has(i)) ?? hidden[0];
    flip(first);
    const second =
      partnerOf(first) ?? hidden.find((i) => i !== first && !known.has(i));
    if (second !== undefined) {
      flip(second);
    }
    await h.advance(1000);
  });
}

/** Taps only when the pad says "tap" (never during the random wait). */
function playReaction(h: Harness) {
  return untilEnd(h, 400, async () => {
    if (!h.press("reactionTap")) {
      h.press("reactionTapToStart");
    }
    await h.advance(100, 100);
  });
}

/** Lights Out: solves each round over GF(2) from the on/off cell states. */
async function playCabinLights(h: Harness) {
  h.press("gameTapToStart");
  await untilEnd(h, 6, async () => {
    const cells = h.findAll("💡");
    const size = Math.round(Math.sqrt(cells.length));
    const on = cells.map((c) => c.props.accessibilityState?.selected === true);
    for (const i of solveLightsOut(on, size)) {
      h.pressNode(h.findAll("💡")[i]);
    }
    await h.advance(1000);
    h.press("cabinLightsNextRound");
    await h.advance(500);
  });
}

/** Stack Sort level 1, solved by BFS over the columns read from the labels. */
async function playStackSort(h: Harness) {
  h.press("Level 1");
  await h.advance(500);
  const columns = h
    .findAll(STACK_COLUMN)
    .map((n) => labelOf(n).split(" ").slice(1).map(Number));
  const total = columns.flat().length;
  const moves = must(solveStackSort(columns, 0, total, 5), "stack-sort plan");
  const column = (i: number) => (l: string) => l.split(" ")[0] === `#${i + 1}`;
  await repeat(moves.length, async (k) => {
    const [from, to] = moves[k];
    h.press(column(from));
    h.press(to === -1 ? STACK_GOAL : column(to));
    await h.advance(100, 100);
  });
  await h.advance(1000);
}

/** Taps the emoji shown in the "Find" card until the match is over. */
async function playEmojiFind(h: Harness) {
  h.press("start");
  await untilEnd(h, 800, async () => {
    let [card] = h.r.root.findAll(
      (n) => n.type === "Text" && n.props.children === "efFind"
    );
    while (card?.parent && nodeText(card) === "efFind") {
      card = card.parent;
    }
    const target = card ? nodeText(card).replace("efFind", "").trim() : "";
    if (!((target && h.press(target)) || h.press("efGo"))) {
      h.press(EF_NEXT);
    }
    await h.advance(500, 500);
  });
}

/** Unscrambles each word (anagram lookup in the word list) and types it. */
async function playWordScramble(h: Harness) {
  h.press("gameTapToStart");
  await untilEnd(h, 14, async () => {
    await h.advance(500);
    const sorted = h.findAll(CAPITAL_LETTER).map(labelOf).sort().join("");
    const word = SCRAMBLE_WORDS.en.find(
      (w) => [...w].sort().join("") === sorted
    );
    for (const ch of word ?? []) {
      h.press(ch);
    }
    await h.advance(word ? 2000 : 31_000, 500);
  });
}

/** Sudoku (easy): reads the 81 cells, backtracking-solves, types the answer. */
async function playSudoku(h: Harness) {
  h.press("gameTapToStart");
  must(h.press("sdkEasy"), "sudoku difficulty");
  await h.advance(500);
  const grid = h.r.root.find(
    (n) => n.type === "View" && n.children.length === 81
  );
  const cells = () => grid.children as Node[];
  // Numpad row: 1–9 plus erase.
  const pad = h.r.root.find(
    (n) =>
      n.type === "View" &&
      n.children.length === 10 &&
      (n.children as Node[]).every((c) => typeof c.props.onPress === "function")
  ).children as Node[];
  const digit = (v: number) =>
    must(
      pad.find((c) => nodeText(c) === String(v)),
      `numpad ${v}`
    );
  const board = cells().map((c) => Number(nodeText(c)) || 0);
  const solved = must(solveSudoku(board), "sudoku solution");
  board.forEach((v, i) => {
    if (v === 0 && h.calls.length === 0) {
      h.pressNode(cells()[i]);
      h.pressNode(digit(solved[i]));
    }
  });
  await h.advance(1000);
}

/** 15-puzzle: reads the tiles, weighted-A* solves, taps the path. */
async function playSlidingPuzzle(h: Harness) {
  h.press("gameTapToStart");
  await h.advance(4000); // 3-2-1-GO
  const tiles = () =>
    h.r.root
      .findAll((n) => n.type === "View" && n.children.length === 4)
      .filter((row) =>
        (row.children as Node[]).every(
          (c) =>
            typeof c.props.onPress === "function" &&
            DIGITS_OR_BLANK.test(nodeText(c))
        )
      )
      .flatMap((row) => row.children as Node[]);
  const board = tiles().map((n) => Number(nodeText(n)) || 0);
  must(board.length === 16, "4×4 board");
  for (const i of must(solveSlidingPuzzle(board, 4), "15-puzzle path")) {
    h.pressNode(tiles()[i]);
  }
  await h.advance(1000);
}

/** Word Search (classic): finds every listed word in the grid and drags it. */
async function playWordSearch(h: Harness) {
  h.press(WS_CLASSIC);
  await h.advance(500);
  const [board] = h.gestureViews();
  const cellViews = board.findAll((n) => {
    const st = styleOf(n);
    return (
      n.type === "View" &&
      typeof st.height === "number" &&
      st.height === st.width &&
      nodeText(n).length === 1
    );
  });
  const grid = cellViews.map((n) => nodeText(n));
  const size = Math.round(Math.sqrt(grid.length));
  const pitch = Number(styleOf(cellViews[0]).height) + 3; // + GAP
  const at = (i: number) =>
    touchEvent(
      (i % size) * pitch + pitch / 2,
      Math.floor(i / size) * pitch + pitch / 2
    );
  for (const word of CLASSIC_WORDS.en) {
    const line = findWord(grid, size, word);
    if (line && h.calls.length === 0) {
      h.act(() => {
        board.props.onResponderGrant(at(line[0]));
        board.props.onResponderRelease(at(line[1]));
      });
    }
  }
  await h.advance(1000);
}

const HANDOFF = [...FORWARD, "efGo", "arReady", "passPhone", HM_NEXT];

/** Code Breaker: four random digits + Check per guess; hand-offs in between. */
function playCodeBreaker(h: Harness) {
  return untilEnd(h, 2400, async () => {
    if (h.has("cbCheck") || h.has("1")) {
      for (let k = 0; k < 4; k += 1) {
        h.press(String(Math.floor(h.rnd() * 10)));
      }
      h.press("cbCheck");
    } else {
      HANDOFF.some((m) => h.press(m));
    }
    await h.advance(250);
  });
}

/** Air Radar: hunt/target shots (random empty cell, neighbours of hits first). */
function playAirRadar(h: Harness) {
  const near = (a: string, b: string) =>
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) +
      Math.abs(Number(a.slice(1)) - Number(b.slice(1))) ===
    1;
  return untilEnd(h, 2400, async () => {
    // Hand-offs first, then the unlabeled "skip turn delay" badge.
    if (!(HANDOFF.some((m) => h.press(m)) || h.press(""))) {
      const cells = h.findAll((l) => RADAR_CELL.test(l));
      const hits = cells.filter((n) => nodeText(n) === "✕").map(labelOf);
      const open = cells.filter((n) => nodeText(n) === "");
      const targets = open.filter((n) => hits.some((x) => near(x, labelOf(n))));
      const pool = targets.length > 0 ? targets : open;
      const pick = pool[Math.floor(h.rnd() * pool.length)];
      if (pick) {
        h.pressNode(pick);
      }
    }
    await h.advance(250);
  });
}

/** Level 1, then the hint button until the level is solved. */
const hintSolver =
  (hint: string, maxHints = 200) =>
  async (h: Harness) => {
    h.press(LEVEL_ONE);
    await h.advance(500);
    await untilEnd(h, maxHints, async () => {
      must(h.press(hint), `${hint} button`);
      await h.advance(100, 100);
    });
    await h.advance(1000);
  };

/** Runway Jam: hint → tap the dashed piece → tap its target leading cell. */
async function playRunwayJam(h: Harness) {
  h.press(LEVEL_ONE);
  await h.advance(500);
  const cells = () => h.findAll(GRID_CELL);
  const cellAt = (row: number, col: number) =>
    must(
      cells().find((c) => {
        const l = labelOf(c);
        return param(l, "row") === row + 1 && param(l, "col") === col + 1;
      }),
      `cell ${row},${col}`
    );
  const c0 = styleOf(cellAt(0, 0));
  const step = Number(styleOf(cellAt(0, 1)).left) - Number(c0.left);
  const pad = Number(c0.left);
  const gap = step - Number(c0.width);
  await untilEnd(h, 80, async () => {
    h.press("hint");
    const piece = must(
      h.find((l, n) => RJ_PIECE.test(l) && styleOf(n).borderStyle === "dashed"),
      "hinted piece"
    );
    const hintCell = must(
      cells().find((n) => styleOf(n).borderStyle === "dashed"),
      "hinted cell"
    );
    const ps = styleOf(piece);
    const row = Math.round((Number(ps.top) - pad) / step);
    const col = Math.round((Number(ps.left) - pad) / step);
    const horiz = Number(ps.width) > Number(ps.height);
    const len = Math.round(
      ((horiz ? Number(ps.width) : Number(ps.height)) + gap) / step
    );
    const hl = labelOf(hintCell);
    const toRow = param(hl, "row") - 1;
    const toCol = param(hl, "col") - 1;
    h.pressNode(piece);
    // Tap the cell the piece's leading edge must reach.
    if (horiz) {
      h.pressNode(cellAt(row, toCol > col ? toCol + len - 1 : toCol));
    } else {
      h.pressNode(cellAt(toRow > row ? toRow + len - 1 : toRow, col));
    }
    await h.advance(250);
  });
  await h.advance(1000);
}

/** Sky Match: swap a pair that lines up three, until the moves run out. */
async function playSkyMatch(h: Harness) {
  h.press(LEVEL_ONE);
  await h.advance(500);
  await untilEnd(h, 40, async () => {
    const kinds = new Array<string | null>(64).fill(null);
    const nodes = new Array<Node | undefined>(64);
    for (const n of h.findAll(SM_TILE)) {
      const l = labelOf(n);
      const idx = (param(l, "row") - 1) * 8 + param(l, "col") - 1;
      const [kind] = l.split(",");
      kinds[idx] = kind === "smA11yStar" ? null : kind;
      nodes[idx] = n;
    }
    const [i, j] = findMatchSwap(kinds, 8) ?? [0, 1];
    const [a, b] = [nodes[i], nodes[j]];
    if (a && b) {
      h.pressNode(a);
      h.pressNode(b);
    }
    // Wait for the cascade to settle (screen stops changing).
    let before = "";
    await repeat(12, async () => {
      if (h.screen() === before) {
        return false;
      }
      before = h.screen();
      await h.advance(400, 400);
    });
  });
}

/** Mahjong: hint, tap the two hinted tiles; shuffle when stuck. */
async function playMahjong(h: Harness) {
  h.press(MJ_EASY);
  await h.advance(500);
  const tiles = () => h.findAll(MJ_TILE);
  await untilEnd(h, 80, async () => {
    h.press("mjHint");
    const hinted = tiles()
      .map((n, idx) => (labelOf(n).includes("mjA11yHinted") ? idx : -1))
      .filter((idx) => idx >= 0);
    if (hinted.length < 2) {
      h.press("mjShuffle");
    } else {
      h.pressNode(tiles()[hinted[0]]);
      h.pressNode(tiles()[hinted[1]]);
    }
    await h.advance(500);
  });
}

/* -------------------------------------------------------------- specs */

interface Spec {
  /** Game-time budget for the generic monkey (ms). */
  budget?: number;
  driver?: (h: Harness) => Promise<void>;
  /** false: the run has no end reachable by a test driver (reason in `note`). */
  ends?: boolean;
  /** Known bug: the case is expected to fail until fixed (test.failing). */
  knownBug?: string;
  monkey?: MonkeyOptions;
  note?: string;
  /** Rough runtime in seconds (default 1), only used to balance the shards. */
  weight?: number;
}

const SPECS: Record<string, Spec> = {
  "air-traffic-control": {},
  "box-breaker": { budget: 240_000, monkey: { swipeChance: 0.5 } },
  "cabin-call": {},
  "cabin-lights": { driver: playCabinLights },
  "cargo-blocks": { budget: 240_000, weight: 2 },
  "cargo-catch": {},
  "category-blitz": { budget: 300_000, weight: 3 },
  "color-clash": {},
  "cross-air-radar": { driver: playAirRadar, weight: 5 },
  "cross-code-breaker": { driver: playCodeBreaker, weight: 6 },
  "cross-liars-dice": {},
  "duel-connect4": {},
  "duel-dice": {},
  "duel-emoji-find": { driver: playEmojiFind, weight: 6 },
  "duel-hangman": {},
  "duel-tictactoe": {},
  "emoji-story": {},
  "flight-path": {},
  "higher-lower": {},
  mahjong: { driver: playMahjong },
  "maze-muncher": { monkey: { swipeChance: 0.3 }, weight: 3 },
  memory: { driver: playMemory },
  minesweeper: {},
  nonogram: { driver: hintSolver("hint") },
  "odd-one-out": {},
  quiz: {},
  reaction: { driver: playReaction },
  "runway-jam": { driver: playRunwayJam },
  "runway-landing": {},
  "seat-neighbor": {},
  "simon-says": {},
  "sky-defense": {
    budget: 300_000,
    monkey: { avoid: ["Set 1x speed"], stepMs: 1000 },
  },
  "sky-match": { driver: playSkyMatch, weight: 7 },
  "sky-math": { monkey: { avoid: ["difficulty"] } },
  "sliding-puzzle": { driver: playSlidingPuzzle },
  snake: { monkey: { swipeChance: 0.3 } },
  solitaire: {
    budget: 60_000,
    ends: false,
    note: "Klondike: a win needs a full solver and many deals are unwinnable; a loss is only recorded on resign. Smoke = taps/draws change the board.",
  },
  "split-duel": {},
  "stack-sort": { driver: playStackSort },
  sudoku: { driver: playSudoku, weight: 3 },
  "sun-moon": { driver: hintSolver("hint") },
  "tilt-balance": {},
  "twenty-forty-eight": { monkey: { stepMs: 250, swipeChance: 0.8 } },
  "whack-mole": {},
  "word-guess": {},
  "word-scramble": { driver: playWordScramble },
  "word-search": { driver: playWordSearch },
};

/* -------------------------------------------------------------- suite */

interface SmokeSummary {
  /** updateProgress calls right after the driver finished. */
  callsAtEnd: number;
  /** console.error messages (React warnings, crashes in effects …). */
  consoleErrors: string[];
  /** The rendered output changed at least twice (the game reacts / runs). */
  progressed: boolean;
  /** Game ids of every updateProgress call, incl. 5 s of idle afterwards. */
  recorded: string[];
}

async function smoke(def: GameDefinition, spec: Spec): Promise<SmokeSummary> {
  jest.spyOn(Math, "random").mockImplementation(seeded(7));
  const errors = jest.spyOn(console, "error");
  const h = mountGame(def.loadComponent(), 42);
  let callsAtEnd = -1;
  try {
    h.snapshot();
    if (spec.driver) {
      await spec.driver(h);
    } else {
      await h.monkey(spec.budget ?? 120_000, spec.monkey);
    }
    callsAtEnd = h.calls.length;
    // Let pending timers / effects settle without input: no second record.
    await h.advance(5000, 500);
    h.snapshot();
  } finally {
    h.unmount();
  }
  return {
    callsAtEnd,
    consoleErrors: errors.mock.calls.map((c) => String(c[0]).slice(0, 300)),
    progressed: h.distinctFrames() >= 3,
    recorded: h.calls.map((c) => String(c[0])),
  };
}

const TIMEOUT_MS = 30_000;

/** Greedy (heaviest first) split of the registry into `shards` balanced lists. */
function shardGames(shards: number): GameDefinition[][] {
  const out = Array.from({ length: shards }, () => ({
    games: [] as GameDefinition[],
    load: 0,
  }));
  const weight = (g: GameDefinition) => SPECS[g.id]?.weight ?? 1;
  const byWeight = [...gameRegistry].sort((a, b) => weight(b) - weight(a));
  for (const g of byWeight) {
    const lightest = out.reduce((m, s) => (s.load < m.load ? s : m));
    lightest.games.push(g);
    lightest.load += weight(g);
  }
  // Keep registry order inside a shard for readable output.
  return out.map((s) => gameRegistry.filter((g) => s.games.includes(g)));
}

/**
 * Registers the smoke tests for every `shards`-th game starting at `shard`
 * (the suite is split over several test files so Jest runs them in parallel).
 */
export function defineGamesSmoke(shard: number, shards: number) {
  // Fixed wall clock: daily puzzles / date-seeded content stay reproducible.
  beforeEach(() =>
    jest.useFakeTimers({ now: new Date("2026-03-10T09:00:00Z") })
  );
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  if (shard === 0) {
    test("every registered game has a smoke spec", () => {
      expect(gameRegistry.map((g) => g.id).sort()).toEqual(
        Object.keys(SPECS).sort()
      );
    });
  }

  const games = shardGames(shards)[shard];
  describe.each(games.map((g) => [g.id, g] as const))("%s", (id, def) => {
    const spec: Spec = SPECS[id] ?? {};
    const ends = spec.ends ?? true;
    const expected: SmokeSummary = {
      callsAtEnd: ends ? 1 : 0,
      consoleErrors: [],
      progressed: true,
      recorded: ends ? [id] : [],
    };
    const title = ends
      ? "renders, gets past setup, makes progress and records the result once"
      : "renders, gets past setup and makes progress";
    if (spec.knownBug) {
      test.failing(
        `${title} — KNOWN BUG: ${spec.knownBug}`,
        async () => {
          expect(await smoke(def, spec)).toEqual(expected);
        },
        TIMEOUT_MS
      );
    } else {
      test(
        title,
        async () => {
          expect(await smoke(def, spec)).toEqual(expected);
        },
        TIMEOUT_MS
      );
    }
  });
}
