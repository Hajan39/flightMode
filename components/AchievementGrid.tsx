import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { ACHIEVEMENT_GRID, getGridLayout } from "@/components/gridLayout";
import { Text, View } from "@/components/Themed";
import type Colors from "@/constants/Colors";
import type { AchievementDef } from "@/data/achievements";
import type { TranslationKey } from "@/i18n/translations";

type Theme = (typeof Colors)["light"];

/** Horizontal padding of the Profile scroll content, used until onLayout. */
const SCREEN_PADDING = 16;

/**
 * Responsive achievement grid: measures its own width (onLayout; falls back
 * to the window width minus screen padding before the first layout) and
 * derives columns + an exact card width, so cards always fill the row with
 * equal gutters on 320–430 dp phones and on tablets. Never scrolls sideways.
 */
export default function AchievementGrid({
  items,
  unlockedIds,
  theme,
  t,
}: {
  items: readonly AchievementDef[];
  unlockedIds: readonly string[];
  theme: Theme;
  t: (key: TranslationKey) => string;
}) {
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? window.width - SCREEN_PADDING * 2;
  const { itemWidth } = getGridLayout(width, ACHIEVEMENT_GRID);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - (measured ?? 0)) >= 1) {
      setMeasured(next);
    }
  };

  return (
    <View
      darkColor="transparent"
      lightColor="transparent"
      onLayout={onLayout}
      style={styles.grid}
    >
      {items.map((a) => (
        <AchievementBadge
          achievement={a}
          key={a.id}
          t={t}
          theme={theme}
          unlocked={unlockedIds.includes(a.id)}
          width={itemWidth}
        />
      ))}
    </View>
  );
}

function AchievementBadge({
  achievement,
  unlocked,
  theme,
  t,
  width,
}: {
  achievement: AchievementDef;
  unlocked: boolean;
  theme: Theme;
  t: (key: TranslationKey) => string;
  width: number;
}) {
  const title = t(achievement.titleKey);
  const description = t(achievement.descriptionKey);
  return (
    <View
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ disabled: !unlocked }}
      accessible
      style={[
        styles.badge,
        {
          backgroundColor: unlocked ? theme.card : theme.background,
          borderColor: unlocked ? theme.tint : theme.border,
          opacity: unlocked ? 1 : 0.4,
          width,
        },
      ]}
    >
      <Ionicons
        color={unlocked ? theme.tint : theme.mutedText}
        name={achievement.icon as never}
        size={26}
      />
      <Text
        numberOfLines={2}
        style={[
          styles.badgeTitle,
          { color: unlocked ? theme.text : theme.mutedText },
        ]}
      >
        {title}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.badgeDesc, { color: theme.mutedText }]}
      >
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  badgeDesc: { fontSize: 11, lineHeight: 15, textAlign: "center" },
  badgeTitle: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  grid: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ACHIEVEMENT_GRID.gap,
    width: "100%",
  },
});
