/**
 * Tiny property-based testing kit (no dependencies): a seeded PRNG, a few
 * generators and a `forAll` runner that reports the failing seed.
 *
 * Reproduce a failure with `PROP_SEED=<seed> npx jest <file>` — the runner
 * then executes only that seed for every property.
 */

export type Rng = () => number;

/** mulberry32: small, fast, good enough for test-case generation. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Stable 32-bit hash of a property name (base seed per property). */
function hashName(name: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

export interface Gen {
  /** True with probability `p`. */
  bool: (p?: number) => boolean;
  /** Float in [lo, hi). */
  float: (lo: number, hi: number) => number;
  /** Integer in [lo, hi] (inclusive). */
  int: (lo: number, hi: number) => number;
  /** Random element of a non-empty array. */
  pick: <T>(items: readonly T[]) => T;
  /** The raw PRNG (to hand to the code under test). */
  rng: Rng;
  /** Fisher–Yates copy. */
  shuffled: <T>(items: readonly T[]) => T[];
  /** String of `length` characters drawn from `alphabet`. */
  string: (alphabet: string, length: number) => string;
}

export function makeGen(seed: number): Gen {
  const rng = mulberry32(seed);
  const int = (lo: number, hi: number) =>
    lo + Math.floor(rng() * (hi - lo + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];
  return {
    bool: (p = 0.5) => rng() < p,
    float: (lo, hi) => lo + rng() * (hi - lo),
    int,
    pick,
    rng,
    shuffled: <T>(items: readonly T[]) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    string: (alphabet, length) => {
      const chars = [...alphabet];
      let out = "";
      for (let i = 0; i < length; i += 1) {
        out += pick(chars);
      }
      return out;
    },
  };
}

function fixedSeed(): number | null {
  const raw = process.env.PROP_SEED;
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value >>> 0 : null;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs `property` for `cases` seeds derived from the property name. The
 * first failing case is rethrown with its seed in the message.
 */
export function forAll(
  name: string,
  cases: number,
  property: (g: Gen, seed: number) => void
): void {
  const only = fixedSeed();
  const base = hashName(name);
  const seeds =
    only === null
      ? Array.from({ length: cases }, (_, i) => (base + i * 7919) >>> 0)
      : [only];
  for (const seed of seeds) {
    try {
      property(makeGen(seed), seed);
    } catch (error) {
      throw new Error(
        `Property "${name}" failed for seed ${seed} (reproduce: PROP_SEED=${seed}):\n${describeError(error)}`,
        { cause: error }
      );
    }
  }
}

/** Async variant of `forAll` (model-based tests over promises). */
export async function forAllAsync(
  name: string,
  cases: number,
  property: (g: Gen, seed: number) => Promise<void>
): Promise<void> {
  const only = fixedSeed();
  const base = hashName(name);
  const seeds =
    only === null
      ? Array.from({ length: cases }, (_, i) => (base + i * 7919) >>> 0)
      : [only];
  for (const seed of seeds) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: cases run one after another so a failure names one seed
      await property(makeGen(seed), seed);
    } catch (error) {
      throw new Error(
        `Property "${name}" failed for seed ${seed} (reproduce: PROP_SEED=${seed}):\n${describeError(error)}`,
        { cause: error }
      );
    }
  }
}

/** Plain assertion with a message (cheaper than `expect` in hot loops). */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
