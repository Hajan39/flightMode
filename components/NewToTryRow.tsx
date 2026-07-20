import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { gameRegistry } from "@/data/games";
import type { TranslationKey } from "@/i18n/translations";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";

type Props = {
	title: string;
	renderTitle: (key: TranslationKey) => string;
	onOpenGame: (gameId: string) => void;
};

const MAX_ITEMS = 4;

export default function NewToTryRow({
	title,
	renderTitle,
	onOpenGame,
}: Props) {
	const scheme = useColorScheme();
	const theme = Colors[scheme];
	const seenGameIds = useDiscoveryStore((s) => s.seenGameIds);

	const unseen = gameRegistry
		.filter((game) => !seenGameIds.includes(game.id))
		.slice(0, MAX_ITEMS);

	if (unseen.length === 0) {
		return null;
	}

	return (
		<>
			<Text style={styles.sectionTitle}>{title}</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.row}
				contentContainerStyle={styles.rowContent}
			>
				{unseen.map((game) => (
					<AnimatedPressable
						key={game.id}
						style={[
							styles.card,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
						onPress={() => onOpenGame(game.id)}
					>
						<Ionicons
							name={game.icon as never}
							size={22}
							color={theme.tint}
						/>
						<Text style={styles.cardTitle}>{renderTitle(game.titleKey)}</Text>
						<Text style={[styles.cardMeta, { color: theme.mutedText }]}>
							{`${game.estimatedTime} min`}
						</Text>
					</AnimatedPressable>
				))}
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		marginBottom: 10,
	},
	row: {
		marginBottom: 4,
	},
	rowContent: {
		gap: 10,
	},
	card: {
		width: 130,
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		gap: 6,
	},
	cardTitle: {
		fontSize: 14,
		fontWeight: "700",
	},
	cardMeta: {
		fontSize: 12,
	},
});
