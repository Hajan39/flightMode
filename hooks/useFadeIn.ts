import { useEffect } from "react";
import {
	useSharedValue,
	useAnimatedStyle,
	withDelay,
	withTiming,
	Easing,
} from "react-native-reanimated";

/**
 * Returns an animated style that fades in from opacity 0 to 1.
 * @param delay - delay in ms before starting the fade
 * @param duration - animation duration in ms
 */
export function useFadeIn(delay = 0, duration = 400) {
	const opacity = useSharedValue(0);
	const translateY = useSharedValue(12);

	useEffect(() => {
		opacity.value = withDelay(
			delay,
			withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
		);
		translateY.value = withDelay(
			delay,
			withTiming(0, { duration, easing: Easing.out(Easing.cubic) }),
		);
	}, []);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }],
	}));

	return animatedStyle;
}
