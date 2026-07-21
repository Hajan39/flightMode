import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { type ReactNode, useEffect, useRef } from "react";
import {
	AppState,
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import LanguageDropdown from "@/components/LanguageDropdown";
import ThemeDropdown from "@/components/ThemeDropdown";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import {
	type SyncNetworkPolicy,
	useSettingsStore,
} from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

// TODO: placeholder from a template — replace with the real FlightMode support
// address before release. Bug-report / feature-suggestion mails currently route
// to an unowned domain.
const SUPPORT_EMAIL = "support@eon-app.com";
const BMAC_URL = "https://buymeacoffee.com/dszwy4b";
const appVersion = Constants.expoConfig?.version ?? "1.0.0";

const syncOptions: Array<{
	value: SyncNetworkPolicy;
	labelKey:
	| "settingsSyncWifiOnly"
	| "settingsSyncWifiAndMobile"
	| "settingsSyncOff";
	hintKey:
	| "settingsSyncWifiOnlyHint"
	| "settingsSyncWifiAndMobileHint"
	| "settingsSyncOffHint";
	icon: keyof typeof Ionicons.glyphMap;
}> = [
		{
			value: "wifi_only",
			labelKey: "settingsSyncWifiOnly",
			hintKey: "settingsSyncWifiOnlyHint",
			icon: "wifi-outline",
		},
		{
			value: "wifi_and_mobile",
			labelKey: "settingsSyncWifiAndMobile",
			hintKey: "settingsSyncWifiAndMobileHint",
			icon: "cellular-outline",
		},
		{
			value: "off",
			labelKey: "settingsSyncOff",
			hintKey: "settingsSyncOffHint",
			icon: "cloud-offline-outline",
		},
	];

export default function SettingsScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
	const setSyncNetworkPolicy = useSettingsStore((s) => s.setSyncNetworkPolicy);
	const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);
	const setAnalyticsEnabled = useSettingsStore((s) => s.setAnalyticsEnabled);
	const hasTrackedOpenRef = useRef(false);
	const supportClickTimestampRef = useRef<number | null>(null);
	const appStateRef = useRef(AppState.currentState);

	const handleSyncPolicyChange = (policy: SyncNetworkPolicy) => {
		setSyncNetworkPolicy(policy);
		captureAnalyticsEvent("sync_network_policy_changed", { policy });
	};

	const handleSupportOpen = () => {
		supportClickTimestampRef.current = Date.now();
		captureAnalyticsEvent("support_clicked", {
			placement: "settings",
			provider: "buymeacoffee",
		});
		void Linking.openURL(BMAC_URL);
	};

	useEffect(() => {
		if (hasTrackedOpenRef.current) return;
		hasTrackedOpenRef.current = true;

		captureAnalyticsEvent("settings_open", {
			sync_network_policy: syncNetworkPolicy,
		});
		captureAnalyticsEvent("support_opened", {
			placement: "settings",
			provider: "buymeacoffee",
		});
	}, [syncNetworkPolicy]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState) => {
			const previousState = appStateRef.current;
			appStateRef.current = nextState;

			const supportClickTimestamp = supportClickTimestampRef.current;
			const returnedToApp =
				previousState !== "active" &&
				nextState === "active" &&
				supportClickTimestamp !== null;

			if (!returnedToApp) return;

			captureAnalyticsEvent("support_completed", {
				placement: "settings",
				provider: "buymeacoffee",
				completion_signal: "returned_to_app",
				seconds_away: Math.round((Date.now() - supportClickTimestamp) / 1000),
			});
			supportClickTimestampRef.current = null;
		});

		return () => subscription.remove();
	}, []);

	return (
		<SafeAreaView
			style={[styles.safeArea, { backgroundColor: theme.background }]}
			edges={["bottom"]}
		>
			<ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
				<SettingsSection title={t("settingsAppPreferences")} theme={theme}>
					<SettingControlRow
						icon="language-outline"
						label={t("language")}
						theme={theme}
					>
						<LanguageDropdown />
					</SettingControlRow>
					<SettingControlRow
						icon="color-palette-outline"
						label={t("theme")}
						theme={theme}
					>
						<ThemeDropdown />
					</SettingControlRow>
				</SettingsSection>

				<SettingsSection title={t("settingsSync")} theme={theme}>
					<View
						style={[
							styles.optionCard,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
					>
						{syncOptions.map((option, index) => {
							const isSelected = syncNetworkPolicy === option.value;
							return (
								<Pressable
									key={option.value}
									style={({ pressed }) => [
										styles.optionRow,
										index === syncOptions.length - 1 && styles.optionRowLast,
										{
											borderBottomColor: theme.border,
											opacity: pressed ? 0.6 : 1,
										},
									]}
									onPress={() => handleSyncPolicyChange(option.value)}
								>
									<View
										style={styles.optionRowLeft}
										lightColor="transparent"
										darkColor="transparent"
									>
										<Ionicons
											name={option.icon}
											size={20}
											color={isSelected ? theme.tint : theme.mutedText}
										/>
										<View lightColor="transparent" darkColor="transparent">
											<Text style={styles.optionRowTitle}>
												{t(option.labelKey)}
											</Text>
											<Text
												style={[
													styles.optionRowHint,
													{ color: theme.mutedText },
												]}
											>
												{t(option.hintKey)}
											</Text>
										</View>
									</View>
									<Ionicons
										name={isSelected ? "checkmark-circle" : "ellipse-outline"}
										size={20}
										color={isSelected ? theme.tint : theme.mutedText}
									/>
								</Pressable>
							);
						})}
					</View>
				</SettingsSection>

				<SettingsSection title={t("settingsPrivacy")} theme={theme}>
					<View
						style={[
							styles.optionCard,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
					>
						<View
							style={[styles.analyticsRow]}
							lightColor="transparent"
							darkColor="transparent"
						>
							<View
								style={styles.analyticsRowLeft}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons
									name="bar-chart-outline"
									size={20}
									color={analyticsEnabled ? theme.tint : theme.mutedText}
								/>
								<View lightColor="transparent" darkColor="transparent">
									<Text style={styles.optionRowTitle}>
										{t("settingsAnalyticsLabel")}
									</Text>
									<Text
										style={[styles.optionRowHint, { color: theme.mutedText }]}
									>
										{t("settingsAnalyticsHint")}
									</Text>
								</View>
							</View>
							<Switch
								value={analyticsEnabled}
								onValueChange={setAnalyticsEnabled}
								trackColor={{
									false: theme.border,
									true: theme.tint,
								}}
								thumbColor="#fff"
							/>
						</View>
					</View>
				</SettingsSection>

				<SettingsSection
					title={t("settingsSupport")}
					hint={t("settingsSupportHint")}
					theme={theme}
				>
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
									`mailto:${SUPPORT_EMAIL}?subject=FlightMode%20Bug%20Report`,
								)
							}
						>
							<View
								style={styles.supportRowLeft}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons name="bug-outline" size={20} color={theme.tint} />
								<Text style={styles.supportRowTitle}>
									{t("settingsReportBug")}
								</Text>
							</View>
							<Ionicons
								name="chevron-forward"
								size={16}
								color={theme.mutedText}
							/>
						</Pressable>

						<Pressable
							style={({ pressed }) => [
								styles.supportRow,
								{ borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
							]}
							onPress={() =>
								Linking.openURL(
									`mailto:${SUPPORT_EMAIL}?subject=FlightMode%20Feature%20Suggestion`,
								)
							}
						>
							<View
								style={styles.supportRowLeft}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons name="bulb-outline" size={20} color={theme.tint} />
								<Text style={styles.supportRowTitle}>
									{t("settingsSuggestFeature")}
								</Text>
							</View>
							<Ionicons
								name="chevron-forward"
								size={16}
								color={theme.mutedText}
							/>
						</Pressable>

						<Pressable
							style={({ pressed }) => [
								styles.supportRow,
								{ borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
							]}
							onPress={handleSupportOpen}
						>
							<View
								style={styles.supportRowLeft}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons name="cafe-outline" size={20} color={theme.tint} />
								<Text style={styles.supportRowTitle}>
									{t("settingsBecomeSupporter")}
								</Text>
							</View>
							<Ionicons
								name="chevron-forward"
								size={16}
								color={theme.mutedText}
							/>
						</Pressable>

						<View
							style={[styles.supportRow, { borderBottomColor: theme.border }]}
							lightColor="transparent"
							darkColor="transparent"
						>
							<View
								style={styles.supportRowLeft}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons
									name="heart-outline"
									size={20}
									color={theme.mutedText}
								/>
								<Text
									style={[styles.supportRowTitle, { color: theme.mutedText }]}
								>
									{t("settingsSupportDevelopment")}
								</Text>
							</View>
						</View>

						<View
							style={[styles.supportRow, styles.supportRowLast]}
							lightColor="transparent"
							darkColor="transparent"
						>
							<View
								style={styles.supportRowLeft}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons
									name="information-circle-outline"
									size={20}
									color={theme.mutedText}
								/>
								<Text
									style={[styles.supportRowTitle, { color: theme.mutedText }]}
								>
									{t("settingsVersion")}
								</Text>
							</View>
							<Text style={[styles.versionText, { color: theme.mutedText }]}>
								{appVersion}
							</Text>
						</View>
					</View>
				</SettingsSection>
			</ScrollView>
		</SafeAreaView>
	);
}

type SettingsSectionProps = {
	title: string;
	hint?: string;
	theme: (typeof Colors)["dark"];
	children: ReactNode;
};

function SettingsSection({
	title,
	hint,
	theme,
	children,
}: SettingsSectionProps) {
	return (
		<View
			style={styles.section}
			lightColor="transparent"
			darkColor="transparent"
		>
			<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
				{title.toUpperCase()}
			</Text>
			{hint ? (
				<Text style={[styles.sectionHint, { color: theme.mutedText }]}>
					{hint}
				</Text>
			) : null}
			{children}
		</View>
	);
}

type SettingControlRowProps = {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	theme: (typeof Colors)["dark"];
	children: ReactNode;
};

function SettingControlRow({
	icon,
	label,
	theme,
	children,
}: SettingControlRowProps) {
	return (
		<View
			style={styles.preferenceRow}
			lightColor="transparent"
			darkColor="transparent"
		>
			<View
				style={styles.preferenceLabelWrap}
				lightColor="transparent"
				darkColor="transparent"
			>
				<Ionicons name={icon} size={18} color={theme.tint} />
				<Text style={styles.preferenceLabel}>{label}</Text>
			</View>
			<View
				style={styles.preferenceControl}
				lightColor="transparent"
				darkColor="transparent"
			>
				{children}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	content: {
		padding: 16,
		paddingTop: 12,
		paddingBottom: 24,
		gap: 14,
	},
	section: {
		gap: 8,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: "600",
		letterSpacing: 0.8,
		paddingHorizontal: 2,
	},
	sectionHint: {
		fontSize: 12,
		lineHeight: 17,
		paddingHorizontal: 2,
		marginTop: -3,
	},
	preferenceRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	preferenceLabelWrap: {
		width: 92,
		flexDirection: "row",
		alignItems: "center",
		gap: 7,
	},
	preferenceLabel: {
		fontSize: 14,
		fontWeight: "600",
	},
	preferenceControl: {
		flex: 1,
	},
	analyticsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	analyticsRowLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
		paddingRight: 12,
	},
	supportCard: {
		borderRadius: 14,
		borderWidth: 1,
		overflow: "hidden",
	},
	optionCard: {
		borderRadius: 14,
		borderWidth: 1,
		overflow: "hidden",
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderBottomWidth: 1,
	},
	optionRowLast: {
		borderBottomWidth: 0,
	},
	optionRowLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
		paddingRight: 12,
	},
	optionRowTitle: {
		fontSize: 14,
		fontWeight: "700",
	},
	optionRowHint: {
		fontSize: 11,
		lineHeight: 15,
		marginTop: 1,
	},
	supportRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingVertical: 11,
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
