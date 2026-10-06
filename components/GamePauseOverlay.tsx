import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  onQuit?: () => void;
  onRestart?: () => void;
  onResume: () => void;
  visible: boolean;
}

export default function GamePauseOverlay({
  visible,
  onResume,
  onRestart,
  onQuit,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const router = useRouter();

  if (!visible) {
    return null;
  }

  const handleResume = () => {
    haptic.tap();
    onResume();
  };
  const handleRestart = () => {
    haptic.tap();
    onRestart?.();
  };
  const handleQuit = () => {
    haptic.tap();
    if (onQuit) {
      onQuit();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
      <Animated.View
        entering={FadeIn.duration(180)}
        style={[
          styles.card,
          { backgroundColor: theme.elevated, borderColor: theme.border },
        ]}
      >
        <Ionicons color={theme.tint} name="pause-circle" size={48} />
        <Text style={[styles.title, { color: theme.text }]}>
          {t("gamePaused")}
        </Text>
        <RNView style={styles.actions}>
          <Pressable
            accessibilityLabel={t("gameResume")}
            accessibilityRole="button"
            onPress={handleResume}
            style={[styles.btnPrimary, { backgroundColor: theme.tint }]}
          >
            <Ionicons color="#fff" name="play" size={20} />
            <Text style={styles.btnPrimaryText}>{t("gameResume")}</Text>
          </Pressable>
          {onRestart ? (
            <Pressable
              accessibilityLabel={t("gameRestart")}
              accessibilityRole="button"
              onPress={handleRestart}
              style={[
                styles.btnSecondary,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons color={theme.text} name="refresh" size={18} />
              <Text style={[styles.btnSecondaryText, { color: theme.text }]}>
                {t("gameRestart")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={t("gameQuit")}
            accessibilityRole="button"
            onPress={handleQuit}
            style={[
              styles.btnSecondary,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.mutedText} name="close" size={18} />
            <Text style={[styles.btnSecondaryText, { color: theme.text }]}>
              {t("gameQuit")}
            </Text>
          </Pressable>
        </RNView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignSelf: "stretch",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  btnPrimary: {
    alignItems: "center",
    borderRadius: Radius.button,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  btnSecondary: {
    alignItems: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  btnSecondaryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  card: {
    alignItems: "center",
    borderRadius: Radius.modal,
    borderWidth: 1,
    gap: Spacing.sm,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing["3xl"],
    width: "100%",
    ...Shadow.modal,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: Spacing["4xl"],
    zIndex: 20,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
