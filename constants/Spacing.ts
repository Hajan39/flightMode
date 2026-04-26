/**
 * Shared spacing, radius and shadow tokens used across all screens.
 * Reference these instead of hardcoding numeric values.
 */

export const Spacing = {
	/** 4px */
	xs: 4,
	/** 8px */
	sm: 8,
	/** 12px */
	md: 12,
	/** 16px */
	lg: 16,
	/** 20px */
	xl: 20,
	/** 24px */
	"2xl": 24,
	/** 28px */
	"3xl": 28,
	/** 32px */
	"4xl": 32,
} as const;

export const Radius = {
	/** 6px — small elements (markers, small chips) */
	sm: 6,
	/** 10px — runway, medium chips */
	md: 10,
	/** 12px — standard cards */
	card: 12,
	/** 14px — action buttons */
	button: 14,
	/** 16px — info cards, panels */
	panel: 16,
	/** 20px — modals, result overlays */
	modal: 20,
	/** 24px — large tap targets (reaction pad) */
	xl: 24,
	/** 999px — pill / fully rounded */
	pill: 999,
} as const;

export const Shadow = {
	/** Subtle card shadow */
	card: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 6,
		elevation: 3,
	},
	/** Modal / overlay shadow */
	modal: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.12,
		shadowRadius: 12,
		elevation: 8,
	},
} as const;
