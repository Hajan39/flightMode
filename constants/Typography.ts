/**
 * Shared typography scale used across all screens and components.
 * Reference these instead of hardcoding fontSize / fontWeight.
 */

export const FontSize = {
	/** 11px — stat labels, meta chips, eyebrow text */
	xs: 11,
	/** 13px — hints, helper text, small body */
	sm: 13,
	/** 14px — secondary body, card descriptions */
	base: 14,
	/** 16px — primary body, button text */
	md: 16,
	/** 18px — card titles, quality feedback */
	lg: 18,
	/** 20px — section titles, big buttons */
	xl: 20,
	/** 22px — result titles */
	"2xl": 22,
	/** 28px — medium stat values */
	"3xl": 28,
	/** 40px — large stat values */
	"4xl": 40,
	/** 48px — hero score display */
	"5xl": 48,
} as const;

export const FontWeight = {
	regular: "400" as const,
	medium: "500" as const,
	semibold: "600" as const,
	bold: "700" as const,
	extrabold: "800" as const,
	black: "900" as const,
};

/** Preset text styles for common patterns */
export const TextStyle = {
	/** Uppercase label above a stat (ROUND, SCORE, TIME) */
	statLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.extrabold,
		letterSpacing: 1,
		textTransform: "uppercase" as const,
	},
	/** Large numeric stat value */
	statValueLarge: {
		fontSize: FontSize["4xl"],
		fontWeight: FontWeight.black,
		letterSpacing: -1,
	},
	/** Medium numeric stat value */
	statValueMedium: {
		fontSize: FontSize["3xl"],
		fontWeight: FontWeight.black,
		letterSpacing: -0.5,
	},
	/** Card title */
	cardTitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.semibold,
	},
	/** Card description / secondary text */
	cardDesc: {
		fontSize: FontSize.base,
		fontWeight: FontWeight.regular,
	},
	/** Small chip label (time, difficulty, score) */
	chipLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.bold,
	},
	/** Primary action button */
	buttonPrimary: {
		fontSize: FontSize.xl,
		fontWeight: FontWeight.black,
		letterSpacing: 1,
	},
	/** Secondary action button */
	buttonSecondary: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.bold,
		letterSpacing: 0.5,
	},
	/** Helper / hint text */
	hint: {
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
	},
} as const;
