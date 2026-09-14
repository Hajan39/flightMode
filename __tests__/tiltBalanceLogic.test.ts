import {
	applyGust,
	type BallState,
	DEFAULT_PHYSICS,
	distanceFromCenter,
	gustIntervalMs,
	gustStrength,
	isOutOfBounds,
	ringRadius,
	scoreTurn,
	START_STATE,
	step,
} from "@/games/tilt-balance/logic";

describe("step", () => {
	test("a level phone leaves a resting ball where it is", () => {
		const next = step(START_STATE, 0, 0, 16);
		expect(next.x).toBe(0);
		expect(next.y).toBe(0);
	});

	test("tilt accelerates the ball in that direction", () => {
		let state = START_STATE;
		for (let i = 0; i < 30; i++) state = step(state, 1, 0, 16);
		expect(state.x).toBeGreaterThan(0);
		expect(state.vx).toBeGreaterThan(0);
		expect(state.y).toBe(0);

		let up = START_STATE;
		for (let i = 0; i < 30; i++) up = step(up, 0, -1, 16);
		expect(up.y).toBeLessThan(0);
	});

	test("damping slows a moving ball when the phone is level", () => {
		const moving: BallState = { x: 0, y: 0, vx: 1, vy: 0 };
		const next = step(moving, 0, 0, 100);
		expect(next.vx).toBeLessThan(moving.vx);
		expect(next.vx).toBeGreaterThan(0);
	});

	test("a stalled frame is clamped to maxStepMs so the ball can't teleport", () => {
		const moving: BallState = { x: 0, y: 0, vx: 1, vy: 0 };
		const clamped = step(moving, 0, 0, 5000);
		const atCap = step(moving, 0, 0, DEFAULT_PHYSICS.maxStepMs);
		expect(clamped).toEqual(atCap);
		expect(clamped.x).toBeLessThan(0.1);
	});

	test("a zero-length frame is a no-op", () => {
		const moving: BallState = { x: 0.2, y: 0.1, vx: 1, vy: -1 };
		expect(step(moving, 1, 1, 0)).toBe(moving);
	});
});

describe("gusts", () => {
	test("a gust only changes velocity, never position", () => {
		const gusted = applyGust({ x: 0.1, y: 0.2, vx: 0, vy: 0 }, 0.5, () => 0);
		expect(gusted.x).toBe(0.1);
		expect(gusted.y).toBe(0.2);
		expect(Math.hypot(gusted.vx, gusted.vy)).toBeCloseTo(0.5);
	});

	test("gusts get stronger and more frequent over time", () => {
		expect(gustStrength(30_000)).toBeGreaterThan(gustStrength(0));
		expect(gustIntervalMs(30_000)).toBeLessThan(gustIntervalMs(0));
		expect(gustIntervalMs(600_000)).toBeGreaterThanOrEqual(1600);
		expect(gustStrength(600_000)).toBeLessThanOrEqual(1);
	});
});

describe("ring and bounds", () => {
	test("the ring shrinks but never collapses", () => {
		expect(ringRadius(0)).toBeCloseTo(0.55);
		expect(ringRadius(45_000)).toBeCloseTo(0.3);
		expect(ringRadius(600_000)).toBeCloseTo(0.3);
		expect(ringRadius(20_000)).toBeLessThan(ringRadius(0));
	});

	test("the ball is lost only at the edge of the plate", () => {
		expect(isOutOfBounds({ x: 0.9, y: 0, vx: 0, vy: 0 })).toBe(false);
		expect(isOutOfBounds({ x: 1, y: 0, vx: 0, vy: 0 })).toBe(true);
		expect(isOutOfBounds({ x: 0.8, y: 0.8, vx: 0, vy: 0 })).toBe(true);
		expect(distanceFromCenter({ x: 3, y: 4, vx: 0, vy: 0 })).toBe(5);
	});
});

describe("scoreTurn", () => {
	test("one point per second plus a streak bonus", () => {
		expect(scoreTurn(0, 0)).toBe(0);
		expect(scoreTurn(9_900, 0)).toBe(9);
		expect(scoreTurn(10_000, 6_000)).toBe(13);
	});

	test("surviving longer never scores less", () => {
		let previous = -1;
		for (let ms = 0; ms <= 60_000; ms += 1_000) {
			const score = scoreTurn(ms, 0);
			expect(score).toBeGreaterThanOrEqual(previous);
			previous = score;
		}
	});
});
