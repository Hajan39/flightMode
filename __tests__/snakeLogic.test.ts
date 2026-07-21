import {
	CELL_COUNT,
	GRID_COLS,
	getIntervalMs,
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
