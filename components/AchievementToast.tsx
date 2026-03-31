import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
	SlideInDown,
	SlideOutDown,
	FadeIn,
	FadeOut,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { achievements } from "@/data/achievements";
import { useHaptic } from "@/hooks/useHaptic";

const DISPLAY_MS = 3000;

export default function AchievementToast() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const newUnlockedIds = useAchievementStore((s) => s.newUnlockedIds);
	const [visible, setVisible] = useState<string | null>(null);
	const [queue, setQueue] = useState<string[]>([]);

	// When new achievements are unlocked, add them to display queue
	useEffect(() => {
		if (newUnlockedIds.length > 0) {
			setQueue((prev) => {
				const fresh = newUnlockedIds.filter(
					(id) => !prev.includes(id) && id !== visible,
				);
				return [...prev, ...fresh];
			});
		}
	}, [newUnlockedIds]);

	// Process queue
	useEffect(() => {
		if (visible || queue.length === 0) return;

		const next = queue[0];
		setQueue((prev) => prev.slice(1));
		setVisible(next);
		haptic.heavy();

		const timer = setTimeout(() => {
			setVisible(null);
		}, DISPLAY_MS);

		return () => clearTimeout(timer);
	}, [visible, queue]);

	if (!visible) return null;

	const achievement = achievements.find((a) => a.id === visible);
	if (!achievement) return null;

	return (
		<Animated.View
			entering={SlideInDown.springify().damping(18)}
			exiting={SlideOutDown.duration(300)}
			style={[
				styles.container,
				{
					backgroundColor: theme.card,
					borderColor: theme.tint,
				},
			]}
		>
			<Ionicons name={achievement.icon as never} size={28} color={theme.tint} />
			<Animated.View entering={FadeIn.delay(200)} style={styles.textWrap}>
				<Animated.Text style={[styles.label, { color: theme.mutedText }]}>
					{t("achievementUnlocked")}
				</Animated.Text>
				<Animated.Text style={[styles.title, { color: theme.text }]}>
					{t(achievement.titleKey)}
				</Animated.Text>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		bottom: 100,
		left: 20,
		right: 20,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 18,
		borderRadius: 16,
		borderWidth: 1.5,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 8,
	},
	textWrap: { flex: 1 },
	label: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
	title: { fontSize: 15, fontWeight: "700", marginTop: 2 },
});
