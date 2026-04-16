import { StyleSheet, ScrollView } from "react-native";

import { Text } from "@/components/Themed";
import LanguageDropdown from "@/components/LanguageDropdown";
import ThemeDropdown from "@/components/ThemeDropdown";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";

export default function SettingsScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<ScrollView
			style={[styles.scroll, { backgroundColor: theme.background }]}
			contentContainerStyle={styles.content}
		>
			{/* Language section */}
			<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
				{t("language").toUpperCase()}
			</Text>
			<LanguageDropdown />

			{/* Theme section */}
			<Text
				style={[styles.sectionLabel, { color: theme.mutedText, marginTop: 16 }]}
			>
				{t("theme").toUpperCase()}
			</Text>
			<ThemeDropdown />
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: {
		flex: 1,
	},
	content: {
		padding: 20,
		paddingTop: 16,
		gap: 8,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: "600",
		letterSpacing: 0.8,
		marginBottom: 4,
		paddingHorizontal: 4,
	},
});
