import { useWindowDimensions } from "react-native";

/** Viewport width at/above which tablet-width content capping kicks in. */
export const TABLET_BREAKPOINT = 768;
/** Max width of the centered content column on tablet-sized viewports. */
export const TABLET_MAX_WIDTH = 640;

/**
 * Caps content to a centered column on tablet-sized viewports; a no-op on
 * phones. Spread `capStyle` onto a screen's outer container / scroll
 * content-container style.
 */
export function useTabletLayout() {
	const { width } = useWindowDimensions();
	const isTablet = width >= TABLET_BREAKPOINT;

	return {
		isTablet,
		capStyle: isTablet
			? { width: "100%" as const, maxWidth: TABLET_MAX_WIDTH, alignSelf: "center" as const }
			: null,
	};
}
