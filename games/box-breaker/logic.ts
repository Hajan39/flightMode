/**
 * Box Breaker (Breakout / Arkanoid) — pure simulation, no React.
 *
 * World units: the field is FIELD_W wide and FIELD_H tall, origin top-left,
 * y grows downwards (same as screen layout). The view scales it to pixels.
 */

export const FIELD_W = 1;
export const FIELD_H = 1.4;
export const COLS = 8;
export const BRICK_TOP = 0.1;
export const BRICK_H = 0.05;
export const BRICK_GAP = 0.006;
export const BRICK_W = FIELD_W / COLS;
export const PADDLE_Y = 1.3;
export const PADDLE_H = 0.028;
export const PADDLE_W = 0.22;
export const WIDE_PADDLE_W = 0.34;
export const BALL_R = 0.016;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
const BASE_SPEED = 0.8;
const MAX_SPEED = 1.35;
/** Each paddle hit speeds the ball up a little, up to +25 %, reset per life. */
const BOOST_PER_HIT = 0.012;
const MAX_BOOST = 1.25;
const DROP_SPEED = 0.35;
const DROP_CHANCE = 0.12;
const WIDE_MS = 12_000;
const FIRE_MS = 7000;
/** Steepest bounce off the paddle, measured from vertical. */
const MAX_BOUNCE = (65 * Math.PI) / 180;
/** How much a moving paddle bends the bounce ("english"), and its cap. */
const ENGLISH = 0.16;
const MAX_ENGLISH = 0.4;
const POINTS_PER_HIT = 10;
const LEVEL_BONUS = 100;

/** hp > 0 breakable, STEEL never breaks, 0 empty. */
export const STEEL = -1;

export type BrickKind = "normal" | "steel" | "bomb" | "mystery";
export type PowerKind = "wide" | "multi" | "life" | "fire";
export type Rng = () => number;

export interface Ball {
  stuck: boolean;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface Drop {
  kind: PowerKind;
  x: number;
  y: number;
}

export interface BreakerState {
  balls: Ball[];
  /** Speed multiplier earned by paddle hits this life. */
  boost: number;
  bricks: number[];
  drops: Drop[];
  /** Wall-clock ms until which balls burn through boxes (0 = off). */
  fireUntil: number;
  kinds: BrickKind[];
  level: number;
  lives: number;
  /** Hits each box needed when the level began (for the damage pips). */
  maxHp: number[];
  paddleAt: number;
  /** Paddle velocity in field widths / s, smoothed; drives the english. */
  paddleVx: number;
  paddleX: number;
  score: number;
  /** Wall-clock ms until which the paddle is wide (0 = normal). */
  wideUntil: number;
}

export interface StepEvents {
  broken: number;
  /** Indexes of boxes destroyed this step (for debris). */
  brokenAt: number[];
  cleared: boolean;
  exploded: boolean;
  /** Indexes of boxes hit this step (for the flash). */
  hitAt: number[];
  lostLife: boolean;
  over: boolean;
  paddle: boolean;
  power: PowerKind | null;
}

/*
 * Levels: one string per box row, COLS chars each.
 * "." empty · "1"–"3" hits needed · "#" steel · "B" bomb · "?" mystery (always drops a power-up)
 * Steel walls carve corridors the ball has to find its way through.
 */
export const LEVELS: readonly (readonly string[])[] = [
  ["11111111", "1?1111?1", "11111111", "22222222"],
  ["22222222", "1B1111B1", "11111111", "111BB111", "11111111"],
  ["3.3.3.3.", ".2.2.2.2", "1?1?1?1?", ".1.1.1.1"],
  [
    "...33...",
    "..3223..",
    ".321123.",
    "32B??B23",
    ".321123.",
    "..3223..",
    "...33...",
  ],
  ["33333333", "22222222", "###..###", "1B1111B1", "11111111"],
  ["33333333", "22222222", "#..##..#", "1?1111?1", "11111111"],
  [
    "########",
    "#?3333?#",
    "#3BBBB3#",
    "#333333#",
    "###..###",
    "11111111",
    "11111111",
  ],
  ["B2B2B2B2", "11111111", "2B2B2B2B", "11111111", "33333333"],
  ["3#....#3", "3#.??.#3", "3#.22.#3", "3#.22.#3", "2#1111#2", "11111111"],
  ["33333333", "3######3", "3#????#3", "3#....#3", "3##..##3", "22222222"],
  ["BBBBBBBB", "22222222", "B2B22B2B", "33333333", "11111111"],
  ["3##33##3", "?3?33?3?", "#2#BB#2#", "22222222", "1#1..1#1", "11111111"],
];

export const brickIndex = (row: number, col: number) => row * COLS + col;

export function parseLevel(level: number): {
  bricks: number[];
  kinds: BrickKind[];
} {
  const rows = LEVELS[(level - 1) % LEVELS.length];
  const bricks: number[] = [];
  const kinds: BrickKind[] = [];
  for (const row of rows) {
    for (const ch of row) {
      if (ch === "#") {
        bricks.push(STEEL);
        kinds.push("steel");
      } else if (ch === ".") {
        bricks.push(0);
        kinds.push("normal");
      } else if (ch === "B") {
        bricks.push(1);
        kinds.push("bomb");
      } else if (ch === "?") {
        bricks.push(1);
        kinds.push("mystery");
      } else {
        bricks.push(Number(ch));
        kinds.push("normal");
      }
    }
  }
  return { bricks, kinds };
}

/** Speed grows 5 % per level and keeps growing after the layouts repeat. */
export function ballSpeed(level: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED * 1.05 ** (level - 1));
}

