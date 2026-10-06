import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { FontSize } from "@/constants/Typography";
import { achievements } from "@/data/achievements";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";

const DISPLAY_MS = 3000;

export default function AchievementToast() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const newUnlockedIds = useAchievementStore((s) => s.newUnlockedIds);
  const clearNewUnlocked = useAchievementStore((s) => s.clearNewUnlocked);
  const [visible, setVisible] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  // When new achievements are unlocked, add them to display queue
  useEffect(() => {
    if (newUnlockedIds.length > 0) {
      setQueue((prev) => {
        const fresh = newUnlockedIds.filter(
          (id) => !prev.includes(id) && id !== visible
        );
        return [...prev, ...fresh];
      });
      clearNewUnlocked();
    }
  }, [newUnlockedIds, clearNewUnlocked, visible]);

  // Process queue – pick next item when nothing is visible
  useEffect(() => {
    if (visible || queue.length === 0) {
      return;
    }

    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    setVisible(next);
    haptic.heavy();
  }, [visible, queue, haptic.heavy]);

  // Auto-dismiss after DISPLAY_MS (separate effect so cleanup doesn't kill the timer)
  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(() => setVisible(null), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) {
    return null;
  }

  const achievement = achievements.find((a) => a.id === visible);
  if (!achievement) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInDown.duration(220)}
      exiting={SlideOutDown.duration(220)}
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.tint,
        },
      ]}
    >
      <Ionicons color={theme.tint} name={achievement.icon as never} size={28} />
      <Animated.View entering={FadeIn.delay(200)} style={styles.textWrap}>
        <Animated.Text style={[styles.label, { color: theme.mutedText }]}>
          {t("achievementUnlocked")}
        </Animated.Text>
        <Animated.Text style={[styles.title, { color: theme.text }]}>
          {t(achievement.titleKey)}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    bottom: 100,
    elevation: 8,
    flexDirection: "row",
    gap: 12,
    left: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: "absolute",
    right: 20,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  textWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", marginTop: 2 },
});
