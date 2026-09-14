import { Ionicons } from "@expo/vector-icons";
import { ScrollView } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

export type GameCardItem = {
	id: string;
	/** Ionicons glyph name from the registry. */
	icon: string;
	title: string;
	/** Second line under the title (time estimate, best score, play mode…). */
	meta: string;
};

type Props = {
	items: GameCardItem[];
	onOpenGame: (gameId: string) => void;
};

/**
 * Horizontal row of game cards — shared by "Games for your flight",
 * "Jump back in" and "Play together".
 */
export default function GameCardRow({ items, onOpenGame }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={homeStyles.cardRow}
			contentContainerStyle={homeStyles.cardRowContent}
		>
			{items.map((item) => (
				<AnimatedPressable
					key={item.id}
					style={[
						homeStyles.gameCard,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => onOpenGame(item.id)}
				>
					<Ionicons name={item.icon as never} size={22} color={theme.tint} />
					<Text style={homeStyles.gameCardTitle}>{item.title}</Text>
					<Text style={[homeStyles.gameCardMeta, { color: theme.mutedText }]}>
						{item.meta}
					</Text>
				</AnimatedPressable>
			))}
		</ScrollView>
	);
}
