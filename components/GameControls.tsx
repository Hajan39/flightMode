import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View as RNView, StyleSheet } from "react-native";

type Props = {
	onPause?: () => void;
	onReset?: () => void;
	/** When true, renders a "play" icon instead of "pause" — for resume from paused state. */
	isPaused?: boolean;
	/** Hide individual buttons via these flags */
	hidePause?: boolean;
	hideReset?: boolean;
};

/**
 * Floating row of game-control icon buttons (pause + reset).
 * Sits inline at the top of a game screen so every game has consistent affordances.
 */
export default function GameControls({
	onPause,
	onReset,
	isPaused,
	hidePause,
	hideReset,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const haptic = useHaptic();
	const { t } = useTranslation();

	if ((!onPause || hidePause) && (!onReset || hideReset)) return null;

	const handlePause = () => {
		haptic.tap();
		onPause?.();
	};
	const handleReset = () => {
		haptic.tap();
		onReset?.();
	};

	return (
		<RNView style={styles.row}>
			{onPause && !hidePause ? (
				<Pressable
					onPress={handlePause}
					hitSlop={8}
					style={[
						styles.btn,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					accessibilityLabel={isPaused ? t("gameResume") : t("gamePause")}
				>
					<Ionicons
						name={isPaused ? "play" : "pause"}
						size={18}
						color={theme.text}
					/>
				</Pressable>
			) : null}
			{onReset && !hideReset ? (
				<Pressable
					onPress={handleReset}
					hitSlop={8}
					style={[
						styles.btn,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					accessibilityLabel={t("gameRestart")}
				>
					<Ionicons name="refresh" size={18} color={theme.text} />
				</Pressable>
			) : null}
		</RNView>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		gap: Spacing.sm,
		alignSelf: "flex-end",
	},
	btn: {
		width: 36,
		height: 36,
		borderRadius: Radius.pill,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});
