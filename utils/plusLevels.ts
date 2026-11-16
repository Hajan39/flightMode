// FlightMode Plus level packs — pure gating rules (tested in
// __tests__/plusLevels.test.ts).
//
// Rule from CLAUDE.md: never gate anything that is free today. Only levels
// explicitly flagged `plus: true` (the expert packs appended after the free
// levels) are gated; every other level is always playable.

/** Any level shape that may carry the Plus flag. */
export interface GatedLevel {
  /** True only for levels of a FlightMode Plus pack. */
  plus?: boolean;
}

/** What tapping a level in the picker does. */
export type LevelTapAction = "play" | "upsell";

/** The level belongs to a FlightMode Plus pack. */
export function isPlusLevel(level: GatedLevel): boolean {
  return level.plus === true;
}

/** Free levels are always playable; Plus levels only with the entitlement. */
export function canPlayLevel(level: GatedLevel, hasPlus: boolean): boolean {
  return !isPlusLevel(level) || hasPlus;
}

/** Start the level, or open the Plus screen for a locked Plus level. */
export function levelTapAction(
  level: GatedLevel,
  hasPlus: boolean
): LevelTapAction {
  return canPlayLevel(level, hasPlus) ? "play" : "upsell";
}
