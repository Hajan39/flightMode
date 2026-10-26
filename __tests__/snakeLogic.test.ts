import {
  CELL_COUNT,
  type Direction,
  GRID_COLS,
  getIntervalMs,
  nextDirection,
  opposite,
  placeFood,
  step,
} from "@/games/snake/logic";

describe("snake getIntervalMs", () => {
  test("shrinks with score down to a floor of 120ms", () => {
    expect(getIntervalMs(0)).toBe(300);
    expect(getIntervalMs(10)).toBe(240);
    expect(getIntervalMs(1000)).toBe(120); // clamped
  });
});

describe("snake opposite", () => {
  test("pairs are inverses", () => {
    expect(opposite("up")).toBe("down");
    expect(opposite("down")).toBe("up");
    expect(opposite("left")).toBe("right");
    expect(opposite("right")).toBe("left");
  });
});

describe("snake step", () => {
  test("moving right advances the head and keeps length", () => {
    const res = step([100, 99, 98], "right", 999);
    expect(res.dead).toBe(false);
    if (!res.dead) {
      expect(res.snake).toEqual([101, 100, 99]);
      expect(res.ate).toBe(false);
    }
  });

  test("eating food grows the snake", () => {
    const res = step([100, 99, 98], "right", 101);
    expect(res.dead).toBe(false);
    if (!res.dead) {
      expect(res.ate).toBe(true);
      expect(res.snake).toEqual([101, 100, 99, 98]);
    }
  });

  test("hitting a wall is death", () => {
    // cell 17 is row 0, col 17 (rightmost). Moving right leaves the grid.
    expect(step([17, 16, 15], "right", -1)).toEqual({ dead: true });
    // cell 0 moving up leaves the grid.
    expect(step([0, 1, 2], "up", -1)).toEqual({ dead: true });
  });

  test("hitting the bottom and left walls is death too", () => {
    // Bottom row (row 17) moving down; column 0 moving left.
    const bottom = 17 * GRID_COLS + 5;
    expect(step([bottom, bottom - GRID_COLS], "down", -1)).toEqual({
      dead: true,
    });
    // Column 0 moving left must not wrap onto the previous row's last cell.
    expect(step([GRID_COLS * 3, GRID_COLS * 3 + 1], "left", -1)).toEqual({
      dead: true,
    });
  });

  test("moving up and down changes the row by one", () => {
    const res = step([5 * GRID_COLS + 5], "up", -1);
    expect(res).toEqual({
      ate: false,
      dead: false,
      snake: [4 * GRID_COLS + 5],
    });
    const down = step([5 * GRID_COLS + 5], "down", -1);
    expect(down).toEqual({
      ate: false,
      dead: false,
      snake: [6 * GRID_COLS + 5],
    });
  });

  test("chasing your own tail is legal: the tail moves away this tick", () => {
    // 2×2 loop — head 19 (r1c1), 18 (r1c0), 0 (r0c0), tail 1 (r0c1).
    // Moving up enters the tail cell, which is vacated on the same tick.
    const res = step([19, 18, 0, 1], "up", -1);
    expect(res).toEqual({ ate: false, dead: false, snake: [1, 19, 18, 0] });
  });

  test("running into your own body (not the tail) is death", () => {
    // snake [1,19,18,0]; head 1 (r0c1) moving down → r1c1 = 19, which is a
    // body segment (not the tail 0) → dead.
    expect(step([1, 19, 18, 0], "down", -1)).toEqual({ dead: true });
  });
});

describe("snake placeFood", () => {
  test("returns the first empty cell with a zero rng", () => {
    // snake occupies cell 0 → first empty is 1.
    expect(placeFood([0], () => 0)).toBe(1);
  });

  test("never returns a cell occupied by the snake", () => {
    const snake = [0, 1, 2, 3, 4];
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(snake).not.toContain(placeFood(snake, () => r));
    }
  });

  test("returns -1 when the board is full", () => {
    const full = Array.from({ length: CELL_COUNT }, (_, i) => i);
    expect(placeFood(full, () => 0)).toBe(-1);
  });

  test("grid width is 18", () => {
    expect(GRID_COLS).toBe(18);
  });
});

describe("snake nextDirection (reversal guard)", () => {
  test("a direct 180° press is ignored", () => {
    expect(nextDirection("right", "right", "left")).toBe("right");
  });

  test("a 90° turn is accepted", () => {
    expect(nextDirection("right", "right", "up")).toBe("up");
  });

  test("moving right, up + left within one tick never reverses into the neck", () => {
    let pending: Direction = "right";
    const lastMoved: Direction = "right"; // no tick between the two swipes
    pending = nextDirection(lastMoved, pending, "up");
    pending = nextDirection(lastMoved, pending, "left");
    expect(pending).toBe("up");
    expect(pending).not.toBe(opposite(lastMoved));
  });

  test("after the tick moves up, left becomes a legal turn", () => {
    let pending: Direction = nextDirection("right", "right", "up");
    // tick: the snake actually moves up
    const lastMoved: Direction = pending;
    pending = nextDirection(lastMoved, pending, "left");
    expect(pending).toBe("left");
  });

  test("a full tick sequence never steps into its own neck", () => {
    // 3-long snake heading right in the middle row.
    const snake = [9 * GRID_COLS + 9, 9 * GRID_COLS + 8, 9 * GRID_COLS + 7];
    const lastMoved: Direction = "right";
    let pending: Direction = "right";
    pending = nextDirection(lastMoved, pending, "up");
    pending = nextDirection(lastMoved, pending, "left");
    expect(pending).toBe("up");
    const r = step(snake, pending, -1);
    expect(r.dead).toBe(false);
    expect(r.dead ? -1 : r.snake[0]).toBe(8 * GRID_COLS + 9);
  });
});