export const paddleWidth = (state: BreakerState, now: number) =>
  now < state.wideUntil ? WIDE_PADDLE_W : PADDLE_W;

function stuckBall(paddleX: number): Ball {
  return {
    stuck: true,
    vx: 0,
    vy: 0,
    x: paddleX,
    y: PADDLE_Y - BALL_R - 0.001,
  };
}

function levelBoxes(level: number) {
  const { bricks, kinds } = parseLevel(level);
  return { bricks, kinds, maxHp: [...bricks] };
}

export function newGame(level = 1): BreakerState {
  return {
    ...levelBoxes(level),
    balls: [stuckBall(FIELD_W / 2)],
    boost: 1,
    drops: [],
    fireUntil: 0,
    level,
    lives: START_LIVES,
    paddleAt: 0,
    paddleVx: 0,
    paddleX: FIELD_W / 2,
    score: 0,
    wideUntil: 0,
  };
}

/**
 * Power-up timers are wall-clock deadlines, so a pause would silently burn
 * them. On resume, push every active deadline back by the paused duration.
 * 0 (= off) stays 0; a deadline that had already passed stays in the past.
 */
export function shiftDeadlines(
  state: BreakerState,
  pausedMs: number
): BreakerState {
  if (pausedMs <= 0) {
    return state;
  }
  const shift = (until: number) => (until > 0 ? until + pausedMs : 0);
  return {
    ...state,
    fireUntil: shift(state.fireUntil),
    wideUntil: shift(state.wideUntil),
  };
}

export const isCleared = (bricks: number[]) => !bricks.some((hp) => hp > 0);

/** Launches every ball resting on the paddle, slightly off-vertical. */
export function launch(state: BreakerState, rng: Rng): BreakerState {
  const speed = ballSpeed(state.level) * state.boost;
  return {
    ...state,
    balls: state.balls.map((b) => {
      if (!b.stuck) {
        return b;
      }
      const angle = (rng() - 0.5) * 0.6 + state.paddleVx * ENGLISH * 0.5;
      return {
        ...b,
        stuck: false,
        vx: speed * Math.sin(angle),
        vy: -speed * Math.cos(angle),
      };
    }),
  };
}

