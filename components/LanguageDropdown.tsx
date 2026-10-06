import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  showSystemOption?: boolean;
}

export default function LanguageDropdown({ showSystemOption = true }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const {
    languages,
    language,
    resetLanguage,
    setLanguage,
    storedLanguage,
    systemLanguage,
    t,
  } = useTranslation();
  const [open, setOpen] = useState(false);

  const currentLabel =
    storedLanguage === null && showSystemOption
      ? `${t("languageSystem")} (${systemLanguage.toUpperCase()})`
      : (languages.find((l) => l.code === language)?.nativeLabel ?? language);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons color={theme.tint} name="language-outline" size={20} />
        <Text style={[styles.triggerText, { color: theme.text }]}>
          {currentLabel}
        </Text>
        <Ionicons color={theme.mutedText} name="chevron-down" size={18} />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <Pressable onPress={() => setOpen(false)} style={styles.overlay}>
          <View
            style={[
              styles.dropdown,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <ScrollView bounces={false} style={styles.dropdownScroll}>
              {showSystemOption && (
                <Pressable
                  onPress={() => {
                    resetLanguage();
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { borderBottomColor: theme.border, borderBottomWidth: 1 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <View
                    darkColor="transparent"
                    lightColor="transparent"
                    style={styles.optionInner}
                  >
                    <Text style={[styles.optionLabel, { color: theme.text }]}>
                      {t("languageSystem")}
                    </Text>
                    <Text
                      style={[styles.optionSub, { color: theme.mutedText }]}
                    >
                      {t("languageDevice", {
                        language: systemLanguage.toUpperCase(),
                      })}
                    </Text>
                  </View>
                  {storedLanguage === null && (
                    <Ionicons color={theme.tint} name="checkmark" size={20} />
                  )}
                </Pressable>
              )}

              {languages.map((option, index) => {
                const isLast = index === languages.length - 1;
                const isSelected = showSystemOption
                  ? storedLanguage === option.code
                  : language === option.code;
                return (
                  <Pressable
                    key={option.code}
                    onPress={() => {
                      setLanguage(
                        option.code as Parameters<typeof setLanguage>[0]
                      );
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      !isLast && {
                        borderBottomColor: theme.border,
                        borderBottomWidth: 1,
                      },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <View
                      darkColor="transparent"
                      lightColor="transparent"
                      style={styles.optionInner}
                    >
                      <Text style={[styles.optionLabel, { color: theme.text }]}>
                        {option.nativeLabel}
                      </Text>
                      <Text
                        style={[styles.optionSub, { color: theme.mutedText }]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons color={theme.tint} name="checkmark" size={20} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 420,
    overflow: "hidden",
    width: "100%",
  },
  dropdownScroll: {
    flexShrink: 1,
  },
  option: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionInner: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  optionSub: {
    fontSize: 13,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  trigger: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
});
