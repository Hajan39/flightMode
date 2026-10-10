/**
 * Klondike solitaire — pure game logic (no React). Randomness is injected so
 * deals are reproducible in tests.
 *
 * Board state is immutable: every move returns a new state whose untouched
 * piles share their arrays with the previous one, so the undo history
 * (a stack of previous boards) stays cheap.
 */

export type Suit = 0 | 1 | 2 | 3;
export type DrawCount = 1 | 3;

/** Text-presentation selector keeps Android from drawing suits as emoji. */
export const SUIT_SYMBOLS = ["♠︎", "♥︎", "♦︎", "♣︎"];
export const RANK_LABELS = [
  "",
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export interface Card {
  /** 1 = Ace … 13 = King */
  rank: number;
  suit: Suit;
  up: boolean;
}

export type PileRef =
  | { kind: "stock" }
  | { kind: "waste" }
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number };

export interface Move {
  /** Index of the first moved card in the source pile. */
  cardIndex: number;
  from: PileRef;
  to: PileRef;
}

export interface Board {
  foundations: Card[][];
  moves: number;
  score: number;
  stock: Card[];
  tableau: Card[][];
  waste: Card[];
}

export interface GameState extends Board {
  drawCount: DrawCount;
  history: Board[];
}

export const TABLEAU_COUNT = 7;
export const FOUNDATION_COUNT = 4;

// Windows-style scoring
const SCORE_WASTE_TO_TABLEAU = 5;
const SCORE_TO_FOUNDATION = 10;
const SCORE_FLIP = 5;
const SCORE_FOUNDATION_TO_TABLEAU = -15;
const RECYCLE_PENALTY: Record<DrawCount, number> = { 1: -100, 3: -20 };
const TIME_BONUS = 700_000;
const MIN_BONUS_SECONDS = 30;

export function cardId(card: Card): number {
  return card.suit * 13 + card.rank - 1;
}

export function isRed(card: Card): boolean {
  return card.suit === 1 || card.suit === 2;
}

/** Small seeded PRNG (mulberry32) — returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit += 1) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ rank, suit: suit as Suit, up: false });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function deal(drawCount: DrawCount, rng: () => number): GameState {
  const deck = shuffle(createDeck(), rng);
  const tableau: Card[][] = [];
  let next = 0;
  for (let pile = 0; pile < TABLEAU_COUNT; pile += 1) {
    const cards: Card[] = [];
    for (let i = 0; i <= pile; i += 1) {
      cards.push({ ...deck[next], up: i === pile });
      next += 1;
    }
    tableau.push(cards);
  }
  return {
    drawCount,
    foundations: [[], [], [], []],
    history: [],
    moves: 0,
    score: 0,
    stock: deck.slice(next),
    tableau,
    waste: [],
  };
}

/** Legal non-stock moves available right after the deal. */
export function countOpeningMoves(state: GameState): number {
  let count = 0;
  state.tableau.forEach((pile, index) => {
    const from: PileRef = { index, kind: "tableau" };
    count += legalDestinations(state, from, pile.length - 1).length;
  });
  return count;
}

/**
 * Deal, preferring a deal with at least one opening tableau move so the
 * first screen is not stock-only.
 * ponytail: not a solvability check — a real solver would need a DFS over
 * the stock; add it if players report dead deals.
 */
export function dealPlayable(
  drawCount: DrawCount,
  rng: () => number,
  tries = 20
): GameState {
  let state = deal(drawCount, rng);
  for (let i = 1; i < tries && countOpeningMoves(state) === 0; i += 1) {
    state = deal(drawCount, rng);
  }
  return state;
}

export function getPile(board: Board, ref: PileRef): Card[] {
  switch (ref.kind) {
    case "stock":
      return board.stock;
    case "waste":
      return board.waste;
    case "foundation":
      return board.foundations[ref.index];
    default:
      return board.tableau[ref.index];
  }
}

