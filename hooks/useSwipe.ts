import { useRef } from "react";
import type { GestureResponderEvent, ViewProps } from "react-native";

export type SwipeDirection = "up" | "down" | "left" | "right";

const MIN_DISTANCE = 24;

/** Direction of a drag, or null when it is too short to count as a swipe. */
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_DISTANCE) {
    return null;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

/**
 * Responder props that turn a swipe on the view into a direction. Plain
 * responder props (not PanResponder) so `onSwipe` is always the latest closure.
 */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const start = useRef({ x: 0, y: 0 });
  const props: ViewProps = {
    onResponderGrant: (e: GestureResponderEvent) => {
      start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const direction = swipeDirection(
        e.nativeEvent.pageX - start.current.x,
        e.nativeEvent.pageY - start.current.y
      );
      if (direction) {
        onSwipe(direction);
      }
    },
    onResponderTerminationRequest: () => false,
    onStartShouldSetResponder: () => true,
  };
  return props;
}
