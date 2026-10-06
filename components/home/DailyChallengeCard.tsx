import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import type { GameDefinition } from "@/data/games";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  game: GameDefinition;
  onPress: () => void;
}

/** Today's challenge card with the tint accent bar. */
export default function DailyChallengeCard({ game, onPress }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: theme.accentSoft, borderColor: theme.tint },
        Shadow.card,
      ]}
    >
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={[styles.accent, { backgroundColor: theme.tint }]}
      />
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.body}
      >
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.top}
        >
          <Ionicons color={theme.tint} name={game.icon as never} size={22} />
          <Text style={styles.title}>{t(game.titleKey)}</Text>
        </View>
        <Text style={[styles.description, { color: theme.mutedText }]}>
          {t(game.descriptionKey)}
        </Text>
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.ctaRow}
        >
          <Text style={[styles.cta, { color: theme.tint }]}>
            {t("dailyChallengeCta")}
          </Text>
          <Ionicons color={theme.tint} name="arrow-forward" size={16} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  accent: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  body: { gap: 8 },
  card: {
    borderRadius: Radius.panel + 4,
    borderWidth: 1,
    marginBottom: 4,
    overflow: "hidden",
    padding: Spacing.lg,
    paddingLeft: Spacing.xl,
  },
  cta: { fontSize: 13, fontWeight: "700" },
  ctaRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 2 },
  description: { fontSize: 14, lineHeight: 20 },
  title: { fontSize: 17, fontWeight: "700" },
  top: { alignItems: "center", flexDirection: "row", gap: 10 },
});
