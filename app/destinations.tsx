import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { destinations } from "@/data/destinations";
import { getPhraseLanguage } from "@/data/phrases";
import { useTranslation } from "@/hooks/useTranslation";

export default function DestinationsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const focusedId =
    focus && destinations.some((d) => d.id === focus)
      ? focus
      : (destinations[0]?.id ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(focusedId);

  const toggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          {t("destinationsSubtitle")}
        </Text>

        {destinations.map((destination) => {
          const isExpanded = expandedId === destination.id;
          const tipCount = destination.tips.length;
          const tipLabel = t("destinationsTips");

          return (
            <View
              key={destination.id}
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggle(destination.id)}
                style={styles.cardHeader}
              >
                <Text style={styles.emoji}>{destination.emoji}</Text>
                <View
                  crazyColor="transparent"
                  darkColor="transparent"
                  lightColor="transparent"
                  style={styles.headerText}
                >
                  <Text style={styles.city}>{destination.city}</Text>
                  <Text style={[styles.country, { color: theme.mutedText }]}>
                    {destination.country}
                  </Text>
                </View>
                <Text style={[styles.tipCount, { color: theme.tint }]}>
                  {tipCount} {tipLabel}
                </Text>
                <Ionicons
                  color={theme.mutedText}
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                />
              </Pressable>

              {isExpanded && (
                <View
                  crazyColor="transparent"
                  darkColor="transparent"
                  lightColor="transparent"
                  style={[styles.tips, { borderTopColor: theme.border }]}
                >
                  {destination.tips.map((tip, index) => (
                    <View
                      crazyColor="transparent"
                      darkColor="transparent"
                      key={`${destination.id}-${tip.labelKey}`}
                      lightColor="transparent"
                      style={[styles.tipRow, index === 0 && styles.tipRowFirst]}
                    >
                      <View
                        crazyColor={theme.accentSoft}
                        darkColor={theme.accentSoft}
                        lightColor={theme.accentSoft}
                        style={[
                          styles.tipIcon,
                          { backgroundColor: theme.accentSoft },
                        ]}
                      >
                        <Ionicons
                          color={theme.tint}
                          name={tip.icon as keyof typeof Ionicons.glyphMap}
                          size={18}
                        />
                      </View>
                      <View
                        crazyColor="transparent"
                        darkColor="transparent"
                        lightColor="transparent"
                        style={styles.tipText}
                      >
                        <Text style={[styles.tipLabel, { color: theme.text }]}>
                          {t(tip.labelKey)}
                        </Text>
                        <Text
                          style={[styles.tipBody, { color: theme.mutedText }]}
                        >
                          {tip.text}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <View
                    crazyColor="transparent"
                    darkColor="transparent"
                    lightColor="transparent"
                    style={styles.toolsRow}
                  >
                    {destination.phraseLanguage === "en" ? null : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(
                            `/phrasebook?lang=${destination.phraseLanguage}&source=destinations` as never
                          )
                        }
                        style={[
                          styles.toolBtn,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Ionicons
                          color={theme.tint}
                          name="chatbubbles-outline"
                          size={16}
                        />
                        <Text
                          numberOfLines={1}
                          style={[styles.toolText, { color: theme.text }]}
                        >
                          {t("destinationsPhrasebookCta", {
                            language:
                              getPhraseLanguage(destination.phraseLanguage)
                                ?.nativeName ?? destination.phraseLanguage,
                          })}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push(
                          `/converter?currency=${destination.currencyCode}&source=destinations` as never
                        )
                      }
                      style={[
                        styles.toolBtn,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        color={theme.tint}
                        name="swap-horizontal-outline"
                        size={16}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.toolText, { color: theme.text }]}
                      >
                        {t("destinationsConverterCta", {
                          currency: destination.currencyCode,
                        })}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {destinations.length === 0 && (
          <View style={styles.empty}>
            <Ionicons
              color={theme.mutedText}
              name="airplane-outline"
              size={48}
            />
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>
              {t("destinationsEmpty")}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  city: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  country: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  emoji: {
    fontSize: FontSize["2xl"],
  },
  empty: {
    alignItems: "center",
    gap: Spacing.md,
    justifyContent: "center",
    paddingTop: Spacing["4xl"],
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  headerText: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  tipBody: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  tipCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tipIcon: {
    alignItems: "center",
    borderRadius: Radius.sm,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  tipLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  tipRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  tipRowFirst: {
    paddingTop: Spacing.lg,
  },
  tips: {
    borderTopWidth: 1,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  tipText: { flex: 1 },
  toolBtn: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
  },
  toolsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  toolText: {
    flexShrink: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
