import {
  BALL_R,
  BRICK_H,
  BRICK_TOP,
  BRICK_W,
  type BreakerState,
  type BrickKind,
  brickIndex,
  COLS,
  FIELD_H,
  isCleared,
  LEVELS,
  launch,
  movePaddle,
  newGame,
  PADDLE_W,
  PADDLE_Y,
  parseLevel,
  STEEL,
  step,
} from "@/games/box-breaker/logic";

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

const FRAME_MS = 16;

/** Paddle under the lowest falling ball, aimed a little off-centre so it never loops vertically. */
function botPaddleX(state: BreakerState, aim: number): number {
  const [falling] = state.balls
    .filter((b) => !b.stuck && b.vy > 0)
    .sort((a, b) => b.y - a.y);
  const target = falling ?? state.balls[0];
  return target.x + aim * (PADDLE_W / 2);
}

describe("box breaker levels", () => {
  test("every level is a whole number of rows with something to break", () => {
    LEVELS.forEach((rows, i) => {
      for (const row of rows) {
        expect(row).toHaveLength(COLS);
      }
      const { bricks, kinds } = parseLevel(i + 1);
      expect(bricks.length % COLS).toBe(0);
      expect(kinds).toHaveLength(bricks.length);
      expect(isCleared(bricks)).toBe(false);
      expect(bricks.every((c) => c === STEEL || (c >= 0 && c <= 3))).toBe(true);
      kinds.forEach((kind, j) => {
        expect(kind === "steel").toBe(bricks[j] === STEEL);
      });
    });
  });

  test("bricks stay above the paddle", () => {
    const deepest = Math.max(...LEVELS.map((rows) => rows.length));
    expect(BRICK_TOP + deepest * BRICK_H).toBeLessThan(PADDLE_Y - 0.4);
  });
});

/** A level-1 game whose boxes are replaced by `layout` (same codes as LEVELS). */
function withLayout(rows: string[]): BreakerState {
  const s = newGame();
  const bricks: number[] = [];
  const kinds: BrickKind[] = [];
  const codes: Record<string, [number, BrickKind]> = {
    "?": [1, "mystery"],
    ".": [0, "normal"],
    "#": [STEEL, "steel"],
    B: [1, "bomb"],
  };
  for (const ch of rows.join("")) {
    const [hp, kind] = codes[ch] ?? [Number(ch), "normal"];
    bricks.push(hp);
    kinds.push(kind);
  }
  return { ...s, bricks, kinds, maxHp: [...bricks] };
}

/** One ball flying straight up under column `col`, just below box row `row`. */
function ballUnder(s: BreakerState, col: number, row: number): BreakerState {
  const x = (col + 0.5) * BRICK_W;
  const y = BRICK_TOP + (row + 1) * BRICK_H + BALL_R + 0.002;
  return { ...s, balls: [{ stuck: false, vx: 0, vy: -1, x, y }] };
}

describe("box breaker boxes", () => {
  test("a bomb blasts its eight neighbours and chains into another bomb, sparing steel", () => {
    const s = ballUnder(withLayout(["1#111...", "1BB31..."]), 1, 1);
    const r = step(s, 16, 0, seeded(1));
    expect(r.events.exploded).toBe(true);
    // Bomb (1,1) clears its neighbours, including bomb (1,2), which clears cols 1-3.
    expect(r.state.bricks).toEqual([
      0,
      STEEL,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
    ]);
    expect(r.events.broken).toBe(7);
  });

  test("a mystery box always drops a power-up", () => {
    const s = ballUnder(withLayout(["?1111111"]), 0, 0);
    // An rng that never rolls a random drop: only the mystery box can drop.
    const r = step(s, 16, 0, () => 0.99);
    expect(r.state.bricks[brickIndex(0, 0)]).toBe(0);
    expect(r.state.drops).toHaveLength(1);
    expect(r.state.drops[0].x).toBeCloseTo(BRICK_W / 2);
  });

  test("a three-hit box takes three hits and the ball bounces each time", () => {
    // A second box far away keeps the level from clearing.
    let s = ballUnder(withLayout(["3......1"]), 0, 0);
    const hp: number[] = [];
    for (let k = 0; k < 3; k += 1) {
      const r = step(ballUnder(s, 0, 0), 16, 0, seeded(k));
      ({ state: s } = r);
      hp.push(s.bricks[0]);
      expect(s.balls[0].vy).toBeGreaterThan(0);
    }
    expect(hp).toEqual([2, 1, 0]);
  });

  test("a fireball burns straight through boxes but still bounces off steel", () => {
    const fire = {
      ...withLayout(["#.......", "3.......", "3......1"]),
      fireUntil: 10_000,
    };
    let s = ballUnder(fire, 0, 2);
    let bounced = false;
    for (let t = 0; t < 400 && !bounced; t += 16) {
      ({ state: s } = step(s, 16, t, seeded(2)));
      bounced = s.balls[0].vy > 0;
    }
    expect([s.bricks[0], s.bricks[8], s.bricks[16], s.bricks[23]]).toEqual([
      STEEL,
      0,
      0,
      1,
    ]);
    expect(bounced).toBe(true);
  });
});