function setPile(board: Board, ref: PileRef, cards: Card[]): Board {
  switch (ref.kind) {
    case "stock":
      return { ...board, stock: cards };
    case "waste":
      return { ...board, waste: cards };
    case "foundation": {
      const foundations = [...board.foundations];
      foundations[ref.index] = cards;
      return { ...board, foundations };
    }
    default: {
      const tableau = [...board.tableau];
      tableau[ref.index] = cards;
      return { ...board, tableau };
    }
  }
}

export function canDropOnFoundation(card: Card, pile: Card[]): boolean {
  const top = pile.at(-1);
  if (!top) {
    return card.rank === 1;
  }
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canDropOnTableau(card: Card, pile: Card[]): boolean {
  const top = pile.at(-1);
  if (!top) {
    return card.rank === 13;
  }
  return top.up && isRed(top) !== isRed(card) && card.rank === top.rank - 1;
}

/** Cards from `index` to the top form a face-up, alternating, descending run. */
export function isMovableRun(pile: Card[], index: number): boolean {
  if (index < 0 || index >= pile.length) {
    return false;
  }
  for (let i = index; i < pile.length; i += 1) {
    const card = pile[i];
    if (!card.up) {
      return false;
    }
    const below = pile[i + 1];
    if (
      below &&
      (isRed(below) === isRed(card) || below.rank !== card.rank - 1)
    ) {
      return false;
    }
  }
  return true;
}

/** Can the cards starting at `cardIndex` be picked up from this pile? */
export function canPickUp(
  board: Board,
  from: PileRef,
  cardIndex: number
): boolean {
  const pile = getPile(board, from);
  if (from.kind === "stock") {
    return false;
  }
  if (from.kind === "tableau") {
    return isMovableRun(pile, cardIndex);
  }
  // Waste / foundation: only the top card.
  return pile.length > 0 && cardIndex === pile.length - 1;
}

function samePile(a: PileRef, b: PileRef): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  return !("index" in a && "index" in b) || a.index === b.index;
}

export function isLegalMove(board: Board, move: Move): boolean {
  const { from, to, cardIndex } = move;
  if (samePile(from, to) || to.kind === "stock" || to.kind === "waste") {
    return false;
  }
  if (!canPickUp(board, from, cardIndex)) {
    return false;
  }
  const src = getPile(board, from);
  const card = src[cardIndex];
  const dst = getPile(board, to);
  if (to.kind === "foundation") {
    return cardIndex === src.length - 1 && canDropOnFoundation(card, dst);
  }
  return canDropOnTableau(card, dst);
}

function snapshot(state: GameState): Board {
  const { foundations, moves, score, stock, tableau, waste } = state;
  return { foundations, moves, score, stock, tableau, waste };
}

function withScore(board: Board, delta: number): Board {
  return { ...board, score: Math.max(0, board.score + delta) };
}

function moveScore(move: Move): number {
  const { from, to } = move;
  if (to.kind === "foundation") {
    return from.kind === "foundation" ? 0 : SCORE_TO_FOUNDATION;
  }
  if (from.kind === "waste") {
    return SCORE_WASTE_TO_TABLEAU;
  }
  if (from.kind === "foundation") {
    return SCORE_FOUNDATION_TO_TABLEAU;
  }
  return 0;
}

/** Applies a legal move (and flips the newly exposed tableau card). Returns null when illegal. */
export function applyMove(state: GameState, move: Move): GameState | null {
  if (!isLegalMove(state, move)) {
    return null;
  }
  const src = getPile(state, move.from);
  const moving = src.slice(move.cardIndex);
  let remaining = src.slice(0, move.cardIndex);
  let delta = moveScore(move);

  const exposed = remaining.at(-1);
  if (move.from.kind === "tableau" && exposed && !exposed.up) {
    remaining = [...remaining.slice(0, -1), { ...exposed, up: true }];
    delta += SCORE_FLIP;
  }

  let board: Board = setPile(snapshot(state), move.from, remaining);
  board = setPile(board, move.to, [...getPile(board, move.to), ...moving]);
  board = withScore({ ...board, moves: board.moves + 1 }, delta);
  return {
    ...board,
    drawCount: state.drawCount,
    history: [...state.history, snapshot(state)],
  };
}

