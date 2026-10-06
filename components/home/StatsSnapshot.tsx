import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  achievementsTotal: number;
  achievementsUnlocked: number;
  flights: number;
  gamesPlayed: number;
  onOpenProfile: () => void;
}

/** Three-stat snapshot card with a profile link. */
export default function StatsSnapshot({
  gamesPlayed,
  flights,
  achievementsUnlocked,
  achievementsTotal,
  onOpenProfile,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  const stats = [
    {
      key: "games",
      label: t("profileGamesPlayed"),
      value: String(gamesPlayed),
    },
    { key: "flights", label: t("profileFlights"), value: String(flights) },
    {
      key: "achievements",
      label: t("profileAchievements"),
      value: `${achievementsUnlocked}/${achievementsTotal}`,
    },
  ];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View darkColor="transparent" lightColor="transparent" style={styles.row}>
        {stats.map((stat) => (
          <View
            darkColor="transparent"
            key={stat.key}
            lightColor="transparent"
            style={styles.item}
          >
            <Text style={[styles.value, { color: theme.text }]}>
              {stat.value}
            </Text>
            <Text style={[styles.label, { color: theme.mutedText }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
      <AnimatedPressable
        onPress={onOpenProfile}
        style={[styles.profileCta, { borderColor: theme.border }]}
      >
        <Ionicons color={theme.tint} name="person-circle-outline" size={18} />
        <Text style={[styles.profileCtaText, { color: theme.tint }]}>
          {t("stackProfile")}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    gap: 12,
    marginBottom: 6,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  item: { alignItems: "center", flex: 1 },
  label: { fontSize: 11, marginTop: 2, textAlign: "center" },
  profileCta: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 10,
  },
  profileCtaText: { fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10 },
  value: { fontSize: 18, fontWeight: "800" },
});
