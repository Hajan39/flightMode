import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pluralKey } from "@/components/plural";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { usePushGuard } from "@/components/usePushGuard";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { destinations } from "@/data/destinations";
import { getPhraseLanguage } from "@/data/phrases";
import { useContentItems } from "@/hooks/useContentItems";
import { useTranslation } from "@/hooks/useTranslation";

export default function DestinationsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { language, t } = useTranslation();
  const push = usePushGuard();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const hasFocusParam = Boolean(
    focus && destinations.some((d) => d.id === focus)
  );
  const focusedId =
    hasFocusParam && focus ? focus : (destinations[0]?.id ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(focusedId);
  const scrollRef = useRef<ScrollView>(null);
  // Card to bring into view on its next layout: the deep-linked one on open,
  // then whichever card the traveller expands.
  const pendingScrollIdRef = useRef<string | null>(
    hasFocusParam ? focusedId : null
  );
  const articles = useContentItems();
  const guideIds = useMemo(
    () => new Set(articles.map((a) => a.id)),
    [articles]
  );

  const toggle = (id: string) => {
    const expanding = expandedId !== id;
    pendingScrollIdRef.current = expanding ? id : null;
    setExpandedId(expanding ? id : null);
  };

  const handleCardLayout = (id: string, event: LayoutChangeEvent) => {
    if (pendingScrollIdRef.current !== id) {
      return;
    }
    pendingScrollIdRef.current = null;
    // Cards are direct children of the scroll content, so `y` is the offset.
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(0, event.nativeEvent.layout.y - Spacing.md),
    });
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          {t("destinationsSubtitle")}
        </Text>

        {destinations.map((destination) => {
          const isExpanded = expandedId === destination.id;
          const tipCount = destination.tips.length;
          const tipLabel = t(
            pluralKey(language, tipCount, {
              few: "destinationsTipsCountFew",
              many: "destinationsTipsCountMany",
              one: "destinationsTipsCountOne",
              other: "destinationsTipsCountOther",
            }),
            { count: tipCount }
          );

          return (
            <View
              key={destination.id}
              onLayout={(event) => handleCardLayout(destination.id, event)}
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
                  {tipLabel}
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
                  {guideIds.has(`destination-${destination.id}`) ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        push(`/content/destination-${destination.id}` as never)
                      }
                      style={[
                        styles.toolBtn,
                        styles.guideBtn,
                        {
                          backgroundColor: theme.accentSoft,
                          borderColor: theme.tint,
                        },
                      ]}
                    >
                      <Ionicons
                        color={theme.tint}
                        name="book-outline"
                        size={16}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.toolText, { color: theme.text }]}
                      >
                        {t("destinationsGuideCta", { city: destination.city })}
                      </Text>
                    </Pressable>
                  ) : null}
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
                          push(
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
                        push(
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
  guideBtn: { flex: 0, marginTop: Spacing.md },
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
