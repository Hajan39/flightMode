// Pure, dependency-free Snake logic — extracted from the component so movement,
// collision, speed and food placement can be unit-tested without React Native.

export const GRID_COLS = 18;
export const GRID_ROWS = 18;
export const CELL_COUNT = GRID_COLS * GRID_ROWS;

const BASE_INTERVAL_MS = 300;
const MIN_INTERVAL_MS = 120;

export type Direction = "up" | "down" | "left" | "right";

/** Tick interval shrinks as the score grows (faster snake), with a floor. */
export function getIntervalMs(score: number): number {
	return Math.max(MIN_INTERVAL_MS, BASE_INTERVAL_MS - score * 6);
}

const OPPOSITE: Record<Direction, Direction> = {
	up: "down",
	down: "up",
	left: "right",
	right: "left",
};

export function opposite(dir: Direction): Direction {
	return OPPOSITE[dir];
}

export type StepResult =
	| { dead: true }
	| { dead: false; snake: number[]; ate: boolean };

/**
 * Advance the snake one cell in `dir`. Returns `{ dead: true }` on a wall or
 * self collision; otherwise the new snake (grown when it eats `food`) and
 * whether it ate. `snake[0]` is the head. The tail cell is excluded from the
 * self-collision check because it moves away this tick.
 */
export function step(snake: number[], dir: Direction, food: number): StepResult {
	const head = snake[0];
	const row = Math.floor(head / GRID_COLS);
	const col = head % GRID_COLS;

	let nr = row;
	let nc = col;
	if (dir === "up") nr--;
	else if (dir === "down") nr++;
	else if (dir === "left") nc--;
	else nc++;

	if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) {
		return { dead: true };
	}

	const newHead = nr * GRID_COLS + nc;
	if (snake.slice(0, -1).includes(newHead)) {
		return { dead: true };
	}

	const ate = newHead === food;
	const newSnake = ate
		? [newHead, ...snake]
		: [newHead, ...snake.slice(0, -1)];
	return { dead: false, snake: newSnake, ate };
}

/** Random empty cell for new food; -1 when the board is full (win). */
export function placeFood(
	snake: number[],
	rng: () => number = Math.random,
): number {
	const snakeSet = new Set(snake);
	const empty: number[] = [];
	for (let i = 0; i < CELL_COUNT; i++) {
		if (!snakeSet.has(i)) empty.push(i);
	}
	if (empty.length === 0) return -1;
	return empty[Math.floor(rng() * empty.length)];
}
