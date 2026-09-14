/**
 * Pure physics + scoring for Turbulence Test (tilt balance).
 *
 * The playfield is a unit disc: the ball position is normalized so that a
 * distance of 1 is the edge of the plate. Keeping the game in normalized
 * space means the screen size never changes the difficulty.
 */

export type BallState = {
	x: number;
	y: number;
	/** Velocity in field units per second. */
	vx: number;
	vy: number;
};

export type PhysicsOptions = {
	/** How hard tilt accelerates the ball (field units / s²). */
	gravity: number;
	/** Velocity retained per second (0.1 = heavy damping, 0.9 = slippery). */
	damping: number;
	/** Largest simulated step, so a stalled JS thread can't teleport the ball. */
	maxStepMs: number;
};

export const DEFAULT_PHYSICS: PhysicsOptions = {
	gravity: 2.6,
	damping: 0.55,
	maxStepMs: 50,
};

export const START_STATE: BallState = { x: 0, y: 0, vx: 0, vy: 0 };

/** Ring radius at `elapsedMs`: starts at 0.55 and shrinks toward 0.3. */
export function ringRadius(elapsedMs: number): number {
	const shrink = Math.min(1, elapsedMs / 45_000);
	return 0.55 - 0.25 * shrink;
}

/** Gusts get stronger and more frequent the longer you survive. */
export function gustStrength(elapsedMs: number): number {
	return 0.35 + Math.min(0.65, elapsedMs / 40_000);
}

export function gustIntervalMs(elapsedMs: number): number {
	return Math.max(1600, 4200 - elapsedMs / 12);
}

/**
 * One physics step. `tiltX`/`tiltY` are the accelerometer axes clamped to
 * roughly -1..1, already oriented so that positive = right / down on screen.
 */
export function step(
	state: BallState,
	tiltX: number,
	tiltY: number,
	dtMs: number,
	opts: PhysicsOptions = DEFAULT_PHYSICS,
): BallState {
	const dt = Math.min(Math.max(dtMs, 0), opts.maxStepMs) / 1000;
	if (dt === 0) return state;

	const damp = opts.damping ** dt;
	const vx = (state.vx + tiltX * opts.gravity * dt) * damp;
	const vy = (state.vy + tiltY * opts.gravity * dt) * damp;
	return { x: state.x + vx * dt, y: state.y + vy * dt, vx, vy };
}

/** Adds a turbulence impulse in a random direction. */
export function applyGust(
	state: BallState,
	strength: number,
	rng: () => number = Math.random,
): BallState {
	const angle = rng() * Math.PI * 2;
	return {
		...state,
		vx: state.vx + Math.cos(angle) * strength,
		vy: state.vy + Math.sin(angle) * strength,
	};
}

export function distanceFromCenter(state: BallState): number {
	return Math.hypot(state.x, state.y);
}

/** The ball is lost once it leaves the plate (radius 1). */
export function isOutOfBounds(state: BallState): boolean {
	return distanceFromCenter(state) >= 1;
}

/**
 * Score for a turn: one point per full second inside the ring, plus a bonus
 * for the longest unbroken stretch in the middle.
 */
export function scoreTurn(survivedMs: number, bestStreakMs: number): number {
	return Math.floor(survivedMs / 1000) + Math.floor(bestStreakMs / 2000);
}
