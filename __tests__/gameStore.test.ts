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
      .updateProgress("t", 10, { levelStarsPatch: { "1": 3, "2": 1 } });
    // A worse replay of level 1 must not lower its stars; level 2 improves;
    // level 3 is new; untouched levels survive.
    useGameStore
      .getState()
      .updateProgress("t", 10, { levelStarsPatch: { "1": 1, "2": 2, "3": 1 } });
    expect(useGameStore.getState().progress.t.levelStars).toEqual({
      "1": 3,
      "2": 2,
      "3": 1,
    });
  });

  test("score 0 without an explicit won flag is a loss (streak resets)", () => {
    useGameStore.getState().updateProgress("t", 50);
    const res = useGameStore.getState().updateProgress("t", 0);
    expect(res.currentStreak).toBe(0);
    expect(res.bestStreak).toBe(1);
  });

  test("won:true counts a 0-score play as a win", () => {
    const res = useGameStore.getState().updateProgress("t", 0, { won: true });
    expect(res.currentStreak).toBe(1);
  });

  test("tying the best is not a new best", () => {
    useGameStore.getState().updateProgress("t", 100);
    const res = useGameStore.getState().updateProgress("t", 100);
    expect(res.isNewBest).toBe(false);
    expect(res.previousBest).toBe(100);
    expect(res.best).toBe(100);
  });

  test("resetGameProgress removes a single game", () => {
    useGameStore.getState().updateProgress("a", 10);
    useGameStore.getState().updateProgress("b", 20);
    useGameStore.getState().resetGameProgress("a");
    expect(useGameStore.getState().progress.a).toBeUndefined();
    expect(useGameStore.getState().progress.b?.highScore).toBe(20);
  });
});

describe("useGameStore persistence migration", () => {
  const { migrate } = useGameStore.persist.getOptions();
  if (!migrate) {
    throw new Error("useGameStore must define a migrate step");
  }

  test.each([0, 1, 2])(
    "v%i: legacy stack-sort scores (stars*100 + level) decode into levelStars",
    (fromVersion) => {
      const migrated = migrate(
        {
          progress: {
            "stack-sort": { highScore: 305, lastScore: 201, timesPlayed: 4 },
          },
        },
        fromVersion
      ) as { progress: Record<string, Record<string, unknown>> };
      expect(migrated.progress["stack-sort"]).toEqual({
        bestStreak: 0,
        currentStreak: 0,
        gameId: "stack-sort",
        highScore: 3,
        lastPlayed: 0,
        lastScore: 2,
        levelStars: { "1": 2, "5": 3 },
        timesPlayed: 4,
      });
    }
  );

  test("other games are only normalized, scores untouched", () => {
    const migrated = migrate(
      { progress: { quiz: { highScore: 450, lastScore: 120 } } },
      2
    ) as { progress: Record<string, Record<string, unknown>> };
    expect(migrated.progress.quiz).toMatchObject({
      currentStreak: 0,
      gameId: "quiz",
      highScore: 450,
      lastScore: 120,
      levelStars: {},
      timesPlayed: 0,
    });
  });

  test("current-version data passes through unchanged", () => {
    const data = { progress: { quiz: { highScore: 450 } } };
    expect(migrate(data, 3)).toBe(data);
  });

  test("an unmigrated stack-sort entry is decoded on the next play", () => {
    useGameStore.setState({
      progress: {
        "stack-sort": {
          bestStreak: 0,
          currentStreak: 0,
          gameId: "stack-sort",
          highScore: 207,
          lastPlayed: 0,
          lastScore: 207,
          timesPlayed: 1,
        },
      },
    });
    const res = useGameStore
      .getState()
      .updateProgress("stack-sort", 3, { levelStarsPatch: { "8": 3 } });
    expect(res.previousBest).toBe(2);
    expect(res.isNewBest).toBe(true);
    expect(useGameStore.getState().progress["stack-sort"].levelStars).toEqual({
      "7": 2,
      "8": 3,
    });
  });
});
