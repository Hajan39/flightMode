import {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";

/**
 * Returns an Animated component wrapper that scales slightly on press.
 * Usage: <AnimatedPressable onPressIn={onPressIn} onPressOut={onPressOut} style={animatedStyle}>
 */
export function useAnimatedPress(scaleTo = 0.97) {
	const scale = useSharedValue(1);

	const onPressIn = () => {
		scale.value = withSpring(scaleTo, { damping: 15, stiffness: 200 });
	};

	const onPressOut = () => {
		scale.value = withSpring(1, { damping: 15, stiffness: 200 });
	};

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	return { onPressIn, onPressOut, animatedStyle };
}
