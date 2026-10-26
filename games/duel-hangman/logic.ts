/**
 * Hangman letter matching. The on-screen keyboard is plain A–Z, but words keep
 * their real spelling (PŘISTÁNÍ, FÄHRE): guessing a base letter reveals every
 * accented form of it, so "R" uncovers Ř and "E" uncovers É and Ě.
 */

const COMBINING_MARKS = /\p{M}/gu;

/** The keyboard letter that reveals `ch` (accents stripped, uppercase). */
export function baseLetter(ch: string): string {
  return ch.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase();
}

/** Does `word` contain any form of the keyboard `letter`? */
export function wordHasLetter(word: string, letter: string): boolean {
  return [...word].some((ch) => baseLetter(ch) === letter);
}

/** Is this word character uncovered by the guesses so far? */
export function isRevealed(ch: string, guessed: ReadonlySet<string>): boolean {
  return guessed.has(baseLetter(ch));
}

/** Every letter of `word` has been uncovered. */
export function isSolved(word: string, guessed: ReadonlySet<string>): boolean {
  return word.length > 0 && [...word].every((ch) => isRevealed(ch, guessed));
}

/** Number of guesses that matched nothing in `word`. */
export function countWrong(word: string, guessed: ReadonlySet<string>): number {
  return [...guessed].filter((l) => !wordHasLetter(word, l)).length;
}