describe("box breaker physics", () => {
  test("a launched ball moves up and the stuck ball follows the paddle", () => {
    const rng = seeded(1);
    let s = movePaddle(newGame(), 0.3, 0);
    expect(s.balls[0].x).toBeCloseTo(0.3);
    s = launch(s, rng);
    expect(s.balls[0].stuck).toBe(false);
    expect(s.balls[0].vy).toBeLessThan(0);
  });

  test("missing the ball costs a life and the game ends at zero", () => {
    const rng = seeded(2);
    let s = launch(newGame(), rng);
    let lostLives = 0;
    for (let f = 0; f < 60_000 && lostLives < 3; f += 1) {
      // Paddle parked in a corner: the ball eventually gets past.
      s = movePaddle(s, s.balls[0].x > 0.5 ? 0 : 1, f * FRAME_MS);
      const r = step(s, FRAME_MS, f * FRAME_MS, rng);
      s = r.state;
      if (r.events.lostLife) {
        lostLives += 1;
        expect(r.events.over).toBe(lostLives === 3);
        s = launch(s, rng);
      }
    }
    expect(lostLives).toBe(3);
    expect(s.lives).toBe(0);
  });

  test("a moving paddle bends the bounce towards its motion", () => {
    const bounce = (paddleVx: number) => {
      const s: BreakerState = {
        ...newGame(),
        balls: [
          { stuck: false, vx: 0, vy: 1, x: 0.5, y: PADDLE_Y - BALL_R - 0.001 },
        ],
        paddleVx,
        paddleX: 0.5,
      };
      const r = step(s, 16, 0, seeded(1));
      expect(r.events.paddle).toBe(true);
      return r.state.balls[0].vx;
    };
    expect(bounce(0)).toBeCloseTo(0);
    expect(bounce(2)).toBeGreaterThan(0.1);
    expect(bounce(-2)).toBeLessThan(-0.1);
  });

  test("every paddle hit speeds the ball up, capped at +25 %", () => {
    let s: BreakerState = newGame();
    const speeds: number[] = [];
    for (let k = 0; k < 40; k += 1) {
      s = {
        ...s,
        balls: [
          { stuck: false, vx: 0, vy: 1, x: 0.5, y: PADDLE_Y - BALL_R - 0.001 },
        ],
        paddleX: 0.5,
      };
      ({ state: s } = step(s, 16, 0, seeded(k)));
      const [b] = s.balls;
      speeds.push(Math.hypot(b.vx, b.vy));
    }
    expect(speeds[1]).toBeGreaterThan(speeds[0]);
    expect(Math.max(...speeds)).toBeCloseTo(0.8 * 1.25, 5);
  });

  test.each(LEVELS.map((_, i) => i + 1))(
    "a careful bot clears layout %i without tunnelling through bricks",
    (level) => {
      const rng = seeded(level);
      let s = launch(newGame(level), rng);
      let aim = 0.3;
      let now = 0;
      let cleared = false;
      let tunnelled = false;
      while (!cleared && now < 10 * 60_000) {
        now += FRAME_MS;
        s = movePaddle(s, botPaddleX(s, aim), now);
        const r = step(s, FRAME_MS, now, rng);
        ({ cleared } = r.events);
        s = r.state;
        if (r.events.paddle) {
          aim = (rng() - 0.5) * 1.4;
        }
        if (r.events.lostLife) {
          s = launch(s, rng);
        }
        for (const b of s.balls) {
          const row = Math.floor((b.y - BRICK_TOP) / BRICK_H);
          const col = Math.floor(b.x / BRICK_W);
          const i = row * COLS + col;
          const inBrick =
            b.y >= BRICK_TOP &&
            i >= 0 &&
            i < s.bricks.length &&
            s.bricks[i] !== 0;
          tunnelled ||= inBrick || b.x < BALL_R - 1e-9 || b.y > FIELD_H + 1;
        }
      }
      expect(tunnelled).toBe(false);
      expect(cleared).toBe(true);
      expect(s.lives).toBeGreaterThan(0);
    }
  );
});
