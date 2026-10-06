import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

/** Full-width bordered CTA under the flight card (preflight, checklist). */
export default function HomeCtaRow({ icon, label, onPress }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.cta, { borderColor: theme.border }]}
    >
      <Ionicons color={theme.tint} name={icon} size={18} />
      <Text style={[styles.ctaText, { color: theme.tint }]}>{label}</Text>
      <View style={[homeStyles.iconCircle, { backgroundColor: theme.surface }]}>
        <Ionicons color={theme.mutedText} name="chevron-forward" size={14} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { flex: 1, fontSize: 14, fontWeight: "600" },
});
