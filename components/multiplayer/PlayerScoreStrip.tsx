import { View as RNView, ScrollView, StyleSheet } from "react-native";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";

interface Props {
  /** Highlights the seat whose turn it is. */
  activeIndex?: number;
  /** Optional secondary line per seat (e.g. "12 pts", "3 dice"). */
  detail?: (index: number) => string | null | undefined;
  format?: (value: number) => string;
  players: MatchPlayer[];
  /** Primary number per seat (score / wins). */
  scores: number[];
}

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
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      {players.map((p) => {
        const active = p.index === activeIndex;
        const extra = detail?.(p.index);
        return (
          <RNView
            accessibilityLabel={`${p.name}: ${format(scores[p.index] ?? 0)}${
              extra ? `, ${extra}` : ""
            }`}
            key={p.index}
            style={[
              styles.card,
              {
                backgroundColor: active ? `${p.color}1A` : theme.card,
                borderColor: active ? p.color : theme.border,
              },
            ]}
          >
            <RNView style={styles.header}>
              <RNView style={[styles.dot, { backgroundColor: p.color }]} />
              <Text
                numberOfLines={1}
                style={[
                  styles.name,
                  { color: active ? p.color : theme.mutedText },
                ]}
              >
                {p.name}
              </Text>
            </RNView>
            <Text style={[styles.score, { color: theme.text }]}>
              {format(scores[p.index] ?? 0)}
            </Text>
            {extra ? (
              <Text
                numberOfLines={1}
                style={[styles.detail, { color: theme.mutedText }]}
              >
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
  card: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    gap: 2,
    maxWidth: 140,
    minWidth: 92,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  detail: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  dot: { borderRadius: 5, height: 10, width: 10 },
  header: { alignItems: "center", flexDirection: "row", gap: 6 },
  name: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.black },
  row: {
    alignItems: "stretch",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  score: { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  scroll: { alignSelf: "stretch", flexGrow: 0 },
});
