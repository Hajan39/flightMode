import { Ionicons } from "@expo/vector-icons";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  /** Hide individual buttons via these flags */
  hidePause?: boolean;
  hideReset?: boolean;
  /** When true, renders a "play" icon instead of "pause" — for resume from paused state. */
  isPaused?: boolean;
  onPause?: () => void;
  onReset?: () => void;
}

/**
 * Floating row of game-control icon buttons (pause + reset).
 * Sits inline at the top of a game screen so every game has consistent affordances.
 */
export default function GameControls({
  onPause,
  onReset,
  isPaused,
  hidePause,
  hideReset,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const haptic = useHaptic();
  const { t } = useTranslation();

  if ((!onPause || hidePause) && (!onReset || hideReset)) {
    return null;
  }

  const handlePause = () => {
    haptic.tap();
    onPause?.();
  };
  const handleReset = () => {
    haptic.tap();
    onReset?.();
  };

  return (
    <RNView style={styles.row}>
      {onPause && !hidePause ? (
        <Pressable
          accessibilityLabel={isPaused ? t("gameResume") : t("gamePause")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={handlePause}
          style={[
            styles.btn,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons
            color={theme.text}
            name={isPaused ? "play" : "pause"}
            size={18}
          />
        </Pressable>
      ) : null}
      {onReset && !hideReset ? (
        <Pressable
          accessibilityLabel={t("gameRestart")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleReset}
          style={[
            styles.btn,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons color={theme.text} name="refresh" size={18} />
        </Pressable>
      ) : null}
    </RNView>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  row: {
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
