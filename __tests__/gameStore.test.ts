import { useGameStore } from "@/store/useGameStore";

function reset() {
	useGameStore.setState({ progress: {} });
}

describe("useGameStore.updateProgress", () => {
	beforeEach(reset);

	test("records a first play as a new best with streak 1", () => {
		const res = useGameStore.getState().updateProgress("t", 100);
		expect(res.isNewBest).toBe(true);
		expect(res.best).toBe(100);
		expect(res.last).toBe(100);
		expect(res.currentStreak).toBe(1);
		expect(res.timesPlayed).toBe(1);
		const p = useGameStore.getState().progress.t;
		expect(p.highScore).toBe(100);
		expect(p.timesPlayed).toBe(1);
	});

	test("a lower later score keeps the previous best but updates lastScore", () => {
		useGameStore.getState().updateProgress("t", 100);
		const res = useGameStore.getState().updateProgress("t", 40);
		expect(res.isNewBest).toBe(false);
		expect(res.best).toBe(100);
		expect(res.last).toBe(40);
		expect(res.timesPlayed).toBe(2);
		// score 40 > 0 → counts as a win → streak grows
		expect(res.currentStreak).toBe(2);
	});

	test("won:false resets the streak but keeps the best", () => {
		useGameStore.getState().updateProgress("t", 100);
		useGameStore.getState().updateProgress("t", 80);
		const res = useGameStore.getState().updateProgress("t", 0, { won: false });
		expect(res.currentStreak).toBe(0);
		expect(res.best).toBe(100);
		expect(res.bestStreak).toBe(2);
	});

	test("levelStarsPatch merges taking the max per level", () => {
		useGameStore
			.getState()
			.updateProgress("t", 10, { levelStarsPatch: { "hard-no-hint": 1 } });
		useGameStore
			.getState()
			.updateProgress("t", 10, { levelStarsPatch: { "hard-no-hint": 1 } });
		const stars = useGameStore.getState().progress.t.levelStars?.["hard-no-hint"];
		expect(stars).toBe(1);
	});

	test("resetGameProgress removes a single game", () => {
		useGameStore.getState().updateProgress("a", 10);
		useGameStore.getState().updateProgress("b", 20);
		useGameStore.getState().resetGameProgress("a");
		expect(useGameStore.getState().progress.a).toBeUndefined();
		expect(useGameStore.getState().progress.b).toBeDefined();
	});
});