/** Draw from the stock, or recycle the waste when the stock is empty. Null when both are empty. */
export function draw(state: GameState): GameState | null {
  const history = [...state.history, snapshot(state)];
  if (state.stock.length === 0) {
    if (state.waste.length === 0) {
      return null;
    }
    const stock = [...state.waste].reverse().map((c) => ({ ...c, up: false }));
    const board = withScore(
      { ...snapshot(state), moves: state.moves + 1, stock, waste: [] },
      RECYCLE_PENALTY[state.drawCount]
    );
    return { ...board, drawCount: state.drawCount, history };
  }
  const count = Math.min(state.drawCount, state.stock.length);
  const drawn = state.stock
    .slice(-count)
    .reverse()
    .map((c) => ({ ...c, up: true }));
  return {
    ...state,
    history,
    moves: state.moves + 1,
    stock: state.stock.slice(0, -count),
    waste: [...state.waste, ...drawn],
  };
}

export function undo(state: GameState): GameState {
  const previous = state.history.at(-1);
  if (!previous) {
    return state;
  }
  return {
    ...previous,
    drawCount: state.drawCount,
    history: state.history.slice(0, -1),
  };
}

/**
 * Legal destinations for the cards starting at `cardIndex`, best first:
 * a foundation (single top card only), then tableau piles in order starting
 * after the source pile — so repeated taps on the same card cycle through
 * the tableau options.
 */
export function legalDestinations(
  board: Board,
  from: PileRef,
  cardIndex: number
): PileRef[] {
  const out: PileRef[] = [];
  if (!canPickUp(board, from, cardIndex)) {
    return out;
  }
  if (from.kind !== "foundation") {
    for (let index = 0; index < FOUNDATION_COUNT; index += 1) {
      const to: PileRef = { index, kind: "foundation" };
      if (isLegalMove(board, { cardIndex, from, to })) {
        out.push(to);
        break;
      }
    }
  }
  const start = from.kind === "tableau" ? from.index : -1;
  for (let k = 1; k <= TABLEAU_COUNT; k += 1) {
    const index = (start + k + TABLEAU_COUNT) % TABLEAU_COUNT;
    const to: PileRef = { index, kind: "tableau" };
    // A King already at the bottom of its pile gains nothing on another empty pile.
    const pointless =
      from.kind === "tableau" &&
      cardIndex === 0 &&
      board.tableau[index].length === 0;
    if (!pointless && isLegalMove(board, { cardIndex, from, to })) {
      out.push(to);
    }
  }
  return out;
}

/** Everything is face-up and the stock/waste are empty: the game plays itself out. */
export function canAutoComplete(board: Board): boolean {
  return (
    board.stock.length === 0 &&
    board.waste.length === 0 &&
    !isWon(board) &&
    board.tableau.every((pile) => pile.every((c) => c.up))
  );
}

/** Next foundation move for auto-complete: the lowest-ranked playable card. */
export function nextAutoMove(board: Board): Move | null {
  let best: Move | null = null;
  let bestRank = 99;
  const sources: PileRef[] = [
    { kind: "waste" },
    ...board.tableau.map((_, index): PileRef => ({ index, kind: "tableau" })),
  ];
  for (const from of sources) {
    const pile = getPile(board, from);
    const top = pile.at(-1);
    if (!top || top.rank >= bestRank) {
      continue;
    }
    const cardIndex = pile.length - 1;
    for (let index = 0; index < FOUNDATION_COUNT; index += 1) {
      const move: Move = { cardIndex, from, to: { index, kind: "foundation" } };
      if (isLegalMove(board, move)) {
        best = move;
        bestRank = top.rank;
        break;
      }
    }
  }
  return best;
}

export function isWon(board: Board): boolean {
  return board.foundations.every((pile) => pile.length === 13);
}

/** Final score on a win: move score + a time bonus (faster = more). */
export function finalScore(score: number, seconds: number): number {
  return (
    Math.max(0, score) +
    Math.round(TIME_BONUS / Math.max(MIN_BONUS_SECONDS, seconds))
  );
}
