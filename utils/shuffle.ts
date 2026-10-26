/**
 * Unbiased Fisher–Yates shuffle. Returns a NEW array; the input is untouched.
 *
 * Use this instead of `arr.sort(() => Math.random() - 0.5)`, which is biased
 * (element positions are far from uniform and depend on the engine's sort).
 * `random` is injectable so tests can make the result deterministic.
 */
export function shuffle<T>(
  items: readonly T[],
  random: () => number = Math.random
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
