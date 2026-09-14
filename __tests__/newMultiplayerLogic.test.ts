import { allTiles, connectors, storyFrameKeys, tileDecks } from "@/data/emojiStoryTiles";
import { seatNeighborQuestions } from "@/data/seatNeighborQuestions";
import { drawHand, HAND_SIZE, tallyVotes, turnSequence } from "@/games/emoji-story/logic";
import { buildRounds, getSyncTier, TOTAL_ROUNDS } from "@/games/seat-neighbor/logic";
import {
	CHALLENGE_KINDS,
	colorAt,
	isMatchOver,
	makeColorChallenge,
	makeMathChallenge,
	makeOddChallenge,
	pickChallenges,
	resolveHold,
} from "@/games/split-duel/logic";
import { en } from "@/i18n/locales/en";
import { type Language, translations } from "@/i18n/translations";

const enKeys = new Set(Object.keys(en));

// Deterministic LCG so the tests are reproducible.
function seeded(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

describe("split-duel logic", () => {
	test("odd grid has exactly one differing emoji at oddIndex", () => {
		for (let i = 0; i < 50; i++) {
			const c = makeOddChallenge(seeded(i));
			if (c.kind !== "odd") throw new Error("kind");
			const odd = c.grid[c.oddIndex];
			expect(c.grid.filter((e) => e === odd)).toHaveLength(1);
			expect(c.grid).toHaveLength(9);
		}
	});

	test("math answer is correct and the distractor differs", () => {
		for (let i = 0; i < 50; i++) {
			const c = makeMathChallenge(seeded(i));
			if (c.kind !== "math") throw new Error("kind");
			expect(c.options).toContain(c.answer);
			expect(new Set(c.options).size).toBe(2);
			const [a, op, b] = c.prompt.split(" ");
			const expected = op === "+" ? Number(a) + Number(b) : Number(a) - Number(b);
			expect(expected).toBe(c.answer);
		}
	});

	test("color timeline never starts on the target and contains it once", () => {
		for (let i = 0; i < 50; i++) {
			const c = makeColorChallenge(seeded(i));
			if (c.kind !== "color") throw new Error("kind");
			expect(c.steps[0].color).not.toBe(c.target);
			expect(c.steps.filter((s) => s.color === c.target)).toHaveLength(1);
			expect(colorAt(c, 0)).toBe(c.steps[0].color);
			const targetStep = c.steps.find((s) => s.color === c.target)!;
			expect(colorAt(c, targetStep.atMs + 10)).toBe(c.target);
		}
	});

	test("pickChallenges yields ≥3 distinct kinds and no immediate repeats", () => {
		for (let i = 0; i < 20; i++) {
			const list = pickChallenges(5, seeded(i));
			expect(list).toHaveLength(5);
			expect(new Set(list.map((c) => c.kind)).size).toBeGreaterThanOrEqual(3);
			for (let j = 1; j < list.length; j++) expect(list[j].kind).not.toBe(list[j - 1].kind);
			for (const c of list) expect(CHALLENGE_KINDS).toContain(c.kind);
		}
	});

	test("resolveHold picks the closest, null on ties or double forfeit", () => {
		expect(resolveHold(3000, [2900, 3300])).toBe(0);
		expect(resolveHold(3000, [3500, 3100])).toBe(1);
		expect(resolveHold(3000, [2800, 3200])).toBeNull();
		expect(resolveHold(3000, [null, 5000])).toBe(1);
		expect(resolveHold(3000, [null, null])).toBeNull();
	});

	test("isMatchOver at 3 wins or 5 rounds", () => {
		expect(isMatchOver([3, 1], 4)).toBe(true);
		expect(isMatchOver([2, 2], 4)).toBe(false);
		expect(isMatchOver([2, 2], 5)).toBe(true);
	});
});

describe("seat-neighbor", () => {
	test("question bank: ≥60 unique ids, all 12 languages, ≥2 options, both kinds present", () => {
		const ids = seatNeighborQuestions.map((q) => q.id);
		expect(ids.length).toBeGreaterThanOrEqual(60);
		expect(new Set(ids).size).toBe(ids.length);
		const langs = Object.keys(translations) as Language[];
		for (const q of seatNeighborQuestions) {
			for (const lang of langs) {
				expect(q.prompt[lang]?.trim().length ?? 0).toBeGreaterThan(0);
				for (const o of q.options) expect(o[lang]?.trim().length ?? 0).toBeGreaterThan(0);
			}
			expect(q.options.length).toBeGreaterThanOrEqual(2);
			expect(new Set(q.options.map((o) => o.en)).size).toBe(q.options.length);
		}
		expect(seatNeighborQuestions.filter((q) => q.kind === "mindMeld").length).toBeGreaterThanOrEqual(5);
		expect(seatNeighborQuestions.filter((q) => q.kind === "wyr").length).toBeGreaterThanOrEqual(3);
	});

	test("buildRounds gives 8 rounds (5 mind-meld, 3 wyr) with alternating guesser", () => {
		const rounds = buildRounds(seatNeighborQuestions, new Set(), seeded(7));
		expect(rounds).toHaveLength(TOTAL_ROUNDS);
		expect(rounds.filter((r) => r.question.kind === "mindMeld")).toHaveLength(5);
		expect(rounds.filter((r) => r.question.kind === "wyr")).toHaveLength(3);
		const guessers = rounds.filter((r) => r.question.kind === "mindMeld").map((r) => r.guesser);
		for (let i = 1; i < guessers.length; i++) expect(guessers[i]).not.toBe(guessers[i - 1]);
		for (const r of rounds) expect(r.answerer).not.toBe(r.guesser);
		expect(new Set(rounds.map((r) => r.question.id)).size).toBe(TOTAL_ROUNDS);
	});

	test("sync tiers", () => {
		expect(getSyncTier(0)).toBe("snTierStrangers");
		expect(getSyncTier(3)).toBe("snTierSeatmates");
		expect(getSyncTier(6)).toBe("snTierTravelBuddies");
		expect(getSyncTier(8)).toBe("snTierSoulmates");
		for (let s = 0; s <= 8; s++) expect(enKeys.has(getSyncTier(s))).toBe(true);
	});
});

describe("emoji-story", () => {
	test("tiles are unique across decks and connector/frame keys exist", () => {
		expect(new Set(allTiles).size).toBe(allTiles.length);
		for (const deck of Object.values(tileDecks)) expect(deck.length).toBeGreaterThanOrEqual(20);
		for (const c of connectors) expect(enKeys.has(c.key)).toBe(true);
		for (const k of storyFrameKeys) expect(enKeys.has(k)).toBe(true);
	});

	test("drawHand returns 6 unique tiles excluding used ones", () => {
		const used = new Set(allTiles.slice(0, 40));
		for (let i = 0; i < 20; i++) {
			const hand = drawHand(seeded(i), used);
			expect(hand).toHaveLength(HAND_SIZE);
			expect(new Set(hand).size).toBe(HAND_SIZE);
			for (const t of hand) expect(used.has(t)).toBe(false);
		}
	});

	test("turnSequence covers every seat each act", () => {
		const seq = turnSequence(3, 3);
		expect(seq).toHaveLength(9);
		expect(seq.slice(0, 3).map((t) => t.author)).toEqual([0, 1, 2]);
		expect(seq[3].act).toBe(1);
	});

	test("tallyVotes ignores self-votes and nulls", () => {
		const contributions = [
			{ act: 0, author: 0, connector: "then" as const, tiles: ["✈️"] },
			{ act: 0, author: 1, connector: "but" as const, tiles: ["🍕"] },
			{ act: 0, author: 2, connector: "finally" as const, tiles: ["🌈"] },
		];
		expect(tallyVotes(contributions, [1, 1, null], 3)).toEqual([0, 1, 0]);
		expect(tallyVotes(contributions, [1, 2, 0], 3)).toEqual([1, 1, 1]);
	});
});
