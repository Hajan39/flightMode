import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";

interface Props {
  children: ReactNode;
  /** Entering animation delay, kept per-section so the stagger stays as before. */
  delay: number;
  /** First section on the screen has no top margin on its title. */
  first?: boolean;
  hint?: string;
  title?: string;
}

/**
 * One Home section: staggered fade-in wrapper + optional title/hint.
 * Every Home block uses this so the spacing rhythm stays consistent.
 */
export default function HomeSection({
  delay,
  title,
  hint,
  first,
  children,
}: Props) {
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
  // Horizontal game card rows (flight games, jump back in, play together)
  cardRow: { marginBottom: 4 },
  cardRowContent: { gap: 10 },
  featuredBody: { flex: 1 },
  // Wide link card (destination, article)
  featuredCard: {
    alignItems: "center",
    borderRadius: Radius.panel,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  featuredTitle: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  gameCard: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    gap: 6,
    padding: Spacing.md,
    width: 130,
    ...Shadow.card,
  },
  gameCardMeta: { fontSize: 12 },
  gameCardTitle: { fontSize: 14, fontWeight: "700" },
  iconCircle: {
    alignItems: "center",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  sectionHint: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: Spacing["3xl"],
  },
});
