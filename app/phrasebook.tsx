import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import {
  getPhraseLanguage,
  type PhraseLanguageCode,
  phraseIds,
  phraseLanguageList,
  phraseMeaningKeys,
} from "@/data/phrases";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function PhrasebookScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { lang, source } = useLocalSearchParams<{
    lang?: string;
    source?: string;
  }>();
  const markPhraseLanguageViewed = useAchievementStore(
    (s) => s.markPhraseLanguageViewed
  );
  const initial: PhraseLanguageCode = getPhraseLanguage(lang)?.code ?? "es";
  const [active, setActive] = useState<PhraseLanguageCode>(initial);
  const language = getPhraseLanguage(active) ?? phraseLanguageList[0];

  useEffect(() => {
    captureAnalyticsEvent("phrasebook_open", {
      language: initial,
      source: source ?? "direct",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, initial]);

  useEffect(() => {
    markPhraseLanguageViewed(active);
  }, [active, markPhraseLanguageViewed]);

  const selectLanguage = (code: PhraseLanguageCode) => {
    if (code === active) {
      return;
    }
    haptic.tap();
    setActive(code);
    captureAnalyticsEvent("phrasebook_language_changed", { language: code });
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.chipRow}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
      >
        {phraseLanguageList.map((item) => {
          const isActive = item.code === active;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={item.code}
              onPress={() => selectLanguage(item.code)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.tint : theme.card,
                  borderColor: isActive ? theme.tint : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? theme.onTint : theme.text },
                ]}
              >
                {item.nativeName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.header}
        >
          <Text style={styles.headerTitle}>{language.nativeName}</Text>
          <Text style={[styles.headerSub, { color: theme.mutedText }]}>
            {language.nameEn} · {t("phrasebookSubtitle")}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {phraseIds.map((id, index) => {
            const phrase = language.phrases[id];
            return (
              <View
                accessibilityLabel={`${t(phraseMeaningKeys[id])}: ${phrase.native}${
                  phrase.roman ? `, ${phrase.roman}` : ""
                }`}
                darkColor="transparent"
                key={id}
                lightColor="transparent"
                style={[
                  styles.row,
                  index > 0 && {
                    borderTopColor: theme.border,
                    borderTopWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.meaning, { color: theme.mutedText }]}>
                  {t(phraseMeaningKeys[id])}
                </Text>
                <Text style={styles.native}>{phrase.native}</Text>
                {phrase.roman ? (
                  <Text style={[styles.roman, { color: theme.mutedText }]}>
                    {phrase.roman}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {language.nonLatin ? (
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.hintRow}
          >
            <Ionicons
              color={theme.mutedText}
              name="information-circle-outline"
              size={16}
            />
            <Text style={[styles.hint, { color: theme.mutedText }]}>
              {t("phrasebookRomanHint")}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  chipScroll: { flexGrow: 0 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  container: { paddingBottom: Spacing["4xl"], paddingHorizontal: Spacing.lg },
  header: { gap: 2, marginBottom: Spacing.lg },
  headerSub: { fontSize: FontSize.sm },
  headerTitle: { fontSize: FontSize["2xl"], fontWeight: FontWeight.bold },
  hint: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },
  hintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  meaning: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  native: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: 28,
  },
  roman: { fontSize: FontSize.sm, fontStyle: "italic" },
  row: { gap: 2, paddingVertical: Spacing.md },
  screen: { flex: 1 },
});
