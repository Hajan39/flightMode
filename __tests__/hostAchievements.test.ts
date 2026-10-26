import { type AchievementState, achievements } from "@/data/achievements";
import { emojiStoryRecord } from "@/games/emoji-story/logic";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgress } from "@/types/game";
import {
  BEST_RUN_KEY,
  bestHostRun,
  HOSTED_KEY,
  hostedMatches,
  hostStatsPatch,
  RUN_START_KEY,
  recordMatch,
} from "@/utils/multiplayerScoring";

const emptyState: AchievementState = {
  articlesRead: [],
  checklistsCompleted: 0,
  converterUses: 0,
  gameProgress: {},
  maxTimezoneShiftHours: 0,
  phraseLanguagesViewed: [],
  soundsPlayed: [],
  streakDays: 0,
  totalFlights: 0,
  totalRelaxSessions: 0,
};

function condition(id: string) {
  const a = achievements.find((x) => x.id === id);
  if (!a) {
    throw new Error(`achievement ${id} missing`);
  }
  return a.condition;
}

function stateWith(progress: Record<string, GameProgress>): AchievementState {
  return { ...emptyState, gameProgress: progress };
}

function stateFromStore(): AchievementState {
  return stateWith(useGameStore.getState().progress);
}

function makeProgress(gameId: string, p: Partial<GameProgress>): GameProgress {
  return {
    bestStreak: 0,
    currentStreak: 0,
    gameId,
    highScore: 0,
    lastPlayed: 1,
    lastScore: 0,
    levelStars: {},
    timesPlayed: 1,
    ...p,
  };
}

const win = [{ score: 5 }, { score: 1 }];
const loss = [{ score: 1 }, { score: 5 }];

describe("emoji-story scoring decision", () => {
  test("story-only mode records no vote score and no win", () => {
    expect(emojiStoryRecord("story", [4, 7, 2])).toEqual({
      kind: "story",
      score: 0,
      won: false,
    });
  });

  test("voting mode records the vote totals as a match", () => {
    expect(emojiStoryRecord("votes", [3, 1])).toEqual({
      kind: "match",
      standings: [{ score: 3 }, { score: 1 }],
    });
  });

  test("story-only tales count as played but never unlock Crowd Favorite", () => {
    useGameStore.setState({ progress: {} });
    const { updateProgress } = useGameStore.getState();
    for (let i = 0; i < 5; i += 1) {
      const r = emojiStoryRecord("story", [9, 9]);
      if (r.kind === "story") {
        updateProgress("emoji-story", r.score, { won: r.won });
      }
    }
    const s = stateFromStore();
    expect(s.gameProgress["emoji-story"].timesPlayed).toBe(5);
    expect(condition("storyteller")(s)).toBe(true);
    expect(condition("crowd-favorite")(s)).toBe(false);
    expect(condition("undefeated-host")(s)).toBe(false);
  });

  test("Crowd Favorite needs 5 votes — 4 is not enough", () => {
    useGameStore.setState({ progress: {} });
    const r = emojiStoryRecord("votes", [4, 1, 0]);
    if (r.kind !== "match") {
      throw new Error("voting mode must record a match");
    }
    recordMatch("emoji-story", r.standings);
    expect(condition("crowd-favorite")(stateFromStore())).toBe(false);
  });

  test("Crowd Favorite unlocks from 5 real votes", () => {
    useGameStore.setState({ progress: {} });
    const r = emojiStoryRecord("votes", [5, 1, 0]);
    if (r.kind === "match") {
      recordMatch("emoji-story", r.standings);
    }
    expect(condition("crowd-favorite")(stateFromStore())).toBe(true);
  });
});

