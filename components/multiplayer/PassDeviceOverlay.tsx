import { Ionicons } from "@expo/vector-icons";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  /** Optional game-specific hint line under the title. */
  hint?: string;
  onReady: () => void;
  readyLabel?: string;
  /** Fully opaque + "Don't peek!" copy for games with hidden information. */
  secret?: boolean;
  toPlayer: MatchPlayer;
  visible: boolean;
}

/**
 * Fullscreen hand-off screen for pass-and-play games. Always opaque so the
 * board underneath is hidden; `secret` adds the privacy warning.
 */
export default function PassDeviceOverlay({
  visible,
  toPlayer,
  secret,
  hint,
  readyLabel,
  onReady,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const reduceMotion = useReduceMotion();

  if (!visible) {
    return null;
  }

  const handleReady = () => {
    haptic.tap();
    onReady();
  };

  return (
    <Animated.View
      accessibilityViewIsModal
      entering={
        reduceMotion ? FadeIn.duration(160) : SlideInRight.duration(260)
      }
      style={[styles.overlay, { backgroundColor: theme.background }]}
    >
      <RNView style={[styles.dot, { backgroundColor: toPlayer.color }]}>
        <Ionicons color="#0b1620" name="phone-portrait-outline" size={40} />
      </RNView>
      <Text style={[styles.eyebrow, { color: theme.mutedText }]}>
        {t("passPhone")}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {t("passPhoneTo", { player: toPlayer.name })}
      </Text>
      {secret ? (
        <RNView
          style={[
            styles.secretPill,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <Ionicons color={theme.danger} name="eye-off-outline" size={16} />
          <Text style={[styles.secretText, { color: theme.danger }]}>
            {t("passPhoneDontLook")}
          </Text>
        </RNView>
      ) : null}
      {hint ? (
        <Text style={[styles.hint, { color: theme.mutedText }]}>{hint}</Text>
      ) : null}
      <Pressable
        accessibilityLabel={readyLabel ?? t("passPhoneReady")}
        accessibilityRole="button"
        onPress={handleReady}
        style={[styles.btn, { backgroundColor: toPlayer.color }]}
      >
        <Text style={styles.btnText}>{readyLabel ?? t("passPhoneReady")}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.button,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
  },
  btnText: { ...TextStyle.buttonPrimary, color: "#0b1620" },
  dot: {
    alignItems: "center",
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    marginBottom: Spacing.sm,
    width: 96,
  },
  eyebrow: { ...TextStyle.statLabel },
  hint: {
    ...TextStyle.hint,
    paddingHorizontal: Spacing.md,
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    gap: Spacing.md,
    justifyContent: "center",
    padding: Spacing["4xl"],
    zIndex: 30,
  },
  secretPill: {
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  secretText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  title: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    textAlign: "center",
  },
});
