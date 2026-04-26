import { StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import LanguageDropdown from "@/components/LanguageDropdown";
import ThemeDropdown from "@/components/ThemeDropdown";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";

const SUPPORT_EMAIL = "support@eon-app.com";
const appVersion =
	Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0";

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
			<Text style={[styles.sectionHint, { color: theme.mutedText }]}> 
				{t("settingsLanguageHint")}
			</Text>
			<LanguageDropdown />

			{/* Theme section */}
			<Text
				style={[styles.sectionLabel, { color: theme.mutedText, marginTop: 16 }]}
			>
				{t("theme").toUpperCase()}
			</Text>
			<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
				{t("settingsThemeHint")}
			</Text>
			<ThemeDropdown />

			{/* Support section */}
			<Text
				style={[styles.sectionLabel, { color: theme.mutedText, marginTop: 24 }]}
			>
				{t("settingsSupport").toUpperCase()}
			</Text>
			<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
				{t("settingsSupportHint")}
			</Text>
			<View
				style={[
					styles.supportCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Pressable
					style={({ pressed }) => [
						styles.supportRow,
						{ borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
					]}
					onPress={() =>
						Linking.openURL(
							`mailto:${SUPPORT_EMAIL}?subject=EON%20Bug%20Report`,
						)
					}
				>
					<View style={styles.supportRowLeft} lightColor="transparent" darkColor="transparent">
						<Ionicons name="bug-outline" size={20} color={theme.tint} />
						<View lightColor="transparent" darkColor="transparent">
							<Text style={styles.supportRowTitle}>{t("settingsReportBug")}</Text>
							<Text style={[styles.supportRowHint, { color: theme.mutedText }]}>
								{t("settingsReportBugHint")}
							</Text>
						</View>
					</View>
					<Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
				</Pressable>

				<Pressable
					style={({ pressed }) => [
						styles.supportRow,
						{ borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
					]}
					onPress={() =>
						Linking.openURL(
							`mailto:${SUPPORT_EMAIL}?subject=EON%20Feature%20Suggestion`,
						)
					}
				>
					<View style={styles.supportRowLeft} lightColor="transparent" darkColor="transparent">
						<Ionicons name="bulb-outline" size={20} color={theme.tint} />
						<View lightColor="transparent" darkColor="transparent">
							<Text style={styles.supportRowTitle}>{t("settingsSuggestFeature")}</Text>
							<Text style={[styles.supportRowHint, { color: theme.mutedText }]}>
								{t("settingsSuggestFeatureHint")}
							</Text>
						</View>
					</View>
					<Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
				</Pressable>

				<View style={[styles.supportRow, styles.supportRowLast]} lightColor="transparent" darkColor="transparent">
					<View style={styles.supportRowLeft} lightColor="transparent" darkColor="transparent">
						<Ionicons name="information-circle-outline" size={20} color={theme.mutedText} />
						<Text style={[styles.supportRowTitle, { color: theme.mutedText }]}>
							{t("settingsVersion")}
						</Text>
					</View>
					<Text style={[styles.versionText, { color: theme.mutedText }]}>
						{appVersion}
					</Text>
				</View>
			</View>
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
	sectionHint: {
		fontSize: 12,
		lineHeight: 16,
		marginBottom: 6,
		paddingHorizontal: 4,
	},
	supportCard: {
		borderRadius: 14,
		borderWidth: 1,
		overflow: "hidden",
	},
	supportRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 14,
		paddingVertical: 13,
		borderBottomWidth: 1,
	},
	supportRowLast: {
		borderBottomWidth: 0,
	},
	supportRowLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	supportRowTitle: {
		fontSize: 14,
		fontWeight: "600",
	},
	supportRowHint: {
		fontSize: 11,
		marginTop: 1,
	},
	versionText: {
		fontSize: 13,
		fontWeight: "600",
	},
});
