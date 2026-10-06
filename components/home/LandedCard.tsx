import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import type { Destination } from "@/data/destinations";
import { getPhraseLanguage } from "@/data/phrases";
import { useTranslation } from "@/hooks/useTranslation";
import { formatTimeInZone } from "@/utils/timezone";

interface Props {
  destination: Destination;
  nowMs: number;
  onClear: () => void;
  onOpenConverter: () => void;
  onOpenPhrasebook: () => void;
  onOpenTips: () => void;
}

/**
 * Shown on Home for 48 h after landing: local time, the two arrival tips that
 * matter first, and one-tap access to the phrasebook, converter and full tips.
 */
export default function LandedCard({
  destination,
  nowMs,
  onOpenPhrasebook,
  onOpenConverter,
  onOpenTips,
  onClear,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  const localTime = formatTimeInZone(nowMs, destination);
  const phraseLanguage = getPhraseLanguage(destination.phraseLanguage);
  const hasLocalLanguage = destination.phraseLanguage !== "en";
  // The two tips a fresh arrival needs first.
  const arrivalTips = destination.tips.filter(
    (tip) =>
      tip.labelKey === "destTipFromAirport" ||
      tip.labelKey === "destTipGettingAround"
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.accentSoft, borderColor: theme.tint },
        Shadow.card,
      ]}
    >
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.header}
      >
        <Text style={styles.emoji}>{destination.emoji}</Text>
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.headerText}
        >
          <Text style={styles.title}>
            {t("homeLandedTitle", { city: destination.city })}
          </Text>
          <Text style={[styles.clock, { color: theme.mutedText }]}>
            {t("homeLandedLocalTime", { time: localTime })}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t("a11yClearFlight")}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onClear}
        >
          <Ionicons
            color={theme.mutedText}
            name="close-circle-outline"
            size={20}
          />
        </Pressable>
      </View>

      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.actions}
      >
        {hasLocalLanguage ? (
          <AnimatedPressable
            onPress={onOpenPhrasebook}
            style={[
              styles.action,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.tint} name="chatbubbles-outline" size={20} />
            <Text numberOfLines={1} style={styles.actionLabel}>
              {phraseLanguage?.nativeName ?? t("homePhrasebook")}
            </Text>
          </AnimatedPressable>
        ) : null}
        <AnimatedPressable
          onPress={onOpenConverter}
          style={[
            styles.action,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons
            color={theme.tint}
            name="swap-horizontal-outline"
            size={20}
          />
          <Text numberOfLines={1} style={styles.actionLabel}>
            {destination.currencyCode}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={onOpenTips}
          style={[
            styles.action,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons color={theme.tint} name="compass-outline" size={20} />
          <Text numberOfLines={1} style={styles.actionLabel}>
            {t("homeLandedTips")}
          </Text>
        </AnimatedPressable>
      </View>

      {arrivalTips.map((tip) => (
        <View
          darkColor="transparent"
          key={tip.labelKey}
          lightColor="transparent"
          style={styles.tip}
        >
          <Ionicons
            color={theme.tint}
            name={tip.icon as keyof typeof Ionicons.glyphMap}
            size={16}
          />
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.tipBody}
          >
            <Text style={[styles.tipLabel, { color: theme.text }]}>
              {t(tip.labelKey)}
            </Text>
            <Text style={[styles.tipText, { color: theme.mutedText }]}>
              {tip.text}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  actionLabel: { fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: Spacing.sm },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    gap: Spacing.md,
    marginBottom: 6,
    padding: Spacing.xl,
  },
  clock: { fontSize: 13, marginTop: 2 },
  emoji: { fontSize: 32 },
  header: { alignItems: "center", flexDirection: "row", gap: Spacing.md },
  headerText: { flex: 1 },
  tip: { alignItems: "flex-start", flexDirection: "row", gap: Spacing.sm },
  tipBody: { flex: 1 },
  tipLabel: { fontSize: 13, fontWeight: "700" },
  tipText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  title: { fontSize: 18, fontWeight: "700" },
});
