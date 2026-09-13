import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Small "EN" pill shown next to an article that has no translation in the
 * active UI language and is therefore displayed in English.
 */
export default function LanguageBadge() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<View
			style={[styles.badge, { backgroundColor: theme.surface }]}
			lightColor={theme.surface}
			darkColor={theme.surface}
			crazyColor={theme.surface}
			accessibilityLabel={t("contentFallbackNotice")}
		>
			<Text style={[styles.text, { color: theme.mutedText }]}>
				{t("contentFallbackBadge")}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	badge: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: Radius.pill,
	},
	text: {
		fontSize: FontSize.xs - 1,
		fontWeight: FontWeight.bold,
		letterSpacing: 0.5,
	},
});
