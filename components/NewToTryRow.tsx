import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { gameRegistry } from "@/data/games";
import type { TranslationKey } from "@/i18n/translations";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";

interface Props {
  onOpenGame: (gameId: string) => void;
  renderTitle: (key: TranslationKey) => string;
  title: string;
}

const MAX_ITEMS = 4;

export default function NewToTryRow({ title, renderTitle, onOpenGame }: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const seenGameIds = useDiscoveryStore((s) => s.seenGameIds);

  // The registry grows by appending, so newest games come first here: an
  // update's new games show up on Home, not the oldest unplayed ones.
  const unseen = [...gameRegistry]
    .reverse()
    .filter((game) => !seenGameIds.includes(game.id))
    .slice(0, MAX_ITEMS);

  if (unseen.length === 0) {
    return null;
  }

  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView
        contentContainerStyle={styles.rowContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
      >
        {unseen.map((game) => (
          <AnimatedPressable
            key={game.id}
            onPress={() => onOpenGame(game.id)}
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.tint} name={game.icon as never} size={22} />
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
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
    width: 130,
  },
  cardMeta: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    marginBottom: 4,
  },
  rowContent: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
});
