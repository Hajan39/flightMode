import type { ReactNode } from "react";
import type {
	PressableProps,
	ViewStyle,
	GestureResponderEvent,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";

type Props = PressableProps & {
	children: ReactNode;
	style?: ViewStyle | ViewStyle[];
	scaleTo?: number;
};

const AnimatedPress = Animated.createAnimatedComponent(
	require("react-native").Pressable,
);

export default function AnimatedPressable({
	children,
	style,
	scaleTo = 0.97,
	onPressIn,
	onPressOut,
	...rest
}: Props) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	return (
		<AnimatedPress
			{...rest}
			onPressIn={(e: GestureResponderEvent) => {
				scale.value = withSpring(scaleTo, { damping: 15, stiffness: 200 });
				onPressIn?.(e);
			}}
			onPressOut={(e: GestureResponderEvent) => {
				scale.value = withSpring(1, { damping: 15, stiffness: 200 });
				onPressOut?.(e);
			}}
			style={[animatedStyle, style]}
		>
			{children}
		</AnimatedPress>
	);
}
