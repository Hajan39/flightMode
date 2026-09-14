import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";

type Props = {
	/** Entering animation delay, kept per-section so the stagger stays as before. */
	delay: number;
	title?: string;
	hint?: string;
	/** First section on the screen has no top margin on its title. */
	first?: boolean;
	children: ReactNode;
};

/**
 * One Home section: staggered fade-in wrapper + optional title/hint.
 * Every Home block uses this so the spacing rhythm stays consistent.
 */
export default function HomeSection({ delay, title, hint, first, children }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];

	return (
		<Animated.View entering={FadeInDown.delay(delay).springify()}>
			{title ? (
				<Text style={[homeStyles.sectionTitle, first && styles.firstTitle]}>
					{title}
				</Text>
			) : null}
			{hint ? (
				<Text style={[homeStyles.sectionHint, { color: theme.mutedText }]}>
					{hint}
				</Text>
			) : null}
			{children}
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	firstTitle: { marginTop: 0 },
});

/** Styles shared by several Home components (section headers, cards, rows). */
export const homeStyles = StyleSheet.create({
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		marginBottom: 4,
		marginTop: Spacing["3xl"],
	},
	sectionHint: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
	iconCircle: {
		width: 26,
		height: 26,
		borderRadius: 13,
		alignItems: "center",
		justifyContent: "center",
	},
	// Horizontal game card rows (flight games, jump back in, play together)
	cardRow: { marginBottom: 4 },
	cardRowContent: { gap: 10 },
	gameCard: {
		width: 130,
		borderWidth: 1,
		borderRadius: Radius.panel,
		padding: Spacing.md,
		gap: 6,
		...Shadow.card,
	},
	gameCardTitle: { fontSize: 14, fontWeight: "700" },
	gameCardMeta: { fontSize: 12 },
	// Wide link card (destination, article)
	featuredCard: {
		marginTop: 10,
		borderWidth: 1,
		borderRadius: Radius.panel,
		padding: Spacing.lg,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		...Shadow.card,
	},
	featuredBody: { flex: 1 },
	featuredTitle: { fontSize: 15, fontWeight: "700", marginTop: 4 },
});
