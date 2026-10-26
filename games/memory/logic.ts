import { shuffle } from "@/utils/shuffle";

const EMOJIS = [
  "✈️",
  "🧳",
  "🛫",
  "🛬",
  "☁️",
  "🪪",
  "🎧",
  "🗺️",
  "🛩️",
  "🧃",
  "🌍",
  "🧭",
];

export interface Card {
  emoji: string;
  id: number;
  isFlipped: boolean;
  isMatched: boolean;
}

export function createDeck(pairCount = 6): Card[] {
  const selected = EMOJIS.slice(0, pairCount);
  const pairs = shuffle([...selected, ...selected]);

  return pairs.map((emoji, index) => ({
    emoji,
    id: index,
    isFlipped: false,
    isMatched: false,
  }));
}

export function checkMatch(cards: Card[], id1: number, id2: number): boolean {
  const card1 = cards.find((c) => c.id === id1);
  const card2 = cards.find((c) => c.id === id2);
  if (!(card1 && card2)) {
    return false;
  }
  return card1.emoji === card2.emoji;
}

export function calculateScore(moves: number, pairs: number): number {
  // Perfect score = pairs * 100, loses points for extra moves
  const perfectMoves = pairs;
  const extraMoves = Math.max(0, moves - perfectMoves);
  return Math.max(0, pairs * 100 - extraMoves * 10);
}