describe("host achievements count only real matches", () => {
  beforeEach(() => useGameStore.setState({ progress: {} }));

  test("solo / cooperative runs never advance Undefeated Host or Good Host", () => {
    const { updateProgress } = useGameStore.getState();
    for (let i = 0; i < 12; i += 1) {
      // The solo / cooperative paths as they record today.
      updateProgress("tilt-balance", 30, { won: true });
      updateProgress("duel-hangman", 20, { won: true });
      updateProgress("seat-neighbor", 8, { won: true });
      updateProgress("emoji-story", 0, { won: false });
    }
    const s = stateFromStore();
    expect(s.gameProgress["tilt-balance"].bestStreak).toBe(12);
    expect(condition("undefeated-host")(s)).toBe(false);
    expect(condition("good-host")(s)).toBe(false);
  });

  test("3 real wins in a row unlock Undefeated Host", () => {
    recordMatch("tilt-balance", win);
    recordMatch("tilt-balance", win);
    expect(condition("undefeated-host")(stateFromStore())).toBe(false);
    recordMatch("tilt-balance", win);
    expect(condition("undefeated-host")(stateFromStore())).toBe(true);
  });

  test("a loss resets the run; solo runs in between neither break nor extend it", () => {
    const { updateProgress } = useGameStore.getState();
    recordMatch("duel-hangman", win);
    recordMatch("duel-hangman", win);
    recordMatch("duel-hangman", loss);
    recordMatch("duel-hangman", win);
    updateProgress("duel-hangman", 10, { won: true }); // solo
    updateProgress("duel-hangman", 0, { won: false }); // solo
    recordMatch("duel-hangman", win);
    const p = useGameStore.getState().progress["duel-hangman"];
    expect(bestHostRun(p)).toBe(2);
    expect(hostedMatches(p)).toBe(5);
    expect(condition("undefeated-host")(stateFromStore())).toBe(false);
    recordMatch("duel-hangman", win);
    expect(bestHostRun(useGameStore.getState().progress["duel-hangman"])).toBe(
      3
    );
    expect(condition("undefeated-host")(stateFromStore())).toBe(true);
  });

  test("a draw is not a win", () => {
    recordMatch("duel-dice", win);
    recordMatch("duel-dice", win);
    recordMatch("duel-dice", [{ score: 3 }, { score: 3 }]);
    recordMatch("duel-dice", win);
    expect(bestHostRun(useGameStore.getState().progress["duel-dice"])).toBe(2);
  });

  test("10 real matches across games unlock Good Host (losses count)", () => {
    for (let i = 0; i < 5; i += 1) {
      recordMatch("duel-connect4", loss);
      recordMatch("category-blitz", i % 2 ? win : loss);
    }
    expect(condition("good-host")(stateFromStore())).toBe(true);
  });

  test("9 real matches + many solo runs stay below Good Host", () => {
    const { updateProgress } = useGameStore.getState();
    for (let i = 0; i < 9; i += 1) {
      recordMatch("tilt-balance", loss);
      updateProgress("tilt-balance", 30, { won: true });
    }
    expect(condition("good-host")(stateFromStore())).toBe(false);
  });
});

describe("hostStatsPatch legacy seeding", () => {
  test("games without a solo path seed from their legacy stats", () => {
    const legacy = makeProgress("duel-connect4", {
      bestStreak: 2,
      currentStreak: 2,
      timesPlayed: 7,
    });
    const patch = hostStatsPatch("duel-connect4", legacy, true);
    expect(patch[HOSTED_KEY]).toBe(8);
    expect(patch[BEST_RUN_KEY]).toBe(3);
  });

  test("a seeded legacy best run is kept when the current run is shorter", () => {
    const legacy = makeProgress("duel-connect4", {
      bestStreak: 5,
      currentStreak: 0,
      timesPlayed: 10,
    });
    // A win starts a 1-match run: the legacy best of 5 must survive.
    expect(hostStatsPatch("duel-connect4", legacy, true)).toEqual({
      [BEST_RUN_KEY]: 5,
      [HOSTED_KEY]: 11,
      [RUN_START_KEY]: 10,
    });
    expect(hostStatsPatch("duel-connect4", legacy, false)[BEST_RUN_KEY]).toBe(
      5
    );
  });

  test("an existing best run is never lowered by a new shorter run", () => {
    const p = makeProgress("duel-dice", { timesPlayed: 9 });
    p.levelStars = { [BEST_RUN_KEY]: 4, [HOSTED_KEY]: 9, [RUN_START_KEY]: 9 };
    expect(hostStatsPatch("duel-dice", p, true)[BEST_RUN_KEY]).toBe(4);
  });

  test.each(["duel-hangman", "emoji-story", "seat-neighbor", "tilt-balance"])(
    "%s (solo / cooperative path) never seeds from legacy stats",
    (id) => {
      const legacy = makeProgress(id, {
        bestStreak: 9,
        currentStreak: 9,
        timesPlayed: 20,
      });
      expect(hostStatsPatch(id, legacy, true)).toEqual({
        [BEST_RUN_KEY]: 1,
        [HOSTED_KEY]: 1,
        [RUN_START_KEY]: 0,
      });
    }
  );

  test("games with a solo path start from zero", () => {
    const legacy = makeProgress("tilt-balance", {
      bestStreak: 9,
      currentStreak: 9,
      timesPlayed: 20,
    });
    const patch = hostStatsPatch("tilt-balance", legacy, true);
    expect(patch[HOSTED_KEY]).toBe(1);
    expect(patch[BEST_RUN_KEY]).toBe(1);
  });
});

