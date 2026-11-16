import { StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";

/** Small "Plus" tag pinned to the corner of a level-picker button. */
export function PlusLevelBadge() {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.badge, { backgroundColor: theme.tint }]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={[styles.text, { color: theme.onTint }]}
      >
        {t("plusLevelBadge")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: "absolute",
    right: -4,
    top: -6,
  },
  text: { fontSize: 8, fontWeight: "800", letterSpacing: 0.3 },
});
