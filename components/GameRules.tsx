import { useState } from "react";
import {
  Modal,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";

interface Props {
  inline?: boolean;
  rulesKey: TranslationKey;
  titleKey: TranslationKey;
}

/** A rules section header starts with an emoji. */
const SECTION_HEADER = /^\p{Extended_Pictographic}/u;

/**
 * Renders rules text with section headers (lines starting with emoji + bold text)
 * and bullet lines (lines starting with "  • " or "  ‣ ").
 * Regular lines render as normal paragraphs.
 */
function RulesContent({
  text,
  textColor,
  mutedColor,
}: {
  text: string;
  textColor: string;
  mutedColor: string;
}) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <RNView key={i} style={styles.spacer} />;
        }

        // Section header — starts with emoji (non-ASCII) and rest is bold
        if (SECTION_HEADER.test(trimmed)) {
          return (
            <Text key={i} style={[styles.sectionHeader, { color: textColor }]}>
              {trimmed}
            </Text>
          );
        }

        // Bullet line
        if (
          trimmed.startsWith("•") ||
          trimmed.startsWith("‣") ||
          trimmed.startsWith("→")
        ) {
          return (
            <RNView key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletChar, { color: mutedColor }]}>
                {trimmed[0]}
              </Text>
              <Text style={[styles.bulletText, { color: textColor }]}>
                {trimmed.slice(1).trim()}
              </Text>
            </RNView>
          );
        }

        // Regular text
        return (
          <Text key={i} style={[styles.rules, { color: textColor }]}>
            {trimmed}
          </Text>
        );
      })}
    </>
  );
}

export default function GameRules({ titleKey, rulesKey, inline }: Props) {
  const [visible, setVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <>
      <Pressable
        accessibilityLabel="Game rules"
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => setVisible(true)}
        style={[
          inline ? styles.helpBtnInline : styles.helpBtn,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.helpText, { color: theme.tint }]}>?</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <Pressable onPress={() => setVisible(false)} style={styles.overlay}>
          <Pressable
            onPress={() => {
              // Intentionally empty: absorbs taps so pressing the card doesn't close the modal.
            }}
            style={[styles.card, { backgroundColor: theme.elevated }]}
          >
            <Text style={[styles.title, { color: theme.text }]}>
              {t(titleKey)}
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              <RulesContent
                mutedColor={theme.mutedText}
                text={t(rulesKey)}
                textColor={theme.text}
              />
            </ScrollView>
            <Pressable
              accessibilityLabel="Close rules"
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              style={[styles.closeBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={styles.closeBtnText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bulletChar: { fontSize: 14, lineHeight: 21, width: 16 },
  bulletRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },
  card: {
    alignItems: "center",
    borderRadius: 16,
    maxHeight: "75%",
    maxWidth: 380,
    padding: 20,
    width: "100%",
  },
  closeBtn: {
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  closeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  helpBtn: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 8,
    width: 32,
    zIndex: 10,
  },
  helpBtnInline: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  helpText: { fontSize: 18, fontWeight: "800" },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  rules: { fontSize: 14, lineHeight: 21, marginBottom: 2 },
  scroll: { marginBottom: 16, width: "100%" },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
    marginTop: 10,
  },
  spacer: { height: 6 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 14 },
});
