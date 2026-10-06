import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";
import { PLUS_THEMES, useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { type ThemeMode, useSettingsStore } from "@/store/useSettingsStore";
import { useSupporterStore } from "@/store/useSupporterStore";

const themeOptions: Array<{
  mode: ThemeMode;
  icon: string;
  labelKey: string;
}> = [
  { icon: "phone-portrait-outline", labelKey: "themeSystem", mode: "system" },
  { icon: "sunny-outline", labelKey: "themeLight", mode: "light" },
  { icon: "moon-outline", labelKey: "themeDark", mode: "dark" },
  { icon: "color-palette-outline", labelKey: "themeCrazy", mode: "crazy" },
  { icon: "planet-outline", labelKey: "themeMidnight", mode: "midnight" },
  { icon: "partly-sunny-outline", labelKey: "themeSunset", mode: "sunset" },
];

export default function ThemeDropdown() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const [open, setOpen] = useState(false);
  const plus = useSupporterStore((s) => s.plus);
  const router = useRouter();

  const current =
    themeOptions.find((o) => o.mode === themeMode) ?? themeOptions[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons color={theme.tint} name={current.icon as never} size={20} />
        <Text style={[styles.triggerText, { color: theme.text }]}>
          {t(current.labelKey as Parameters<typeof t>[0])}
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
            {themeOptions.map((option, index) => {
              const isLast = index === themeOptions.length - 1;
              const isSelected = themeMode === option.mode;
              return (
                <Pressable
                  key={option.mode}
                  onPress={() => {
                    setOpen(false);
                    if (PLUS_THEMES.has(option.mode) && !plus) {
                      router.push("/plus" as never);
                      return;
                    }
                    setThemeMode(option.mode);
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
                  <Ionicons
                    color={theme.mutedText}
                    name={option.icon as never}
                    size={20}
                    style={styles.optionIcon}
                  />
                  <Text
                    style={[styles.optionLabel, { color: theme.text, flex: 1 }]}
                  >
                    {t(option.labelKey as Parameters<typeof t>[0])}
                  </Text>
                  {isSelected && (
                    <Ionicons color={theme.tint} name="checkmark" size={20} />
                  )}
                  {PLUS_THEMES.has(option.mode) && !plus ? (
                    <Text
                      style={[
                        styles.plusBadge,
                        { borderColor: theme.tint, color: theme.tint },
                      ]}
                    >
                      PLUS
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
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
    overflow: "hidden",
    width: "80%",
  },
  option: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  plusBadge: {
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 5,
    paddingVertical: 1,
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
