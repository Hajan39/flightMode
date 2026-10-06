import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { Destination } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  destination: Destination | undefined;
  onPress: () => void;
}

/** Link to destination tips — highlighted when the flight has a destination. */
export default function DestinationCard({ destination, onPress }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        homeStyles.featuredCard,
        {
          backgroundColor: destination ? theme.accentSoft : theme.card,
          borderColor: destination ? theme.tint : theme.border,
        },
      ]}
    >
      {destination ? (
        <Text style={styles.emoji}>{destination.emoji}</Text>
      ) : (
        <Ionicons color={theme.tint} name="earth-outline" size={22} />
      )}
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={homeStyles.featuredBody}
      >
        <Text style={homeStyles.featuredTitle}>
          {destination
            ? t("homeDestinationTipsFor", { city: destination.city })
            : t("homeDestinationsCta")}
        </Text>
      </View>
      <Ionicons color={theme.mutedText} name="chevron-forward" size={20} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 22 },
});
