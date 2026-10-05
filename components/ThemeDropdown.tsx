import { useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useRouter } from "expo-router";

import { PLUS_THEMES } from "@/components/useColorScheme";
import { useSettingsStore, type ThemeMode } from "@/store/useSettingsStore";
import { useSupporterStore } from "@/store/useSupporterStore";

const themeOptions: Array<{
	mode: ThemeMode;
	icon: string;
	labelKey: string;
}> = [
	{ mode: "system", icon: "phone-portrait-outline", labelKey: "themeSystem" },
	{ mode: "light", icon: "sunny-outline", labelKey: "themeLight" },
	{ mode: "dark", icon: "moon-outline", labelKey: "themeDark" },
	{ mode: "crazy", icon: "color-palette-outline", labelKey: "themeCrazy" },
	{ mode: "midnight", icon: "planet-outline", labelKey: "themeMidnight" },
	{ mode: "sunset", icon: "partly-sunny-outline", labelKey: "themeSunset" },
];

export default function ThemeDropdown() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const themeMode = useSettingsStore((s) => s.themeMode);
	const setThemeMode = useSettingsStore((s) => s.setThemeMode);
	const [open, setOpen] = useState(false);
	const plus = useSupporterStore((s) => s.plus);
	const router = useRouter();

	const current =
		themeOptions.find((o) => o.mode === themeMode) ?? themeOptions[0];

	return (
		<>
			<Pressable
				style={[
					styles.trigger,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
				onPress={() => setOpen(true)}
			>
				<Ionicons name={current.icon as never} size={20} color={theme.tint} />
				<Text style={[styles.triggerText, { color: theme.text }]}>
					{t(current.labelKey as Parameters<typeof t>[0])}
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
						{themeOptions.map((option, index) => {
							const isLast = index === themeOptions.length - 1;
							const isSelected = themeMode === option.mode;
							return (
								<Pressable
									key={option.mode}
									style={({ pressed }) => [
										styles.option,
										!isLast && {
											borderBottomColor: theme.border,
											borderBottomWidth: 1,
										},
										pressed && { opacity: 0.6 },
									]}
									onPress={() => {
										setOpen(false);
										if (PLUS_THEMES.has(option.mode) && !plus) {
											router.push("/plus" as never);
											return;
										}
										setThemeMode(option.mode);
									}}
								>
									<Ionicons
										name={option.icon as never}
										size={20}
										color={theme.mutedText}
										style={styles.optionIcon}
									/>
									<Text
										style={[styles.optionLabel, { color: theme.text, flex: 1 }]}
									>
										{t(option.labelKey as Parameters<typeof t>[0])}
									</Text>
									{isSelected && (
										<Ionicons name="checkmark" size={20} color={theme.tint} />
									)}
									{PLUS_THEMES.has(option.mode) && !plus ? (
										<Text style={[styles.plusBadge, { color: theme.tint, borderColor: theme.tint }]}>
											PLUS
										</Text>
									) : null}
								</Pressable>
							);
						})}
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
		width: "80%",
		borderRadius: 14,
		borderWidth: 1,
		overflow: "hidden",
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	optionIcon: {
		marginRight: 12,
	},
	plusBadge: {
		fontSize: 10,
		fontWeight: "700",
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 5,
		paddingVertical: 1,
	},
	optionLabel: {
		fontSize: 16,
		fontWeight: "500",
	},
});
