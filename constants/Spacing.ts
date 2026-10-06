/**
 * Shared spacing, radius and shadow tokens used across all screens.
 * Reference these instead of hardcoding numeric values.
 */

export const Spacing = {
  /** 24px */
  "2xl": 24,
  /** 28px */
  "3xl": 28,
  /** 32px */
  "4xl": 32,
  /** 16px */
  lg: 16,
  /** 12px */
  md: 12,
  /** 8px */
  sm: 8,
  /** 20px */
  xl: 20,
  /** 4px */
  xs: 4,
} as const;

export const Radius = {
  /** 14px — action buttons */
  button: 14,
  /** 12px — standard cards */
  card: 12,
  /** 10px — runway, medium chips */
  md: 10,
  /** 20px — modals, result overlays */
  modal: 20,
  /** 16px — info cards, panels */
  panel: 16,
  /** 999px — pill / fully rounded */
  pill: 999,
  /** 6px — small elements (markers, small chips) */
  sm: 6,
  /** 24px — large tap targets (reaction pad) */
  xl: 24,
} as const;

export const Shadow = {
  /** Subtle card shadow */
  card: {
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  /** Modal / overlay shadow */
  modal: {
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
} as const;
