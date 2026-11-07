import type { TranslationKey } from "@/i18n/translations";

/**
 * Breathing patterns for the Relax tab. Pure data + timing maths so the
 * timing tables are testable without rendering.
 *
 * Box breathing is free and the default (as it always was); the other four
 * are FlightMode Plus extras. Descriptions stay general-wellbeing — no
 * medical claims.
 */

/** in = inhale, inTop = second short "top-up" inhale, hold, out = exhale. */
export type BreathPhaseKind = "in" | "inTop" | "hold" | "out";

export interface BreathPhase {
  kind: BreathPhaseKind;
  seconds: number;
}

export type BreathPatternId =
  | "box"
  | "sleep-478"
  | "coherent"
  | "sigh"
  | "turbulence";

export interface BreathPattern {
  /** Sent as `exercise` with relax_start / relax_finish (no personal data). */
  analyticsId: string;
  descriptionKey: TranslationKey;
  id: BreathPatternId;
  nameKey: TranslationKey;
  phases: readonly BreathPhase[];
  /** FlightMode Plus extra. */
  plus: boolean;
}

export const BREATH_PATTERNS: readonly BreathPattern[] = [
  {
    analyticsId: "box_breathing",
    descriptionKey: "breathBoxDesc",
    id: "box",
    nameKey: "boxBreathing",
    phases: [
      { kind: "in", seconds: 4 },
      { kind: "hold", seconds: 4 },
      { kind: "out", seconds: 4 },
      { kind: "hold", seconds: 4 },
    ],
    plus: false,
  },
  {
    analyticsId: "breathing_478",
    descriptionKey: "breath478Desc",
    id: "sleep-478",
    nameKey: "breath478",
    phases: [
      { kind: "in", seconds: 4 },
      { kind: "hold", seconds: 7 },
      { kind: "out", seconds: 8 },
    ],
    plus: true,
  },
  {
    analyticsId: "coherent_breathing",
    descriptionKey: "breathCoherentDesc",
    id: "coherent",
    nameKey: "breathCoherent",
    phases: [
      { kind: "in", seconds: 5.5 },
      { kind: "out", seconds: 5.5 },
    ],
    plus: true,
  },
  {
    // Physiological sigh: a full inhale, a short second inhale on top, then a
    // long, slow exhale.
    analyticsId: "physiological_sigh",
    descriptionKey: "breathSighDesc",
    id: "sigh",
    nameKey: "breathSigh",
    phases: [
      { kind: "in", seconds: 2 },
      { kind: "inTop", seconds: 1 },
      { kind: "out", seconds: 6 },
    ],
    plus: true,
  },
  {
    analyticsId: "turbulence_calm",
    descriptionKey: "breathTurbulenceDesc",
    id: "turbulence",
    nameKey: "breathTurbulence",
    phases: [
      { kind: "in", seconds: 4 },
      { kind: "out", seconds: 6 },
    ],
    plus: true,
  },
];

export const DEFAULT_BREATH_PATTERN_ID: BreathPatternId = "box";

export const BREATH_PHASE_LABEL_KEY: Record<BreathPhaseKind, TranslationKey> = {
  hold: "hold",
  in: "breatheIn",
  inTop: "breatheInAgain",
  out: "breatheOut",
};

/** Circle scale each phase animates to; `null` = hold the current size. */
export const BREATH_PHASE_SCALE: Record<BreathPhaseKind, number | null> = {
  hold: null,
  in: 1.3,
  inTop: 1.4,
  out: 1,
};

export function getBreathPattern(id: string): BreathPattern {
  return (
    BREATH_PATTERNS.find((p) => p.id === id) ??
    (BREATH_PATTERNS[0] as BreathPattern)
  );
}

/** Free patterns always; Plus patterns only with Plus. */
export function canUseBreathPattern(
  pattern: Pick<BreathPattern, "plus">,
  plus: boolean
): boolean {
  return !pattern.plus || plus;
}

export function getCycleMs(pattern: Pick<BreathPattern, "phases">): number {
  return pattern.phases.reduce((sum, p) => sum + p.seconds * 1000, 0);
}

export interface BreathPosition {
  /** Completed full cycles since the start. */
  cycle: number;
  phaseIndex: number;
  /** Milliseconds left in the current phase (> 0). */
  remainingMs: number;
  /** Whole seconds shown in the circle (ceil of remainingMs). */
  secondsLeft: number;
}

/**
 * Where in the pattern we are `elapsedMs` after the start. Derived from the
 * wall clock (CLAUDE.md timer rule), so a slow or skipped tick never drifts.
 */
export function getBreathPosition(
  pattern: Pick<BreathPattern, "phases">,
  elapsedMs: number
): BreathPosition {
  const cycleMs = getCycleMs(pattern);
  const safeElapsed = Math.max(0, elapsedMs);
  const cycle = Math.floor(safeElapsed / cycleMs);
  let offset = safeElapsed - cycle * cycleMs;
  for (let i = 0; i < pattern.phases.length; i += 1) {
    const phaseMs = (pattern.phases[i] as BreathPhase).seconds * 1000;
    if (offset < phaseMs) {
      const remainingMs = phaseMs - offset;
      return {
        cycle,
        phaseIndex: i,
        remainingMs,
        secondsLeft: Math.ceil(remainingMs / 1000),
      };
    }
    offset -= phaseMs;
  }
  // Unreachable for a positive cycle length; keeps the return type total.
  const first = pattern.phases[0] as BreathPhase;
  return {
    cycle: cycle + 1,
    phaseIndex: 0,
    remainingMs: first.seconds * 1000,
    secondsLeft: Math.ceil(first.seconds),
  };
}
