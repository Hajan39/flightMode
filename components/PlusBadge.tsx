import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";

/** Small "Plus" pill marking a FlightMode Plus extra (article, pattern). */
export default function PlusBadge() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <View
      crazyColor={theme.tint}
      darkColor={theme.tint}
      lightColor={theme.tint}
      style={[styles.badge, { backgroundColor: theme.tint }]}
    >
      <Text style={[styles.text, { color: theme.onTint }]}>
        {t("plusBadge")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
