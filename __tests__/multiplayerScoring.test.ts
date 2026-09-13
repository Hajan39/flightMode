import { useGameStore } from "@/store/useGameStore";
import {
	getSoleWinnerIndex,
	rankStandings,
	recordMatch,
} from "@/utils/multiplayerScoring";

describe("rankStandings", () => {
	test("sorts best-first and shares ranks on ties", () => {
		const ranked = rankStandings([{ score: 3 }, { score: 5 }, { score: 3 }]);
		expect(ranked.map((r) => [r.index, r.rank])).toEqual([
			[1, 1],
			[0, 2],
			[2, 2],
		]);
	});

	test("uses tiebreak before falling back to seat order", () => {
		const ranked = rankStandings([
			{ score: 2, tiebreak: 10 },
			{ score: 2, tiebreak: 14 },
		]);
		expect(ranked[0].index).toBe(1);
		expect(ranked[0].rank).toBe(1);
		expect(ranked[1].rank).toBe(2);
	});
});

describe("getSoleWinnerIndex", () => {
	test("returns the unique leader or null on a shared top spot", () => {
		expect(getSoleWinnerIndex([{ score: 1 }, { score: 4 }])).toBe(1);
		expect(getSoleWinnerIndex([{ score: 4 }, { score: 4 }])).toBeNull();
		expect(getSoleWinnerIndex([])).toBeNull();
	});
});

describe("recordMatch", () => {
	beforeEach(() => useGameStore.setState({ progress: {} }));

	test("records the host's score and a win when seat 0 is the sole winner", () => {
		const res = recordMatch("mp-test", [{ score: 7 }, { score: 3 }], {
			bonusIfWon: 10,
		});
		expect(res.last).toBe(17);
		expect(res.currentStreak).toBe(1);
		const p = useGameStore.getState().progress["mp-test"];
		expect(p.highScore).toBe(17);
		expect(p.timesPlayed).toBe(1);
	});

	test("a host loss keeps the score but resets the streak; a draw is not a win", () => {
		recordMatch("mp-test", [{ score: 7 }, { score: 3 }]);
		let res = recordMatch("mp-test", [{ score: 2 }, { score: 9 }]);
		expect(res.last).toBe(2);
		expect(res.currentStreak).toBe(0);
		res = recordMatch("mp-test", [{ score: 5 }, { score: 5 }]);
		expect(res.last).toBe(5);
		expect(res.currentStreak).toBe(0);
		expect(useGameStore.getState().progress["mp-test"].bestStreak).toBe(1);
	});

	test("hostIndex can point at another seat", () => {
		const res = recordMatch("mp-test", [{ score: 1 }, { score: 6 }], {
			hostIndex: 1,
		});
		expect(res.last).toBe(6);
		expect(res.currentStreak).toBe(1);
	});
});
