import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChecklistSection from "@/components/ChecklistSection";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import {
  checklistSections,
  type ChecklistSection as SectionDef,
} from "@/data/checklist";
import { getDestinationById } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import {
  destinationItemId,
  getChecklistProgress,
  useChecklistStore,
} from "@/store/useChecklistStore";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function ChecklistScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const flight = useFlightStore((s) => s.flight);
  const checkedIds = useChecklistStore((s) => s.checkedIds);
  const customItems = useChecklistStore((s) => s.customItems);
  const resetForFlight = useChecklistStore((s) => s.resetForFlight);

  const destination = flight?.destinationId
    ? getDestinationById(flight.destinationId)
    : undefined;
  const destinationExtras = (destination?.checklistExtras ?? []).map(
    (labelKey) => ({
      id: destinationItemId(labelKey),
      labelKey,
    })
  );
  /**
   * Rendered blocks: the fixed templates, with a synthetic destination block
   * ("For Tokyo") inserted right before "At arrival" when the flight has one.
   */
  interface Block {
    extraItems?: typeof destinationExtras;
    hideAddField?: boolean;
    key: string;
    section: SectionDef;
    title?: string;
  }
  const blocks: Block[] = checklistSections.flatMap((section) => {
    const own: Block = { key: section.id, section };
    if (
      section.id !== "atArrival" ||
      !destination ||
      destinationExtras.length === 0
    ) {
      return [own];
    }
    return [
      {
        extraItems: destinationExtras,
        hideAddField: true,
        key: "destination",
        section: {
          icon: "location-outline",
          id: "atArrival",
          items: [],
          titleKey: "checklistSectionForCity",
        },
        title: t("checklistSectionForCity", { city: destination.city }),
      },
      own,
    ];
  });
  const { done, total } = getChecklistProgress(
    { checkedIds, customItems },
    destinationExtras.map((item) => item.id)
  );
  const ratio = total > 0 ? done / total : 0;
  const allDone = total > 0 && done >= total;

  useEffect(() => {
    captureAnalyticsEvent("checklist_open", { source: "screen" });
  }, []);

  const confirmReset = () => {
    Alert.alert(t("checklistResetTitle"), t("checklistResetMessage"), [
      { style: "cancel", text: t("gameCancel") },
      {
        onPress: () => resetForFlight(flight?.id ?? null, "manual"),
        style: "destructive",
        text: t("checklistReset"),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel={t("checklistReset")}
              accessibilityRole="button"
              hitSlop={10}
              onPress={confirmReset}
            >
              <Ionicons color={theme.tint} name="refresh-outline" size={22} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.screen, { backgroundColor: theme.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.screen}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            style={styles.screen}
          >
            <View
              darkColor="transparent"
              lightColor="transparent"
              style={styles.hero}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}
              >
                <Ionicons
                  color={theme.tint}
                  name={allDone ? "checkmark-done" : "checkbox-outline"}
                  size={34}
                />
              </View>
              <Text style={styles.heroTitle}>
                {flight?.flightNumber
                  ? `${t("checklistHeroTitle")} · ${flight.flightNumber}`
                  : t("checklistHeroTitle")}
              </Text>
              <Text style={[styles.heroSub, { color: theme.mutedText }]}>
                {allDone ? t("checklistAllDone") : t("checklistHeroSubtitle")}
              </Text>
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.progressTrack },
                ]}
              >
                <View
                  darkColor="transparent"
                  lightColor="transparent"
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.tint,
                      width: `${Math.round(ratio * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: theme.tint }]}>
                {t("checklistProgress", { done, total })}
              </Text>
            </View>

            <View
              darkColor="transparent"
              lightColor="transparent"
              style={styles.list}
            >
              {blocks.map((block) => (
                <ChecklistSection
                  customItems={
                    block.key === "destination"
                      ? []
                      : customItems.filter(
                          (item) => item.sectionId === block.section.id
                        )
                  }
                  extraItems={block.extraItems}
                  hideAddField={block.hideAddField}
                  key={block.key}
                  section={block.section}
                  sectionTitle={block.title}
                />
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.xl, paddingBottom: Spacing["4xl"] * 2 },
  hero: {
    alignItems: "center",
    gap: Spacing.sm + 2,
    marginBottom: Spacing["2xl"],
    marginTop: Spacing.sm,
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  heroSub: {
    fontSize: FontSize.base,
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
    textAlign: "center",
  },
  heroTitle: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.bold,
    textAlign: "center",
  },
  list: { gap: Spacing.md },
  progressBar: {
    alignSelf: "stretch",
    borderRadius: Radius.pill,
    height: 8,
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  progressFill: { borderRadius: Radius.pill, height: "100%" },
  progressText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  screen: { flex: 1 },
});