/** Moves the paddle centre (kept inside the field) and tracks its velocity. */
export function movePaddle(
  state: BreakerState,
  x: number,
  now: number
): BreakerState {
  const half = paddleWidth(state, now) / 2;
  const paddleX = Math.min(FIELD_W - half, Math.max(half, x));
  const dt = Math.max(8, now - state.paddleAt) / 1000;
  const instant = dt > 0.2 ? 0 : (paddleX - state.paddleX) / dt;
  return {
    ...state,
    balls: state.balls.map((b) => (b.stuck ? { ...b, x: paddleX } : b)),
    paddleAt: now,
    paddleVx: state.paddleVx * 0.5 + instant * 0.5,
    paddleX,
  };
}

function brickAt(x: number, y: number): number {
  const row = Math.floor((y - BRICK_TOP) / BRICK_H);
  const col = Math.floor(x / BRICK_W);
  if (y < BRICK_TOP || row < 0 || col < 0 || col >= COLS) {
    return -1;
  }
  return brickIndex(row, col);
}

/** First live box touched by a ball of radius BALL_R at (x, y), or -1. */
function touchedBrick(bricks: number[], x: number, y: number): number {
  for (const [dx, dy] of [
    [0, 0],
    [BALL_R, 0],
    [-BALL_R, 0],
    [0, BALL_R],
    [0, -BALL_R],
  ]) {
    const i = brickAt(x + dx, y + dy);
    if (i >= 0 && i < bricks.length && bricks[i] !== 0) {
      return i;
    }
  }
  return -1;
}

function pickPower(rng: Rng, lives: number): PowerKind {
  const r = rng();
  if (r < 0.12 && lives < MAX_LIVES) {
    return "life";
  }
  if (r < 0.45) {
    return "wide";
  }
  return r < 0.75 ? "multi" : "fire";
}

const boxCentre = (i: number) => ({
  x: ((i % COLS) + 0.5) * BRICK_W,
  y: BRICK_TOP + (Math.floor(i / COLS) + 0.5) * BRICK_H,
});

interface Hit {
  bricks: number[];
  /** Copy-on-write: false until the first box is damaged this step. */
  bricksOwned: boolean;
  drops: Drop[];
  events: StepEvents;
  kinds: BrickKind[];
  score: number;
}

/**
 * Writes one box's hp. The array is copied only on the first write of a step,
 * so frames where nothing is hit keep the same `bricks` reference (the view
 * memoizes its brick layer on it) and never allocate a new array.
 */
function setBrick(hit: Hit, i: number, hp: number): void {
  if (!hit.bricksOwned) {
    hit.bricks = [...hit.bricks];
    hit.bricksOwned = true;
  }
  hit.bricks[i] = hp;
}

function destroy(i: number, hit: Hit, rng: Rng, lives: number): void {
  setBrick(hit, i, 0);
  hit.events.broken += 1;
  hit.events.brokenAt.push(i);
  const kind = hit.kinds[i];
  if (kind === "mystery" || rng() < DROP_CHANCE) {
    hit.drops.push({ kind: pickPower(rng, lives), ...boxCentre(i) });
  }
  if (kind === "bomb") {
    // Blast the 8 neighbours; other bombs caught in it chain.
    hit.events.exploded = true;
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        const j = brickIndex(r, c);
        if (c < 0 || c >= COLS || r < 0 || j >= hit.bricks.length) {
          continue;
        }
        if (hit.bricks[j] > 0) {
          hit.score += POINTS_PER_HIT * hit.bricks[j];
          destroy(j, hit, rng, lives);
        }
      }
    }
  }
}

