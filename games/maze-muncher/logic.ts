/**
 * Maze Muncher — eat every dot in the maze while four ghosts hunt you.
 * Pure simulation, no React. Tile grid; entities move tile-to-tile and only
 * choose a new direction at tile centres, which keeps movement exact.
 */

export type Dir = "up" | "down" | "left" | "right";
export type Rng = () => number;

/*
 * Left half of the maze (centre column included); the right half mirrors it.
 * "#" wall · "." dot · "o" power dot · " " empty (tunnel) · "-" ghost door · "G" ghost house
 */
const LEFT: readonly string[] = [
  "##########",
  "#........#",
  "#o##.###.#",
  "#.........",
  "#.##.#.###",
  "#....#...#",
  "####.###.#",
  "####.#....",
  "####.#.##-",
  "    ...#GG",
  "####.#.###",
  "####.#....",
  "####.#.###",
  "#........#",
  "#.##.###.#",
  "#o.#......",
  "##.#.#.###",
  "#....#...#",
  "#.######.#",
  "#.........",
  "##########",
];

export const MAZE: readonly string[] = LEFT.map(
  (row) => row + [...row.slice(0, row.length - 1)].reverse().join("")
);
export const ROWS = MAZE.length;
export const COLS = MAZE[0].length;

export const PLAYER_START = { x: 9, y: 15 };
export const DOOR = { x: 9, y: 8 };
/** Tile right above the door, where released ghosts appear. */
export const HOUSE_EXIT = { x: 9, y: 7 };
export const HOUSE_SPOTS = [
  { x: 9, y: 9 },
  { x: 8, y: 9 },
  { x: 10, y: 9 },
  { x: 9, y: 9 },
];
const SCATTER_CORNERS = [
  { x: COLS - 2, y: 1 },
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
  { x: 1, y: ROWS - 2 },
];

export const START_LIVES = 3;
const DOT_POINTS = 10;
const POWER_POINTS = 50;
const GHOST_POINTS = 200;
const LEVEL_BONUS = 500;
/** Ghost i leaves the house this many ms into a life. */
const RELEASE_MS = [0, 2500, 6000, 10_000];
/** Scatter / chase alternation (ms); the last chase lasts forever. */
const MODE_PLAN = [7000, 20_000, 7000, 20_000, 5000];

export const DIRS: Record<Dir, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};
const OPPOSITE: Record<Dir, Dir> = {
  down: "up",
  left: "right",
  right: "left",
  up: "down",
};
/** Tie-break order when two moves are equally good (classic: up, left, down, right). */
const DIR_ORDER: Dir[] = ["up", "left", "down", "right"];

export interface Mover {
  dir: Dir | null;
  /** 0..1 along `dir` from tile (tx, ty) towards the next tile. */
  progress: number;
  tx: number;
  ty: number;
}

export type GhostMode = "house" | "active" | "frightened" | "eyes";

export interface Ghost extends Mover {
  mode: GhostMode;
}

export interface MazeState {
  dots: Set<number>;
  /** Time left (ms) on the current power dot. */
  frightMs: number;
  ghosts: Ghost[];
  /** Ghosts eaten during the current power dot (for 200/400/800/1600). */
  ghostsEaten: number;
  level: number;
  lifeMs: number;
  lives: number;
  player: Mover;
  powers: Set<number>;
  queued: Dir | null;
  score: number;
}

export interface MazeEvents {
  ateDot: boolean;
  ateGhost: boolean;
  atePower: boolean;
  cleared: boolean;
  died: boolean;
  over: boolean;
}

export const cellIndex = (x: number, y: number) => y * COLS + x;
export const cellAt = (x: number, y: number) =>
  y < 0 || y >= ROWS ? "#" : MAZE[y][((x % COLS) + COLS) % COLS];

const wrapX = (x: number) => ((x % COLS) + COLS) % COLS;

function walkable(x: number, y: number, ghostMode?: GhostMode): boolean {
  const c = cellAt(x, y);
  if (c === "#") {
    return false;
  }
  if (c === "-" || c === "G") {
    return ghostMode === "eyes";
  }
  return true;
}

export function initialDots(): { dots: Set<number>; powers: Set<number> } {
  const dots = new Set<number>();
  const powers = new Set<number>();
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (MAZE[y][x] === ".") {
        dots.add(cellIndex(x, y));
      } else if (MAZE[y][x] === "o") {
        powers.add(cellIndex(x, y));
      }
    }
  }
  return { dots, powers };
}

function freshGhosts(): Ghost[] {
  return HOUSE_SPOTS.map((spot, i) => ({
    dir: null,
    mode: i === 0 ? "active" : "house",
    progress: 0,
    tx: i === 0 ? HOUSE_EXIT.x : spot.x,
    ty: i === 0 ? HOUSE_EXIT.y : spot.y,
  }));
}

