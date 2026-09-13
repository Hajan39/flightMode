/**
 * Pure game logic for Split Duel — a shared-screen, simultaneous 2-player
 * reflex duel. Kept free of React so it can be unit-tested.
 */

export type ColorId = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

export const COLOR_IDS: ColorId[] = ["red", "blue", "green", "yellow", "purple", "orange"];

export const COLOR_HEX: Record<ColorId, string> = {
	red: "#ef5350",
	blue: "#42a5f5",
	green: "#66bb6a",
	yellow: "#ffd54f",
	purple: "#ab47bc",
	orange: "#ffa726",
};

export type Challenge =
	| {
			kind: "color";
			target: ColorId;
			/** Disc color timeline; `atMs` is the offset from round start. */
			steps: { color: ColorId; atMs: number }[];
			/** Total timeline length before the round times out. */
			totalMs: number;
	  }
	| { kind: "odd"; grid: string[]; oddIndex: number }
	| { kind: "hold"; targetMs: number }
	| { kind: "math"; prompt: string; options: number[]; answer: number }
	| { kind: "green"; delayMs: number };

export type ChallengeKind = Challenge["kind"];

export const CHALLENGE_KINDS: ChallengeKind[] = ["color", "odd", "hold", "math", "green"];

export const ROUNDS_TO_WIN = 3;
export const MAX_ROUNDS = 5;

type Rng = () => number;

function pick<T>(arr: readonly T[], rng: Rng): T {
	return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

const ODD_SETS: [string, string][] = [
	["✈️", "🛩️"],
	["🧳", "🎒"],
	["🌙", "⭐"],
	["🍎", "🍅"],
	["🐶", "🐱"],
	["☁️", "🌥️"],
	["🟦", "🟪"],
	["🔵", "🟣"],
	["😀", "😃"],
	["🟢", "🟩"],
	["🚀", "🛸"],
	["🍩", "🥯"],
];

export function makeColorChallenge(rng: Rng): Challenge {
	const target = pick(COLOR_IDS, rng);
	const steps: { color: ColorId; atMs: number }[] = [];
	let at = 0;
	// 5–8 steps of 550–900 ms; guarantee the target appears at least once,
	// never first (so an instant tap is always a false start).
	const count = 5 + Math.floor(rng() * 4);
	const targetPos = 1 + Math.floor(rng() * (count - 1));
	let prev: ColorId | null = null;
	for (let i = 0; i < count; i++) {
		let color: ColorId;
		if (i === targetPos) color = target;
		else {
			do color = pick(COLOR_IDS, rng);
			while (color === target || color === prev);
		}
		steps.push({ color, atMs: at });
		at += 550 + Math.floor(rng() * 350);
		prev = color;
	}
	return { kind: "color", target, steps, totalMs: at + 600 };
}

/** Disc color visible at `elapsedMs` (last step whose `atMs` ≤ elapsed). */
export function colorAt(challenge: Extract<Challenge, { kind: "color" }>, elapsedMs: number): ColorId {
	let current = challenge.steps[0].color;
	for (const step of challenge.steps) {
		if (step.atMs <= elapsedMs) current = step.color;
		else break;
	}
	return current;
}

export function makeOddChallenge(rng: Rng): Challenge {
	const [common, odd] = shuffle(pick(ODD_SETS, rng), rng) as [string, string];
	const oddIndex = Math.floor(rng() * 9);
	const grid = Array.from({ length: 9 }, (_, i) => (i === oddIndex ? odd : common));
	return { kind: "odd", grid, oddIndex };
}

export function makeHoldChallenge(rng: Rng): Challenge {
	// 2.0 s – 3.5 s in 0.5 s steps so the target reads nicely.
	const targetMs = 2000 + Math.floor(rng() * 4) * 500;
	return { kind: "hold", targetMs };
}

export function makeMathChallenge(rng: Rng): Challenge {
	const a = 2 + Math.floor(rng() * 18);
	const b = 2 + Math.floor(rng() * 18);
	const plus = rng() < 0.6;
	const answer = plus ? a + b : Math.abs(a - b);
	const prompt = plus ? `${a} + ${b}` : `${Math.max(a, b)} − ${Math.min(a, b)}`;
	let wrong = answer + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3));
	if (wrong < 0 || wrong === answer) wrong = answer + 2;
	const options = rng() < 0.5 ? [answer, wrong] : [wrong, answer];
	return { kind: "math", prompt, options, answer };
}

export function makeGreenChallenge(rng: Rng): Challenge {
	return { kind: "green", delayMs: 1000 + Math.floor(rng() * 3000) };
}

export function makeChallenge(kind: ChallengeKind, rng: Rng = Math.random): Challenge {
	switch (kind) {
		case "color":
			return makeColorChallenge(rng);
		case "odd":
			return makeOddChallenge(rng);
		case "hold":
			return makeHoldChallenge(rng);
		case "math":
			return makeMathChallenge(rng);
		case "green":
			return makeGreenChallenge(rng);
	}
}

/** `n` challenges with at least 3 distinct kinds and no immediate repeats. */
export function pickChallenges(n: number, rng: Rng = Math.random): Challenge[] {
	const kinds: ChallengeKind[] = [];
	let pool = shuffle(CHALLENGE_KINDS, rng);
	while (kinds.length < n) {
		if (pool.length === 0) pool = shuffle(CHALLENGE_KINDS, rng);
		const next = pool.shift() as ChallengeKind;
		if (kinds[kinds.length - 1] === next) {
			pool.push(next);
			continue;
		}
		kinds.push(next);
	}
	return kinds.map((k) => makeChallenge(k, rng));
}

/** Seat (0/1) closest to the target hold time, or null on an exact tie. */
export function resolveHold(targetMs: number, heldMs: [number | null, number | null]): 0 | 1 | null {
	const [a, b] = heldMs;
	if (a === null && b === null) return null;
	if (a === null) return 1;
	if (b === null) return 0;
	const da = Math.abs(a - targetMs);
	const db = Math.abs(b - targetMs);
	if (da === db) return null;
	return da < db ? 0 : 1;
}

/** Match is over when someone reaches ROUNDS_TO_WIN or MAX_ROUNDS were played. */
export function isMatchOver(wins: [number, number], roundsPlayed: number): boolean {
	return wins[0] >= ROUNDS_TO_WIN || wins[1] >= ROUNDS_TO_WIN || roundsPlayed >= MAX_ROUNDS;
}