/** Damages box i; `burn` (fireball) destroys any breakable box outright. */
function hitBrick(
  i: number,
  hit: Hit,
  rng: Rng,
  lives: number,
  burn: boolean
): void {
  hit.events.hitAt.push(i);
  if (hit.bricks[i] === STEEL) {
    return;
  }
  hit.score += POINTS_PER_HIT;
  setBrick(hit, i, burn ? 0 : hit.bricks[i] - 1);
  if (hit.bricks[i] === 0) {
    destroy(i, hit, rng, lives);
  }
}

interface Ctx {
  burn: boolean;
  hit: Hit;
  lives: number;
  paddleVx: number;
  paddleX: number;
  rng: Rng;
  width: number;
}

/** One ball, one substep. Returns null when it falls out of the field. */
function moveBall(ball: Ball, dt: number, ctx: Ctx): Ball | null {
  const { hit } = ctx;
  let { vx, vy, x, y } = ball;

  // Axis-separated moves: the axis that put us into a box is the one to flip.
  // A fireball keeps going through breakable boxes and only bounces off steel.
  x += vx * dt;
  let i = touchedBrick(hit.bricks, x, y);
  if (i >= 0) {
    const steel = hit.bricks[i] === STEEL;
    hitBrick(i, hit, ctx.rng, ctx.lives, ctx.burn);
    if (steel || !ctx.burn) {
      x -= vx * dt;
      vx = -vx;
    }
  }
  y += vy * dt;
  i = touchedBrick(hit.bricks, x, y);
  if (i >= 0) {
    const steel = hit.bricks[i] === STEEL;
    hitBrick(i, hit, ctx.rng, ctx.lives, ctx.burn);
    if (steel || !ctx.burn) {
      y -= vy * dt;
      vy = -vy;
    }
  }

  if (x < BALL_R) {
    x = BALL_R;
    vx = Math.abs(vx);
  } else if (x > FIELD_W - BALL_R) {
    x = FIELD_W - BALL_R;
    vx = -Math.abs(vx);
  }
  if (y < BALL_R) {
    y = BALL_R;
    vy = Math.abs(vy);
  }

  // Paddle: where the ball lands sets the angle, a moving paddle bends it further.
  const half = ctx.width / 2;
  if (
    vy > 0 &&
    y + BALL_R >= PADDLE_Y &&
    y - BALL_R <= PADDLE_Y + PADDLE_H &&
    x >= ctx.paddleX - half - BALL_R &&
    x <= ctx.paddleX + half + BALL_R
  ) {
    const offset = Math.max(-1, Math.min(1, (x - ctx.paddleX) / half));
    const english = Math.max(
      -MAX_ENGLISH,
      Math.min(MAX_ENGLISH, ctx.paddleVx * ENGLISH)
    );
    const angle = Math.max(
      -MAX_BOUNCE,
      Math.min(MAX_BOUNCE, offset * MAX_BOUNCE * 0.9 + english)
    );
    const speed = Math.hypot(vx, vy);
    vx = speed * Math.sin(angle);
    vy = -speed * Math.cos(angle);
    y = PADDLE_Y - BALL_R;
    hit.events.paddle = true;
  }

  if (y - BALL_R > FIELD_H) {
    return null;
  }
  return { stuck: false, vx, vy, x, y };
}

/** Rescales every moving ball to `speed`, keeping its direction. */
function withSpeed(balls: Ball[], speed: number): Ball[] {
  return balls.map((b) => {
    const v = Math.hypot(b.vx, b.vy);
    return b.stuck || v === 0
      ? b
      : { ...b, vx: (b.vx / v) * speed, vy: (b.vy / v) * speed };
  });
}

/**
 * Advances the world by dtMs. `now` is wall-clock ms (power-up timers).
 * Long frames are split into substeps so a fast ball never tunnels a box.
 */