const startPlayer = (): Mover => ({
  dir: null,
  progress: 0,
  tx: PLAYER_START.x,
  ty: PLAYER_START.y,
});

export function newGame(level = 1): MazeState {
  return {
    ...initialDots(),
    frightMs: 0,
    ghosts: freshGhosts(),
    ghostsEaten: 0,
    level,
    lifeMs: 0,
    lives: START_LIVES,
    player: startPlayer(),
    queued: null,
    score: 0,
  };
}

/** Continuous position (tile units) for drawing and collisions. */
export function position(m: Mover): { x: number; y: number } {
  if (!m.dir) {
    return { x: m.tx, y: m.ty };
  }
  const d = DIRS[m.dir];
  return { x: m.tx + d.x * m.progress, y: m.ty + d.y * m.progress };
}

export const playerSpeed = (level: number) =>
  Math.min(9, 6.5 + 0.3 * (level - 1));
export const ghostSpeed = (level: number) =>
  Math.min(8.6, 5.8 + 0.35 * (level - 1));
const FRIGHT_SPEED = 3.6;
const EYES_SPEED = 13;
export const frightDuration = (level: number) =>
  Math.max(2000, 7000 - 600 * (level - 1));

/** Scatter (true) or chase (false) at `lifeMs` into the current life. */
export function isScatter(lifeMs: number): boolean {
  let t = lifeMs;
  for (let i = 0; i < MODE_PLAN.length; i += 1) {
    if (t < MODE_PLAN[i]) {
      return i % 2 === 0;
    }
    t -= MODE_PLAN[i];
  }
  return false;
}

function ghostTarget(i: number, ghost: Ghost, s: MazeState) {
  if (ghost.mode === "eyes") {
    return HOUSE_SPOTS[0];
  }
  if (isScatter(s.lifeMs)) {
    return SCATTER_CORNERS[i];
  }
  const p = { x: s.player.tx, y: s.player.ty };
  const ahead = DIRS[s.player.dir ?? "left"];
  switch (i) {
    case 1:
      return { x: p.x + ahead.x * 4, y: p.y + ahead.y * 4 };
    case 2: {
      const lead = { x: p.x + ahead.x * 2, y: p.y + ahead.y * 2 };
      const [red] = s.ghosts;
      return { x: 2 * lead.x - red.tx, y: 2 * lead.y - red.ty };
    }
    case 3:
      return Math.hypot(ghost.tx - p.x, ghost.ty - p.y) > 8
        ? p
        : SCATTER_CORNERS[3];
    default:
      return p;
  }
}

