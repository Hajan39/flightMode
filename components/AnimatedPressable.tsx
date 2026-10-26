import type { ReactNode } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type ViewStyle,
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

const AnimatedPress = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 15, stiffness: 200 } as const;

/**
 * Pressable with a spring scale-down on press. Defaults to the `button`
 * accessibility role (every card using it is tappable); callers can override
 * it (e.g. `accessibilityRole="link"`).
 *
 * Shared values are written via `.set()` / read via `.get()` (Reanimated's
 * React-Compiler-compatible API) so the compiler can memoize this component.
 */
export default function AnimatedPressable({
  children,
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  accessibilityRole = "button",
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.set(withSpring(scaleTo, SPRING));
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    scale.set(withSpring(1, SPRING));
    onPressOut?.(e);
  };

  return (
    <AnimatedPress
      {...rest}
      accessibilityRole={accessibilityRole}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPress>
  );
}
