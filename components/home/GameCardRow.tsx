import { Ionicons } from "@expo/vector-icons";
import { ScrollView } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

export interface GameCardItem {
  /** Ionicons glyph name from the registry. */
  icon: string;
  id: string;
  /** Second line under the title (time estimate, best score, play mode…). */
  meta: string;
  title: string;
}

interface Props {
  items: GameCardItem[];
  onOpenGame: (gameId: string) => void;
}

/**
 * Horizontal row of game cards — shared by "Games for your flight",
 * "Jump back in" and "Play together".
 */
export default function GameCardRow({ items, onOpenGame }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  return (
    <ScrollView
      contentContainerStyle={homeStyles.cardRowContent}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={homeStyles.cardRow}
    >
      {items.map((item) => (
        <AnimatedPressable
          key={item.id}
          onPress={() => onOpenGame(item.id)}
          style={[
            homeStyles.gameCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons color={theme.tint} name={item.icon as never} size={22} />
          <Text style={homeStyles.gameCardTitle}>{item.title}</Text>
          <Text style={[homeStyles.gameCardMeta, { color: theme.mutedText }]}>
            {item.meta}
          </Text>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
}
