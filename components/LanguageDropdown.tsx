import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	showSystemOption?: boolean;
};

export default function LanguageDropdown({ showSystemOption = true }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const {
		languages,
		language,
		resetLanguage,
		setLanguage,
		storedLanguage,
		systemLanguage,
		t,
	} = useTranslation();
	const [open, setOpen] = useState(false);

	const currentLabel =
		storedLanguage === null && showSystemOption
			? `${t("languageSystem")} (${systemLanguage.toUpperCase()})`
			: (languages.find((l) => l.code === language)?.nativeLabel ?? language);

	return (
		<>
			<Pressable
				style={[
					styles.trigger,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
				onPress={() => setOpen(true)}
			>
				<Ionicons name="language-outline" size={20} color={theme.tint} />
				<Text style={[styles.triggerText, { color: theme.text }]}>
					{currentLabel}
				</Text>
				<Ionicons name="chevron-down" size={18} color={theme.mutedText} />
			</Pressable>

			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable style={styles.overlay} onPress={() => setOpen(false)}>
					<View
						style={[
							styles.dropdown,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
					>
						<ScrollView bounces={false} style={styles.dropdownScroll}>
							{showSystemOption && (
								<Pressable
									style={({ pressed }) => [
										styles.option,
										{ borderBottomColor: theme.border, borderBottomWidth: 1 },
										pressed && { opacity: 0.6 },
									]}
									onPress={() => {
										resetLanguage();
										setOpen(false);
									}}
								>
									<View
										style={styles.optionInner}
										lightColor="transparent"
										darkColor="transparent"
									>
										<Text style={[styles.optionLabel, { color: theme.text }]}>
											{t("languageSystem")}
										</Text>
										<Text
											style={[styles.optionSub, { color: theme.mutedText }]}
										>
											{t("languageDevice", {
												language: systemLanguage.toUpperCase(),
											})}
										</Text>
									</View>
									{storedLanguage === null && (
										<Ionicons name="checkmark" size={20} color={theme.tint} />
									)}
								</Pressable>
							)}

							{languages.map((option, index) => {
								const isLast = index === languages.length - 1;
								const isSelected = showSystemOption
									? storedLanguage === option.code
									: language === option.code;
								return (
									<Pressable
										key={option.code}
										style={({ pressed }) => [
											styles.option,
											!isLast && {
												borderBottomColor: theme.border,
												borderBottomWidth: 1,
											},
											pressed && { opacity: 0.6 },
										]}
										onPress={() => {
											setLanguage(
												option.code as Parameters<typeof setLanguage>[0],
											);
											setOpen(false);
										}}
									>
										<View
											style={styles.optionInner}
											lightColor="transparent"
											darkColor="transparent"
										>
											<Text style={[styles.optionLabel, { color: theme.text }]}>
												{option.nativeLabel}
											</Text>
											<Text
												style={[styles.optionSub, { color: theme.mutedText }]}
											>
												{option.label}
											</Text>
										</View>
										{isSelected && (
											<Ionicons name="checkmark" size={20} color={theme.tint} />
										)}
									</Pressable>
								);
							})}
						</ScrollView>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	trigger: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderRadius: 14,
		borderWidth: 1,
		gap: 10,
	},
	triggerText: {
		flex: 1,
		fontSize: 16,
		fontWeight: "500",
	},
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},
	dropdown: {
		width: "100%",
		maxHeight: 420,
		borderRadius: 14,
		borderWidth: 1,
		overflow: "hidden",
	},
	dropdownScroll: {
		flexShrink: 1,
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	optionInner: {
		flex: 1,
		gap: 2,
	},
	optionLabel: {
		fontSize: 16,
		fontWeight: "500",
	},
	optionSub: {
		fontSize: 13,
	},
});