describe("Good Host / Undefeated Host keep legacy progress", () => {
  test("12 legacy matches across two games unlock Good Host immediately", () => {
    const s = stateWith({
      "duel-connect4": makeProgress("duel-connect4", { timesPlayed: 7 }),
      "duel-dice": makeProgress("duel-dice", { timesPlayed: 5 }),
    });
    expect(hostedMatches(s.gameProgress["duel-dice"], "duel-dice")).toBe(5);
    expect(condition("good-host")(s)).toBe(true);
  });

  test("legacy best streak of a match-only game counts for Undefeated Host", () => {
    const s = stateWith({
      "duel-tictactoe": makeProgress("duel-tictactoe", {
        bestStreak: 3,
        timesPlayed: 4,
      }),
    });
    expect(condition("undefeated-host")(s)).toBe(true);
  });

  test("solo-path games still need real matches", () => {
    const s = stateWith({
      "duel-hangman": makeProgress("duel-hangman", {
        bestStreak: 8,
        timesPlayed: 8,
      }),
      "tilt-balance": makeProgress("tilt-balance", {
        bestStreak: 9,
        timesPlayed: 9,
      }),
    });
    expect(condition("good-host")(s)).toBe(false);
    expect(condition("undefeated-host")(s)).toBe(false);
  });

  test("once the counter exists it wins over legacy stats", () => {
    const s = stateWith({
      "duel-connect4": makeProgress("duel-connect4", {
        levelStars: { [HOSTED_KEY]: 2 },
        timesPlayed: 50,
      }),
    });
    expect(
      hostedMatches(s.gameProgress["duel-connect4"], "duel-connect4")
    ).toBe(2);
    expect(condition("good-host")(s)).toBe(false);
  });

  test("seeding continues from the legacy count (no reset on first new match)", () => {
    useGameStore.setState({
      progress: {
        "duel-connect4": makeProgress("duel-connect4", { timesPlayed: 9 }),
      },
    });
    expect(condition("good-host")(stateFromStore())).toBe(false);
    recordMatch("duel-connect4", loss);
    expect(
      hostedMatches(useGameStore.getState().progress["duel-connect4"])
    ).toBe(10);
    expect(condition("good-host")(stateFromStore())).toBe(true);
  });
});

describe("high-scorer: score in 13 different games", () => {
  const scored = (n: number, extraUnscored: number) => {
    const out: Record<string, GameProgress> = {};
    for (let i = 0; i < n; i += 1) {
      out[`g${i}`] = makeProgress(`g${i}`, { highScore: 10 });
    }
    for (let i = 0; i < extraUnscored; i += 1) {
      out[`z${i}`] = makeProgress(`z${i}`, { highScore: 0 });
    }
    return stateWith(out);
  };

  test("12 scored games are not enough", () => {
    expect(condition("high-scorer")(scored(12, 0))).toBe(false);
  });

  test("13 scored games unlock it", () => {
    expect(condition("high-scorer")(scored(13, 0))).toBe(true);
  });

  test("unscored extra games no longer block it", () => {
    expect(condition("high-scorer")(scored(13, 20))).toBe(true);
    expect(condition("high-scorer")(scored(5, 20))).toBe(false);
  });
});

describe("score thresholds", () => {
  test.each([
    [1499, false],
    [1500, true],
    [2000, true],
  ])("puzzle-slider at %i → %s", (highScore, expected) => {
    const s = stateWith({
      "sliding-puzzle": makeProgress("sliding-puzzle", { highScore }),
    });
    expect(condition("puzzle-slider")(s)).toBe(expected);
  });

  // reaction score = 1000 − best ms; "under 200 ms" means score > 800.
  test.each([
    [800, false], // exactly 200 ms
    [801, true], // 199 ms
    [799, false],
  ])("speed-demon at score %i → %s", (highScore, expected) => {
    const s = stateWith({ reaction: makeProgress("reaction", { highScore }) });
    expect(condition("speed-demon")(s)).toBe(expected);
  });
});
