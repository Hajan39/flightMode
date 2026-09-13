import { View as RNView, ScrollView, StyleSheet } from "react-native";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";

type Props = {
	players: MatchPlayer[];
	/** Primary number per seat (score / wins). */
	scores: number[];
	/** Highlights the seat whose turn it is. */
	activeIndex?: number;
	/** Optional secondary line per seat (e.g. "12 pts", "3 dice"). */
	detail?: (index: number) => string | null | undefined;
	format?: (value: number) => string;
};

/** Horizontal strip of one small card per player: dot, name, score, detail. */
export default function PlayerScoreStrip({
	players,
	scores,
	activeIndex,
	detail,
	format = (v) => String(v),
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={styles.scroll}
			contentContainerStyle={styles.row}
		>
			{players.map((p) => {
				const active = p.index === activeIndex;
				const extra = detail?.(p.index);
				return (
					<RNView
						key={p.index}
						style={[
							styles.card,
							{
								borderColor: active ? p.color : theme.border,
								backgroundColor: active ? `${p.color}1A` : theme.card,
							},
						]}
						accessibilityLabel={`${p.name}: ${format(scores[p.index] ?? 0)}${
							extra ? `, ${extra}` : ""
						}`}
					>
						<RNView style={styles.header}>
							<RNView style={[styles.dot, { backgroundColor: p.color }]} />
							<Text
								style={[
									styles.name,
									{ color: active ? p.color : theme.mutedText },
								]}
								numberOfLines={1}
							>
								{p.name}
							</Text>
						</RNView>
						<Text style={[styles.score, { color: theme.text }]}>
							{format(scores[p.index] ?? 0)}
						</Text>
						{extra ? (
							<Text style={[styles.detail, { color: theme.mutedText }]} numberOfLines={1}>
								{extra}
							</Text>
						) : null}
					</RNView>
				);
			})}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: { flexGrow: 0, alignSelf: "stretch" },
	row: { gap: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: "stretch" },
	card: {
		minWidth: 92,
		maxWidth: 140,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		gap: 2,
	},
	header: { flexDirection: "row", alignItems: "center", gap: 6 },
	dot: { width: 10, height: 10, borderRadius: 5 },
	name: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.black },
	score: { fontSize: FontSize.xl, fontWeight: FontWeight.black },
	detail: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
