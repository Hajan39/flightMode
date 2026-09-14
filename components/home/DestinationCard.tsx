import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { homeStyles } from "@/components/home/HomeSection";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { Destination } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	destination: Destination | undefined;
	onPress: () => void;
};

/** Link to destination tips — highlighted when the flight has a destination. */
export default function DestinationCard({ destination, onPress }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<AnimatedPressable
			style={[
				homeStyles.featuredCard,
				{
					backgroundColor: destination ? theme.accentSoft : theme.card,
					borderColor: destination ? theme.tint : theme.border,
				},
			]}
			onPress={onPress}
		>
			{destination ? (
				<Text style={styles.emoji}>{destination.emoji}</Text>
			) : (
				<Ionicons name="earth-outline" size={22} color={theme.tint} />
			)}
			<View
				lightColor="transparent"
				darkColor="transparent"
				style={homeStyles.featuredBody}
			>
				<Text style={homeStyles.featuredTitle}>
					{destination
						? t("homeDestinationTipsFor", { city: destination.city })
						: t("homeDestinationsCta")}
				</Text>
			</View>
			<Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
		</AnimatedPressable>
	);
}

const styles = StyleSheet.create({
	emoji: { fontSize: 22 },
});