function chooseGhostDir(
  i: number,
  g: Ghost,
  s: MazeState,
  rng: Rng
): Dir | null {
  const options = DIR_ORDER.filter((d) => {
    if (g.dir && d === OPPOSITE[g.dir]) {
      return false;
    }
    const v = DIRS[d];
    return walkable(g.tx + v.x, g.ty + v.y, g.mode);
  });
  if (options.length === 0) {
    return g.dir ? OPPOSITE[g.dir] : null;
  }
  if (g.mode === "frightened") {
    return options[Math.floor(rng() * options.length)];
  }
  const target = ghostTarget(i, g, s);
  let [best] = options;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const d of options) {
    const v = DIRS[d];
    const dist = (g.tx + v.x - target.x) ** 2 + (g.ty + v.y - target.y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/**
 * Moves an entity `distance` tiles. `decide` picks the direction at every
 * tile centre; `onCentre` fires on arriving at a tile.
 */
function advance(
  m: Mover,
  distance: number,
  decide: (m: Mover) => Dir | null,
  onCentre: (m: Mover) => void
): Mover {
  let next = { ...m };
  let left = distance;
  for (let guard = 0; guard < 8 && left > 0; guard += 1) {
    if (next.progress === 0) {
      const dir = decide(next);
      if (!dir) {
        return { ...next, dir: null };
      }
      next = { ...next, dir };
    }
    const dir = next.dir as Dir;
    const room = 1 - next.progress;
    if (left < room) {
      return { ...next, progress: next.progress + left };
    }
    left -= room;
    const v = DIRS[dir];
    next = {
      ...next,
      progress: 0,
      tx: wrapX(next.tx + v.x),
      ty: next.ty + v.y,
    };
    onCentre(next);
  }
  return next;
}

function resetAfterDeath(s: MazeState): MazeState {
  return {
    ...s,
    frightMs: 0,
    ghosts: freshGhosts(),
    ghostsEaten: 0,
    lifeMs: 0,
    player: startPlayer(),
    queued: null,
  };
}

/** Sets the direction the player wants; reverses at once, turns at the next centre. */
export function steer(s: MazeState, dir: Dir): MazeState {
  const p = s.player;
  if (p.dir && dir === OPPOSITE[p.dir] && p.progress > 0) {
    const v = DIRS[p.dir];
    return {
      ...s,
      player: {
        dir,
        progress: 1 - p.progress,
        tx: wrapX(p.tx + v.x),
        ty: p.ty + v.y,
      },
      queued: dir,
    };
  }
  return { ...s, queued: dir };
}

export function step(
  state: MazeState,
  dtMs: number,
  rng: Rng
): { events: MazeEvents; state: MazeState } {
  const events: MazeEvents = {
    ateDot: false,
    ateGhost: false,
    atePower: false,
    cleared: false,
    died: false,
    over: false,
  };
  const dt = Math.min(dtMs, 50) / 1000;
  const s: MazeState = {
    ...state,
    dots: state.dots,
    ghosts: [...state.ghosts],
    lifeMs: state.lifeMs + dt * 1000,
    powers: state.powers,
  };
  let frightMs = Math.max(0, state.frightMs - dt * 1000);
  let { score, ghostsEaten } = state;
  let { dots, powers } = s;

  // Player
  s.player = advance(
    s.player,
    playerSpeed(s.level) * dt,
    (m) => {
      for (const d of [s.queued, m.dir]) {
        if (d && walkable(m.tx + DIRS[d].x, m.ty + DIRS[d].y)) {
          return d;
        }
      }
      return null;
    },
    (m) => {
      const i = cellIndex(m.tx, m.ty);
      if (dots.has(i)) {
        dots = new Set(dots);
        dots.delete(i);
        score += DOT_POINTS;
        events.ateDot = true;
      } else if (powers.has(i)) {
        powers = new Set(powers);
        powers.delete(i);
        score += POWER_POINTS;
        events.atePower = true;
        frightMs = frightDuration(s.level);
        ghostsEaten = 0;
      }
    }
  );

  // Ghosts
  s.ghosts = s.ghosts.map((g0, i) => {
    let g = g0;
    if (g.mode === "house") {
      if (s.lifeMs < RELEASE_MS[i]) {
        return g;
      }
      g = {
        ...g,
        dir: null,
        mode: "active",
        progress: 0,
        tx: HOUSE_EXIT.x,
        ty: HOUSE_EXIT.y,
      };
    }
    if (events.atePower && g.mode === "active") {
      g = { ...g, mode: "frightened" };
      if (g.dir && g.progress > 0) {
        const v = DIRS[g.dir];
        g = {
          ...g,
          dir: OPPOSITE[g.dir],
          progress: 1 - g.progress,
          tx: wrapX(g.tx + v.x),
          ty: g.ty + v.y,
        };
      }
    }
    if (g.mode === "frightened" && frightMs === 0) {
      g = { ...g, mode: "active" };
    }
    let speed = ghostSpeed(s.level);
    if (g.mode === "frightened") {
      speed = FRIGHT_SPEED;
    } else if (g.mode === "eyes") {
      speed = EYES_SPEED;
    }
    const moved = advance(
      g,
      speed * dt,
      (m) => chooseGhostDir(i, { ...g, ...m }, s, rng),
      () => undefined
    );
    let next: Ghost = { ...moved, mode: g.mode };
    if (
      next.mode === "eyes" &&
      next.progress === 0 &&
      next.tx === HOUSE_SPOTS[0].x &&
      next.ty === HOUSE_SPOTS[0].y
    ) {
      // Back home: come straight out again.
      next = {
        dir: null,
        mode: "active",
        progress: 0,
        tx: HOUSE_EXIT.x,
        ty: HOUSE_EXIT.y,
      };
    }
    return next;
  });

  // Collisions
  const pp = position(s.player);
  for (let i = 0; i < s.ghosts.length; i += 1) {
    const g = s.ghosts[i];
    if (g.mode === "house" || g.mode === "eyes") {
      continue;
    }
    const gp = position(g);
    if (Math.abs(gp.x - pp.x) + Math.abs(gp.y - pp.y) > 0.7) {
      continue;
    }
    if (g.mode === "frightened") {
      ghostsEaten += 1;
      score += GHOST_POINTS * 2 ** (ghostsEaten - 1);
      events.ateGhost = true;
      s.ghosts[i] = { ...g, mode: "eyes" };
    } else {
      events.died = true;
    }
  }

  let next: MazeState = { ...s, dots, frightMs, ghostsEaten, powers, score };
  if (events.died) {
    const lives = next.lives - 1;
    events.over = lives <= 0;
    next = { ...resetAfterDeath(next), lives };
  } else if (dots.size === 0 && powers.size === 0) {
    events.cleared = true;
    next = {
      ...resetAfterDeath(next),
      ...initialDots(),
      level: next.level + 1,
      score: next.score + LEVEL_BONUS * next.level,
    };
  }
  return { events, state: next };
}
