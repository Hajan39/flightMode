import type { ReactNode } from "react";
import { View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  compact?: boolean;
  /** Override the default "{name}'s turn" text (e.g. "Guessing for Ana"). */
  label?: string;
  player: MatchPlayer;
  /** Right-aligned slot, typically "Round 2/5". */
  right?: ReactNode;
}

/** Whose-turn strip: colored bar + dot + name, re-animates on player change. */
export default function TurnBanner({ player, label, right, compact }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="header"
      entering={FadeIn.duration(160)}
      key={`${player.index}-${label ?? ""}`}
      style={[
        styles.banner,
        compact && styles.bannerCompact,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <RNView style={[styles.bar, { backgroundColor: player.color }]} />
      <RNView style={[styles.dot, { backgroundColor: player.color }]} />
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          compact && styles.textCompact,
          { color: theme.text },
        ]}
      >
        {label ?? t("mpTurn", { player: player.name })}
      </Text>
      {right ? <RNView style={styles.right}>{right}</RNView> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    overflow: "hidden",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  bannerCompact: { paddingVertical: Spacing.sm },
  bar: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  dot: { borderRadius: 6, height: 12, marginLeft: Spacing.xs, width: 12 },
  right: { marginLeft: Spacing.sm },
  text: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  textCompact: { fontSize: FontSize.base },
});
