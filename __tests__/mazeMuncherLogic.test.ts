import {
  COLS,
  cellAt,
  cellIndex,
  DIRS,
  type Dir,
  HOUSE_EXIT,
  initialDots,
  isScatter,
  MAZE,
  type MazeState,
  newGame,
  PLAYER_START,
  ROWS,
  START_LIVES,
  steer,
  step,
} from "@/games/maze-muncher/logic";

/** Deterministic mulberry32 rng. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const FRAME = 16;
const playerWalkable = (x: number, y: number) => !"#-G".includes(cellAt(x, y));

/** Runs `ms` of game time; returns the final state and every event seen. */
function run(state: MazeState, ms: number, seed = 1) {
  const rng = seeded(seed);
  let s = state;
  const seen = { ateGhost: 0, cleared: 0, died: 0 };
  for (let t = 0; t < ms; t += FRAME) {
    const r = step(s, FRAME, rng);
    s = r.state;
    seen.ateGhost += Number(r.events.ateGhost);
    seen.cleared += Number(r.events.cleared);
    seen.died += Number(r.events.died);
  }
  return { s, seen };
}

/** Ghost-free state: every ghost parked in the house for the whole test. */
const noGhosts = (s: MazeState): MazeState => ({
  ...s,
  ghosts: [],
  lifeMs: -1e9,
});

describe("maze muncher maze", () => {
  test("is 19 × 21, mirrored and closed except for the tunnel row", () => {
    expect(COLS).toBe(19);
    expect(ROWS).toBe(21);
    for (const row of MAZE) {
      expect(row).toHaveLength(COLS);
      expect([...row].reverse().join("")).toBe(row);
    }
    expect(MAZE[0]).toBe("#".repeat(COLS));
    expect(MAZE[ROWS - 1]).toBe("#".repeat(COLS));
    const openEdges = MAZE.map((row, y) => (row[0] === "#" ? null : y)).filter(
      (y) => y !== null
    );
    expect(openEdges).toEqual([9]);
  });

  test("every dot can be reached from the start tile", () => {
    const seen = new Set([cellIndex(PLAYER_START.x, PLAYER_START.y)]);
    const queue = [PLAYER_START];
    while (queue.length > 0) {
      const p = queue.shift() as { x: number; y: number };
      for (const d of Object.values(DIRS)) {
        const x = (p.x + d.x + COLS) % COLS;
        const y = p.y + d.y;
        if (playerWalkable(x, y) && !seen.has(cellIndex(x, y))) {
          seen.add(cellIndex(x, y));
          queue.push({ x, y });
        }
      }
    }
    const { dots, powers } = initialDots();
    expect(dots.size).toBeGreaterThan(150);
    expect(powers.size).toBe(4);
    expect([...dots, ...powers].filter((i) => !seen.has(i))).toEqual([]);
  });
});

describe("maze muncher movement", () => {
  test("the player runs until a wall and scores 10 per dot", () => {
    const start = noGhosts(newGame());
    const { s } = run(steer(start, "right"), 3000);
    // Row 15 runs right from x = 9 to the wall in front of x = 17's power dot.
    expect(s.player.ty).toBe(PLAYER_START.y);
    expect(s.player.dir).toBeNull();
    const eaten = start.dots.size - s.dots.size;
    expect(eaten).toBeGreaterThan(3);
    expect(s.score).toBe(eaten * 10);
  });

  test("reversing mid-tile turns around at once", () => {
    let s = steer(noGhosts(newGame()), "left");
    s = step(s, 60, seeded(1)).state;
    expect(s.player.dir).toBe("left");
    expect(s.player.progress).toBeGreaterThan(0);
    const before = s.player;
    s = steer(s, "right");
    expect(s.player.dir).toBe("right");
    expect(s.player.tx).toBe(before.tx - 1);
    expect(s.player.progress).toBeCloseTo(1 - before.progress);
  });

  test("ghosts leave the house and never stand inside a wall", () => {
    const rng = seeded(7);
    let s = newGame();
    const dirs: Dir[] = ["left", "up", "right", "down"];
    let left = 0;
    for (let t = 0; t < 30_000; t += FRAME) {
      if (t % 1500 === 0) {
        s = steer(s, dirs[Math.floor(rng() * 4)]);
      }
      s = step(s, FRAME, rng).state;
      for (const g of s.ghosts) {
        expect(cellAt(g.tx, g.ty)).not.toBe("#");
      }
      left = Math.max(left, s.ghosts.filter((g) => g.mode !== "house").length);
    }
    expect(left).toBe(4);
  });

  test("scatter and chase alternate on the classic timetable", () => {
    expect(isScatter(0)).toBe(true);
    expect(isScatter(7500)).toBe(false);
    expect(isScatter(27_500)).toBe(true);
    expect(isScatter(10 * 60_000)).toBe(false);
  });
});

