import { StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";

export default function SettingsScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const {
		languages,
		resetLanguage,
		setLanguage,
		systemLanguage,
		storedLanguage,
		t,
	} = useTranslation();

	return (
		<ScrollView
			style={[styles.scroll, { backgroundColor: theme.background }]}
			contentContainerStyle={styles.content}
		>
			{/* Language section */}
			<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
				{t("language").toUpperCase()}
			</Text>
			<View
				style={[
					styles.card,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
				lightColor={theme.card}
				darkColor={theme.card}
			>
				{/* System default option */}
				<Pressable
					style={({ pressed }) => [
						styles.langRow,
						{ borderBottomColor: theme.border, borderBottomWidth: 1 },
						pressed && { opacity: 0.6 },
					]}
					onPress={resetLanguage}
				>
					<View
						style={styles.langRowInner}
						lightColor="transparent"
						darkColor="transparent"
					>
						<Text style={[styles.langLabel, { color: theme.text }]}>
							{t("languageSystem")}
						</Text>
						<Text style={[styles.langSub, { color: theme.mutedText }]}>
							{t("languageDevice", { language: systemLanguage.toUpperCase() })}
						</Text>
					</View>
					{storedLanguage === null && (
						<Ionicons name="checkmark" size={20} color={theme.tint} />
					)}
				</Pressable>

				{/* Per-language options */}
				{languages.map((option, index) => {
					const isLast = index === languages.length - 1;
					const isSelected = storedLanguage === option.code;
					return (
						<Pressable
							key={option.code}
							style={({ pressed }) => [
								styles.langRow,
								!isLast && {
									borderBottomColor: theme.border,
									borderBottomWidth: 1,
								},
								pressed && { opacity: 0.6 },
							]}
							onPress={() =>
								setLanguage(option.code as Parameters<typeof setLanguage>[0])
							}
						>
							<View
								style={styles.langRowInner}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Text style={[styles.langLabel, { color: theme.text }]}>
									{option.nativeLabel}
								</Text>
								<Text style={[styles.langSub, { color: theme.mutedText }]}>
									{option.label}
								</Text>
							</View>
							{isSelected && (
								<Ionicons name="checkmark" size={20} color={theme.tint} />
							)}
						</Pressable>
					);
				})}
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
	card: {
		borderRadius: 14,
		borderWidth: 1,
		overflow: "hidden",
	},
	langRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	langRowInner: {
		flex: 1,
		gap: 2,
	},
	langLabel: {
		fontSize: 16,
		fontWeight: "500",
	},
	langSub: {
		fontSize: 13,
	},
});
