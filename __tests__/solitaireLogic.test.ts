import {
  applyMove,
  type Board,
  type Card,
  canAutoComplete,
  cardId,
  deal,
  dealPlayable,
  draw,
  finalScore,
  type GameState,
  isMovableRun,
  isWon,
  legalDestinations,
  mulberry32,
  nextAutoMove,
  undo,
} from "@/games/solitaire/logic";

const up = (rank: number, suit: Card["suit"]): Card => ({
  rank,
  suit,
  up: true,
});
const down = (rank: number, suit: Card["suit"]): Card => ({
  rank,
  suit,
  up: false,
});

function makeState(partial: Partial<Board>): GameState {
  return {
    drawCount: 1,
    foundations: [[], [], [], []],
    history: [],
    moves: 0,
    score: 0,
    stock: [],
    tableau: [[], [], [], [], [], [], []],
    waste: [],
    ...partial,
  };
}

describe("solitaire deal", () => {
  test("deals 28 tableau cards (1..7, top face-up) and 24 to the stock", () => {
    const state = deal(1, mulberry32(1));
    expect(state.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const pile of state.tableau) {
      expect(pile.at(-1)?.up).toBe(true);
      expect(pile.slice(0, -1).every((c) => !c.up)).toBe(true);
    }
    expect(state.stock).toHaveLength(24);
    const ids = new Set(
      [...state.stock, ...state.tableau.flat()].map((c) => cardId(c))
    );
    expect(ids.size).toBe(52);
  });

  test("is reproducible for a seed", () => {
    expect(deal(3, mulberry32(42))).toEqual(deal(3, mulberry32(42)));
  });

  test("dealPlayable returns a full deal", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const state = dealPlayable(1, mulberry32(seed));
      expect(state.stock.length + state.tableau.flat().length).toBe(52);
    }
  });
});

describe("solitaire stock", () => {
  test("draw-1 moves one card face-up to the waste", () => {
    const state = makeState({ stock: [down(5, 0), down(9, 1)] });
    const next = draw(state);
    expect(next?.waste).toEqual([up(9, 1)]);
    expect(next?.stock).toEqual([down(5, 0)]);
    expect(next?.moves).toBe(1);
  });

  test("draw-3 puts the third drawn card on top", () => {
    const state = makeState({
      drawCount: 3,
      stock: [down(1, 0), down(2, 0), down(3, 0), down(4, 0)],
    });
    const next = draw(state);
    expect(next?.waste.map((c) => c.rank)).toEqual([4, 3, 2]);
    expect(next?.stock.map((c) => c.rank)).toEqual([1]);
  });

  test("empty stock recycles the waste in original order, with a penalty", () => {
    const state = makeState({ score: 150, waste: [up(1, 0), up(2, 0)] });
    const next = draw(state);
    expect(next?.stock).toEqual([down(2, 0), down(1, 0)]);
    expect(next?.waste).toEqual([]);
    expect(next?.score).toBe(50);
    // Drawing again yields the first card that was drawn originally.
    expect(next && draw(next)?.waste).toEqual([up(1, 0)]);
  });

  test("returns null when stock and waste are empty", () => {
    expect(draw(makeState({}))).toBeNull();
  });
});

