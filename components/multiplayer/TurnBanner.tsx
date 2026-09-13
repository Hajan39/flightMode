import { type ReactNode } from "react";
import { View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	player: MatchPlayer;
	/** Override the default "{name}'s turn" text (e.g. "Guessing for Ana"). */
	label?: string;
	/** Right-aligned slot, typically "Round 2/5". */
	right?: ReactNode;
	compact?: boolean;
};

/** Whose-turn strip: colored bar + dot + name, re-animates on player change. */
export default function TurnBanner({ player, label, right, compact }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<Animated.View
			key={`${player.index}-${label ?? ""}`}
			entering={FadeIn.duration(160)}
			style={[
				styles.banner,
				compact && styles.bannerCompact,
				{ backgroundColor: theme.card, borderColor: theme.border },
			]}
			accessibilityRole="header"
			accessibilityLiveRegion="polite"
		>
			<RNView style={[styles.bar, { backgroundColor: player.color }]} />
			<RNView style={[styles.dot, { backgroundColor: player.color }]} />
			<Text
				style={[styles.text, compact && styles.textCompact, { color: theme.text }]}
				numberOfLines={1}
			>
				{label ?? t("mpTurn", { player: player.name })}
			</Text>
			{right ? <RNView style={styles.right}>{right}</RNView> : null}
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	banner: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		overflow: "hidden",
		alignSelf: "stretch",
	},
	bannerCompact: { paddingVertical: Spacing.sm },
	bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
	dot: { width: 12, height: 12, borderRadius: 6, marginLeft: Spacing.xs },
	text: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold },
	textCompact: { fontSize: FontSize.base },
	right: { marginLeft: Spacing.sm },
});
