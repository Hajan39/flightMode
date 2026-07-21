// Pure, dependency-free Word Guess logic — extracted from the component so it
// can be unit-tested (green/yellow/gray marking incl. double letters, word pool
// integrity) without pulling in React Native.

export type LetterState = "correct" | "present" | "absent" | "empty" | "pending";

const AVIATION_WORDS = [
  "PILOT", "PLANE", "RADAR", "CABIN", "TOWER", "CARGO", "FLAPS", "CLOUD",
  "GATES", "ROUTE", "DELTA", "PITCH", "CLEAR", "CLIMB", "GLIDE", "HOVER",
  "ORBIT", "SKIES", "VAPOR", "GAUGE", "CHUTE", "SONIC", "BOOST", "WINDS",
  "FRONT", "NIGHT", "SKIDS", "TAXIS", "PYLON", "BRACE", "VISOR", "QUEUE",
  "TRAIL", "FUMES", "BRAKE", "SPEED", "LIGHT", "LAPSE", "STORM", "PROPS",
];

const COMMON_WORDS = [
  "RAISE", "HOUSE", "LIGHT", "PLACE", "STAND", "THINK", "FOUND", "GREAT",
  "OFTEN", "ABOVE", "EVERY", "THOSE", "STILL", "SINCE", "THREE", "WHILE",
  "MIGHT", "AFTER", "WATER", "ABOUT", "AGAIN", "WORLD", "NIGHT", "PHONE",
  "BLACK", "WHITE", "YOUNG", "SMALL", "HEART", "MUSIC", "DRIVE", "WRITE",
  "PAPER", "SHARE", "CHAIR", "SMILE", "FIELD", "DREAM", "BREAK",
  "CLOCK", "FLOOR", "POINT", "POWER", "BREAD", "EARTH", "GLASS", "GRADE",
  "GRACE", "PEACE", "PRIZE", "QUEEN", "SPACE", "SPARK", "STAGE", "STAKE",
  "STARE", "STORY", "STYLE", "SUITE", "SWEAR", "SWEET", "SWORD", "SWORE",
  "TABLE", "TASTE", "TEACH", "TEARS", "TEETH", "THANK", "THEME", "THICK",
  "THING", "THORN", "THOSE", "THROW", "TIGHT", "TIRED", "TODAY", "TOKEN",
  "TAKEN", "TOUGH", "TOWEL", "TRACK", "TRADE", "TRAIN", "TREAT", "TREND",
  "TRIBE", "TRICK", "TRIED", "BRING", "BUILD", "BUILT", "BURST", "BUYER",
  "CARGO", "CARRY", "CAUSE", "CEASE", "CEDAR", "CHALK", "CHAOS",
  "CHECK", "CHESS", "CHIEF", "CHILD", "CLAIM", "CLASS", "CLEAN", "CLERK",
];

export const WORD_POOL = [
  ...new Set([...AVIATION_WORDS, ...COMMON_WORDS]),
].filter((w) => w.length === 5);

export function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Wordle marking. Two passes so double letters resolve correctly: greens are
 * consumed first, then each remaining letter is matched against the still-
 * unconsumed target letters. Guarantees no more yellows/greens for a letter
 * than it actually occurs in the target.
 */
export function checkGuess(guess: string, target: string): LetterState[] {
  const states: LetterState[] = Array(5).fill("absent");
  const targetChars = target.split("");

  // Pass 1: greens
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      states[i] = "correct";
      targetChars[i] = ""; // consumed
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < 5; i++) {
    if (states[i] === "correct") continue;
    const idx = targetChars.indexOf(guess[i]);
    if (idx !== -1) {
      states[i] = "present";
      targetChars[idx] = ""; // consume
    }
  }

  return states;
}

export const PRIORITY: Record<LetterState, number> = {
  correct: 3,
  present: 2,
  absent: 1,
  empty: 0,
  pending: 0,
};

export function mergeKeyboard(
  existing: Record<string, LetterState>,
  newStates: LetterState[],
  letters: string[],
): Record<string, LetterState> {
  const next = { ...existing };
  letters.forEach((letter, i) => {
    const cur = next[letter];
    const inc = newStates[i];
    if (!cur || PRIORITY[inc] > PRIORITY[cur]) {
      next[letter] = inc;
    }
  });
  return next;
}