describe("solitaire moves", () => {
  test("alternating-colour descending stacking on the tableau", () => {
    const state = makeState({
      tableau: [[up(7, 0)], [up(6, 1)], [up(6, 3)], [], [], [], []],
    });
    // Red 6 on black 7: legal. Black 6 on black 7: illegal.
    expect(
      applyMove(state, {
        cardIndex: 0,
        from: { index: 1, kind: "tableau" },
        to: { index: 0, kind: "tableau" },
      })?.tableau[0]
    ).toEqual([up(7, 0), up(6, 1)]);
    expect(
      applyMove(state, {
        cardIndex: 0,
        from: { index: 2, kind: "tableau" },
        to: { index: 0, kind: "tableau" },
      })
    ).toBeNull();
  });

  test("only kings go to an empty tableau pile", () => {
    const state = makeState({ waste: [up(12, 1)] });
    expect(
      applyMove(state, {
        cardIndex: 0,
        from: { kind: "waste" },
        to: { index: 0, kind: "tableau" },
      })
    ).toBeNull();
    const kingState = makeState({ waste: [up(13, 1)] });
    const next = applyMove(kingState, {
      cardIndex: 0,
      from: { kind: "waste" },
      to: { index: 0, kind: "tableau" },
    });
    expect(next?.tableau[0]).toEqual([up(13, 1)]);
    expect(next?.score).toBe(5);
  });

  test("moving a run flips the exposed card and scores it", () => {
    const state = makeState({
      tableau: [
        [down(2, 2), up(9, 0), up(8, 1)],
        [up(10, 2)],
        [],
        [],
        [],
        [],
        [],
      ],
    });
    const next = applyMove(state, {
      cardIndex: 1,
      from: { index: 0, kind: "tableau" },
      to: { index: 1, kind: "tableau" },
    });
    expect(next?.tableau[0]).toEqual([up(2, 2)]);
    expect(next?.tableau[1]).toEqual([up(10, 2), up(9, 0), up(8, 1)]);
    expect(next?.score).toBe(5);
  });

  test("foundations build up by suit from the ace", () => {
    const state = makeState({
      foundations: [[up(1, 1)], [], [], []],
      tableau: [[up(2, 1)], [up(2, 0)], [], [], [], [], []],
    });
    const ok = applyMove(state, {
      cardIndex: 0,
      from: { index: 0, kind: "tableau" },
      to: { index: 0, kind: "foundation" },
    });
    expect(ok?.foundations[0]).toHaveLength(2);
    expect(ok?.score).toBe(10);
    expect(
      applyMove(state, {
        cardIndex: 0,
        from: { index: 1, kind: "tableau" },
        to: { index: 0, kind: "foundation" },
      })
    ).toBeNull();
  });

  test("a run cannot go to a foundation", () => {
    const state = makeState({
      foundations: [[up(1, 0)], [], [], []],
      tableau: [[up(2, 0), up(1, 1)], [], [], [], [], [], []],
    });
    expect(
      applyMove(state, {
        cardIndex: 0,
        from: { index: 0, kind: "tableau" },
        to: { index: 0, kind: "foundation" },
      })
    ).toBeNull();
  });

  test("isMovableRun rejects face-down and broken runs", () => {
    expect(isMovableRun([down(9, 0), up(8, 1)], 0)).toBe(false);
    expect(isMovableRun([up(9, 0), up(8, 1)], 0)).toBe(true);
    expect(isMovableRun([up(9, 0), up(8, 0)], 0)).toBe(false);
  });

  test("undo restores the previous board step by step", () => {
    const start = deal(1, mulberry32(7));
    const a = draw(start);
    const b = a && draw(a);
    expect(b).not.toBeNull();
    if (!(a && b)) {
      return;
    }
    expect(undo(b)).toEqual(a);
    expect(undo(undo(b))).toEqual(start);
    expect(undo(start)).toBe(start);
  });
});

describe("solitaire tap destinations", () => {
  test("foundation first, then tableau piles after the source", () => {
    const state = makeState({
      tableau: [[up(1, 1)], [], [], [], [], [], []],
    });
    expect(legalDestinations(state, { index: 0, kind: "tableau" }, 0)).toEqual([
      { index: 0, kind: "foundation" },
    ]);

    const multi = makeState({
      tableau: [[up(8, 0)], [], [up(9, 1)], [up(9, 2)], [], [], []],
    });
    expect(legalDestinations(multi, { index: 0, kind: "tableau" }, 0)).toEqual([
      { index: 2, kind: "tableau" },
      { index: 3, kind: "tableau" },
    ]);
    // From pile 3 the cycle continues at pile 4 and wraps to pile 2.
    const moved = makeState({
      tableau: [[], [], [up(9, 1)], [up(9, 2), up(8, 0)], [], [], []],
    });
    expect(legalDestinations(moved, { index: 3, kind: "tableau" }, 1)).toEqual([
      { index: 2, kind: "tableau" },
    ]);
  });

  test("a king at the bottom of its pile is not shuffled between empty piles", () => {
    const state = makeState({ tableau: [[up(13, 0)], [], [], [], [], [], []] });
    expect(legalDestinations(state, { index: 0, kind: "tableau" }, 0)).toEqual(
      []
    );
  });
});

describe("solitaire auto-complete and win", () => {
  function nearlyWon(): GameState {
    const foundations: Card[][] = [0, 1, 2, 3].map((suit) =>
      Array.from({ length: 11 }, (_, i) => up(i + 1, suit as Card["suit"]))
    );
    return makeState({
      foundations,
      tableau: [
        [up(13, 0), up(12, 1)],
        [up(13, 1), up(12, 0)],
        [up(13, 2), up(12, 3)],
        [up(13, 3), up(12, 2)],
        [],
        [],
        [],
      ],
    });
  }

  test("auto-completes to a win", () => {
    let state: GameState | null = nearlyWon();
    expect(canAutoComplete(state)).toBe(true);
    let guard = 0;
    while (state && !isWon(state) && guard < 52) {
      const move = nextAutoMove(state);
      expect(move).not.toBeNull();
      state = move ? applyMove(state, move) : null;
      guard += 1;
    }
    expect(state && isWon(state)).toBe(true);
    expect(state && canAutoComplete(state)).toBe(false);
  });

  test("not auto-completable with face-down cards or a stock", () => {
    expect(canAutoComplete(makeState({ stock: [down(1, 0)] }))).toBe(false);
    expect(
      canAutoComplete(
        makeState({ tableau: [[down(1, 0)], [], [], [], [], [], []] })
      )
    ).toBe(false);
  });

  test("final score rewards speed", () => {
    expect(finalScore(500, 120)).toBeGreaterThan(finalScore(500, 600));
    expect(finalScore(-10, 1)).toBe(finalScore(0, 30));
  });
});
