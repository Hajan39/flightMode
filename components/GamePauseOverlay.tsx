import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

type Props = {
	visible: boolean;
	onResume: () => void;
	onRestart?: () => void;
	onQuit?: () => void;
};

export default function GamePauseOverlay({
	visible,
	onResume,
	onRestart,
	onQuit,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const router = useRouter();

	if (!visible) return null;

	const handleResume = () => {
		haptic.tap();
		onResume();
	};
	const handleRestart = () => {
		haptic.tap();
		onRestart?.();
	};
	const handleQuit = () => {
		haptic.tap();
		if (onQuit) onQuit();
		else if (router.canGoBack()) router.back();
	};

	return (
		<Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
			<Animated.View
				entering={ZoomIn.springify().damping(14)}
				style={[
					styles.card,
					{ backgroundColor: theme.elevated, borderColor: theme.border },
				]}
			>
				<Ionicons name="pause-circle" size={48} color={theme.tint} />
				<Text style={[styles.title, { color: theme.text }]}>
					{t("gamePaused")}
				</Text>
				<RNView style={styles.actions}>
					<Pressable
						onPress={handleResume}
						style={[styles.btnPrimary, { backgroundColor: theme.tint }]}
					>
						<Ionicons name="play" size={20} color="#fff" />
						<Text style={styles.btnPrimaryText}>{t("gameResume")}</Text>
					</Pressable>
					{onRestart ? (
						<Pressable
							onPress={handleRestart}
							style={[
								styles.btnSecondary,
								{ borderColor: theme.border, backgroundColor: theme.card },
							]}
						>
							<Ionicons name="refresh" size={18} color={theme.text} />
							<Text style={[styles.btnSecondaryText, { color: theme.text }]}>
								{t("gameRestart")}
							</Text>
						</Pressable>
					) : null}
					<Pressable
						onPress={handleQuit}
						style={[
							styles.btnSecondary,
							{ borderColor: theme.border, backgroundColor: theme.card },
						]}
					>
						<Ionicons name="close" size={18} color={theme.mutedText} />
						<Text style={[styles.btnSecondaryText, { color: theme.text }]}>
							{t("gameQuit")}
						</Text>
					</Pressable>
				</RNView>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		zIndex: 20,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing["4xl"],
		backgroundColor: "rgba(0,0,0,0.6)",
	},
	card: {
		width: "100%",
		borderRadius: Radius.modal,
		borderWidth: 1,
		paddingVertical: Spacing["3xl"],
		paddingHorizontal: Spacing["3xl"],
		alignItems: "center",
		gap: Spacing.sm,
		...Shadow.modal,
	},
	title: {
		fontSize: FontSize.xl,
		fontWeight: FontWeight.black,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	actions: {
		alignSelf: "stretch",
		marginTop: Spacing.lg,
		gap: Spacing.sm,
	},
	btnPrimary: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.md,
		borderRadius: Radius.button,
	},
	btnPrimaryText: {
		color: "#fff",
		fontSize: FontSize.md,
		fontWeight: FontWeight.bold,
	},
	btnSecondary: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
		paddingVertical: Spacing.md,
		borderRadius: Radius.button,
		borderWidth: 1,
	},
	btnSecondaryText: {
		fontSize: FontSize.base,
		fontWeight: FontWeight.bold,
	},
});