export function step(
  state: BreakerState,
  dtMs: number,
  now: number,
  rng: Rng
): { events: StepEvents; state: BreakerState } {
  const events: StepEvents = {
    broken: 0,
    brokenAt: [],
    cleared: false,
    exploded: false,
    hitAt: [],
    lostLife: false,
    over: false,
    paddle: false,
    power: null,
  };
  const dt = Math.min(dtMs, 50) / 1000;
  const hit: Hit = {
    bricks: state.bricks,
    bricksOwned: false,
    drops: [...state.drops],
    events,
    kinds: state.kinds,
    score: state.score,
  };
  const width = paddleWidth(state, now);
  const ctx: Ctx = {
    burn: now < state.fireUntil,
    hit,
    lives: state.lives,
    paddleVx: state.paddleVx,
    paddleX: state.paddleX,
    rng,
    width,
  };
  const speed = ballSpeed(state.level) * MAX_BOOST;
  const substeps = Math.max(1, Math.ceil((speed * dt) / (BALL_R * 0.8)));
  const sub = dt / substeps;

  let { balls, boost } = state;
  for (let s = 0; s < substeps; s += 1) {
    const next: Ball[] = [];
    for (const ball of balls) {
      if (ball.stuck) {
        next.push(ball);
        continue;
      }
      const moved = moveBall(ball, sub, ctx);
      if (moved) {
        next.push(moved);
      }
    }
    balls = next;
  }
  if (events.paddle) {
    boost = Math.min(MAX_BOOST, boost + BOOST_PER_HIT);
    balls = withSpeed(balls, ballSpeed(state.level) * boost);
  }

  // Falling power-ups: caught by the paddle or lost below it.
  let { fireUntil, lives, wideUntil } = state;
  const drops: Drop[] = [];
  for (const d of hit.drops) {
    const y = d.y + DROP_SPEED * dt;
    const caught =
      y >= PADDLE_Y &&
      y <= PADDLE_Y + PADDLE_H * 2 &&
      Math.abs(d.x - state.paddleX) <= width / 2;
    if (caught) {
      events.power = d.kind;
      if (d.kind === "wide") {
        wideUntil = now + WIDE_MS;
      } else if (d.kind === "life") {
        lives = Math.min(MAX_LIVES, lives + 1);
      } else if (d.kind === "fire") {
        fireUntil = now + FIRE_MS;
      } else {
        balls = splitBalls(balls);
      }
    } else if (y < FIELD_H) {
      drops.push({ ...d, y });
    }
  }

  let next: BreakerState = {
    ...state,
    balls,
    boost,
    bricks: hit.bricks,
    drops,
    fireUntil,
    lives,
    score: hit.score,
    wideUntil,
  };

  if (isCleared(next.bricks)) {
    events.cleared = true;
    const level = state.level + 1;
    next = {
      ...next,
      ...levelBoxes(level),
      balls: [stuckBall(next.paddleX)],
      boost: 1,
      drops: [],
      fireUntil: 0,
      level,
      score: next.score + LEVEL_BONUS * state.level,
    };
  } else if (balls.length === 0) {
    events.lostLife = true;
    next = {
      ...next,
      balls: [stuckBall(next.paddleX)],
      boost: 1,
      drops: [],
      fireUntil: 0,
      lives: next.lives - 1,
      wideUntil: 0,
    };
    events.over = next.lives <= 0;
  }
  return { events, state: next };
}

/** Most balls multi-ball may put in play (never removes balls already there). */
const MAX_BALLS = 9;

/**
 * Multi-ball: every moving ball spawns two copies fanned out ±25°, while
 * the total stays at most MAX_BALLS.
 */
function splitBalls(balls: Ball[]): Ball[] {
  const out: Ball[] = [];
  let room = MAX_BALLS - balls.length;
  for (const b of balls) {
    out.push(b);
    if (b.stuck) {
      continue;
    }
    for (const turn of [-0.44, 0.44]) {
      if (room <= 0) {
        break;
      }
      room -= 1;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      out.push({
        ...b,
        vx: b.vx * cos - b.vy * sin,
        vy: Math.min(-0.2, b.vx * sin + b.vy * cos),
      });
    }
  }
  return out;
}
