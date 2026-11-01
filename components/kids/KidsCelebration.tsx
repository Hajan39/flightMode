import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Kids-mode end screen (replaces GameResult): no score, no best, no streak —
 * just a big celebration and two picture buttons, ▶ again and 🏠 home.
 */
export default function KidsCelebration({
  onAgain,
  onHome,
}: {
  onAgain: () => void;
  onHome: () => void;
}) {
  const theme = Colors[useColorScheme()];
  const { t } = useTranslation();
  const haptic = useHaptic();

  useEffect(() => {
    haptic.success();
  }, [haptic]);

  return (
    <View
      accessibilityLabel={t("kidsWellDone")}
      style={[styles.root, { backgroundColor: theme.kidsBackground }]}
    >
      <Animated.Text
        accessibilityElementsHidden
        entering={ZoomIn.springify()}
        importantForAccessibility="no-hide-descendants"
        style={styles.party}
      >
        🎉
      </Animated.Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.stars}
      >
        ⭐⭐⭐
      </Text>
      <View style={styles.buttons}>
        <Pressable
          accessibilityLabel={t("kidsAgain")}
          accessibilityRole="button"
          onPress={onAgain}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.kidsTile3,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Text style={[styles.buttonIcon, { color: theme.kidsOnTile }]}>
            ▶
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("kidsHome")}
          accessibilityRole="button"
          onPress={onHome}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.kidsTile4,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Text style={styles.buttonIcon}>🏠</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 32,
    height: 104,
    justifyContent: "center",
    width: 104,
  },
  buttonIcon: { fontSize: 48, lineHeight: 58 },
  buttons: { flexDirection: "row", gap: 28, marginTop: 36 },
  party: { fontSize: 110, lineHeight: 132 },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  stars: { fontSize: 44, letterSpacing: 6, lineHeight: 56, marginTop: 8 },
});