describe("maze muncher ghosts and lives", () => {
  test("touching a ghost costs a life and resets the round", () => {
    const s = newGame();
    const ghost = {
      ...s.ghosts[0],
      dir: null,
      tx: PLAYER_START.x,
      ty: PLAYER_START.y,
    };
    const r = step({ ...s, ghosts: [ghost] }, FRAME, seeded(1));
    expect(r.events.died).toBe(true);
    expect(r.events.over).toBe(false);
    expect(r.state.lives).toBe(START_LIVES - 1);
    expect(r.state.ghosts[0]).toMatchObject({
      tx: HOUSE_EXIT.x,
      ty: HOUSE_EXIT.y,
    });
  });

  test("the last life ends the game", () => {
    const s = { ...newGame(), lives: 1 };
    const ghost = {
      ...s.ghosts[0],
      dir: null,
      tx: PLAYER_START.x,
      ty: PLAYER_START.y,
    };
    const r = step({ ...s, ghosts: [ghost] }, FRAME, seeded(1));
    expect(r.events.over).toBe(true);
    expect(r.state.lives).toBe(0);
  });

  test("a power dot frightens every ghost out of the house", () => {
    const s = newGame();
    // Player one step right of the bottom-left power dot at (1, 15).
    const player = { dir: null, progress: 0, tx: 2, ty: 15 };
    let state: MazeState = steer({ ...s, player }, "left");
    let atePower = false;
    for (let t = 0; t < 300 && !atePower; t += FRAME) {
      const r = step(state, FRAME, seeded(3));
      ({ state } = r);
      ({ atePower } = r.events);
    }
    expect(atePower).toBe(true);
    expect(state.powers.has(cellIndex(1, 15))).toBe(false);
    expect(state.frightMs).toBeGreaterThan(5000);
    expect(state.ghosts.map((g) => g.mode)).toEqual([
      "frightened",
      "house",
      "house",
      "house",
    ]);
  });

  test("frightened ghosts are eaten for 200, then 400", () => {
    const s = noGhosts(newGame());
    const ghost = {
      dir: null,
      mode: "frightened" as const,
      progress: 0,
      tx: PLAYER_START.x,
      ty: PLAYER_START.y,
    };
    const r = step(
      { ...s, frightMs: 5000, ghosts: [ghost, { ...ghost }] },
      FRAME,
      seeded(1)
    );
    expect(r.events.ateGhost).toBe(true);
    expect(r.events.died).toBe(false);
    expect(r.state.ghosts.map((g) => g.mode)).toEqual(["eyes", "eyes"]);
    expect(r.state.score).toBe(200 + 400);
  });

  test("eating the last dot clears the level and refills the maze", () => {
    const base = noGhosts(newGame());
    const next = cellIndex(PLAYER_START.x - 1, PLAYER_START.y);
    const s = steer(
      { ...base, dots: new Set([next]), powers: new Set() },
      "left"
    );
    const { s: after, seen } = run(s, 300);
    expect(seen.cleared).toBe(1);
    expect(after.level).toBe(2);
    expect(after.dots.size).toBe(initialDots().dots.size);
    expect(after.score).toBe(10 + 500);
  });
});
