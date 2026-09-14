import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

type Props = {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
};

/** Full-width bordered CTA under the flight card (preflight, checklist). */
export default function HomeCtaRow({ icon, label, onPress }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];

	return (
		<AnimatedPressable
			style={[styles.cta, { borderColor: theme.border }]}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
		>
			<Ionicons name={icon} size={18} color={theme.tint} />
			<Text style={[styles.ctaText, { color: theme.tint }]}>{label}</Text>
			<View style={[homeStyles.iconCircle, { backgroundColor: theme.surface }]}>
				<Ionicons name="chevron-forward" size={14} color={theme.mutedText} />
			</View>
		</AnimatedPressable>
	);
}

const styles = StyleSheet.create({
	cta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginTop: 12,
	},
	ctaText: { flex: 1, fontSize: 14, fontWeight: "600" },
});
