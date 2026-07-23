import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Whether the OS "Reduce Motion" accessibility setting is on. Updates live. */
export function useReduceMotion(): boolean {
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		let mounted = true;
		AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
			if (mounted) setReduceMotion(enabled);
		});
		const sub = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			setReduceMotion,
		);
		return () => {
			mounted = false;
			sub.remove();
		};
	}, []);

	return reduceMotion;
}
