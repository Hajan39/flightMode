import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	/** Called when countdown reaches 0 / "GO" finishes. */
	onComplete: () => void;
	/** Override the starting number (default 3). */
	from?: number;
};

/**
 * Fullscreen 3-2-1-GO countdown overlay with haptic feedback per tick.
 * Auto-completes after the GO frame.
 */
export default function GameCountdown({ onComplete, from = 3 }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [value, setValue] = useState<number | "GO">(from);
	const scale = useSharedValue(0.4);
	const animStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	useEffect(() => {
		scale.value = withSequence(
			withSpring(1.1, { damping: 8, stiffness: 200 }),
			withTiming(0.9, { duration: 600 }),
		);
		if (value === "GO") {
			haptic.success();
			const id = setTimeout(onComplete, 450);
			return () => clearTimeout(id);
		}
		haptic.tap();
		const id = setTimeout(() => {
			setValue((prev) => {
				if (prev === "GO") return prev;
				if (prev <= 1) return "GO";
				return prev - 1;
			});
		}, 750);
		return () => clearTimeout(id);
		// Driven by `value` only; haptic + onComplete are stable refs in callers.
	}, [value]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Animated.View
			entering={FadeIn.duration(150)}
			exiting={FadeOut.duration(150)}
			style={styles.overlay}
		>
			<Animated.Text
				key={String(value)}
				style={[
					styles.text,
					{ color: value === "GO" ? theme.tint : theme.text },
					animStyle,
				]}
			>
				{value === "GO" ? t("gameGo") : value}
			</Animated.Text>
		</Animated.View>
	);
}

// keep `Text` referenced (used for theme typography parity)
void Text;

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		zIndex: 15,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(0,0,0,0.5)",
	},
	text: {
		fontSize: 120,
		fontWeight: "900",
		letterSpacing: -4,
	},
});
