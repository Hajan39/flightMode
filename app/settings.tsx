import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import CurrencyPicker from "@/components/CurrencyPicker";
import LanguageDropdown from "@/components/LanguageDropdown";
import ThemeDropdown from "@/components/ThemeDropdown";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { deviceCurrencyCode, POPULAR_CURRENCIES } from "@/data/currencies";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type SyncNetworkPolicy,
  useSettingsStore,
} from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

const SUPPORT_EMAIL = "flightmode.app@proton.me";
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
    hintKey: "settingsSyncWifiOnlyHint",
    icon: "wifi-outline",
    labelKey: "settingsSyncWifiOnly",
    value: "wifi_only",
  },
  {
    hintKey: "settingsSyncWifiAndMobileHint",
    icon: "cellular-outline",
    labelKey: "settingsSyncWifiAndMobile",
    value: "wifi_and_mobile",
  },
  {
    hintKey: "settingsSyncOffHint",
    icon: "cloud-offline-outline",
    labelKey: "settingsSyncOff",
    value: "off",
  },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  const setSyncNetworkPolicy = useSettingsStore((s) => s.setSyncNetworkPolicy);
  const homeCurrency = useSettingsStore((s) => s.homeCurrency);
  const setHomeCurrency = useSettingsStore((s) => s.setHomeCurrency);
  const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((s) => s.setAnalyticsEnabled);
  const hasTrackedOpenRef = useRef<boolean>(false);
  const router = useRouter();

  const handleSyncPolicyChange = (policy: SyncNetworkPolicy) => {
    setSyncNetworkPolicy(policy);
    captureAnalyticsEvent("sync_network_policy_changed", { policy });
  };

  const handleSupportOpen = () => {
    router.push("/plus" as never);
  };

  useEffect(() => {
    if (hasTrackedOpenRef.current) {
      return;
    }
    hasTrackedOpenRef.current = true;

    captureAnalyticsEvent("settings_open", {
      sync_network_policy: syncNetworkPolicy,
    });
  }, [syncNetworkPolicy]);

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <SettingsSection theme={theme} title={t("settingsAppPreferences")}>
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
          <View
            style={[
              styles.currencyRow,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              darkColor="transparent"
              lightColor="transparent"
              style={styles.currencyLabelRow}
            >
              <Ionicons color={theme.tint} name="cash-outline" size={18} />
              <Text style={[styles.currencyLabel, { color: theme.text }]}>
                {t("settingsHomeCurrency")}
              </Text>
            </View>
            <CurrencyPicker
              chipCodes={POPULAR_CURRENCIES}
              onSelect={setHomeCurrency}
              selected={homeCurrency ?? deviceCurrencyCode()}
            />
          </View>
        </SettingsSection>

        <SettingsSection theme={theme} title={t("settingsSync")}>
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
                  accessibilityLabel={t(option.labelKey)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.value}
                  onPress={() => handleSyncPolicyChange(option.value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    index === syncOptions.length - 1 && styles.optionRowLast,
                    {
                      borderBottomColor: theme.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <View
                    darkColor="transparent"
                    lightColor="transparent"
                    style={styles.optionRowLeft}
                  >
                    <Ionicons
                      color={isSelected ? theme.tint : theme.mutedText}
                      name={option.icon}
                      size={20}
                    />
                    <View darkColor="transparent" lightColor="transparent">
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
                    color={isSelected ? theme.tint : theme.mutedText}
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                  />
                </Pressable>
              );
            })}
          </View>
        </SettingsSection>

        <SettingsSection theme={theme} title={t("settingsPrivacy")}>
          <View
            style={[
              styles.optionCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              darkColor="transparent"
              lightColor="transparent"
              style={[styles.analyticsRow]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.analyticsRowLeft}
              >
                <Ionicons
                  color={analyticsEnabled ? theme.tint : theme.mutedText}
                  name="bar-chart-outline"
                  size={20}
                />
                <View darkColor="transparent" lightColor="transparent">
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
                accessibilityLabel={t("settingsAnalyticsLabel")}
                accessibilityRole="switch"
                onValueChange={setAnalyticsEnabled}
                thumbColor="#fff"
                trackColor={{
                  false: theme.border,
                  true: theme.tint,
                }}
                value={analyticsEnabled}
              />
            </View>
          </View>
        </SettingsSection>

        <SettingsSection
          hint={t("settingsSupportHint")}
          theme={theme}
          title={t("settingsSupport")}
        >
          <View
            style={[
              styles.supportCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Pressable
              accessibilityLabel={t("settingsReportBug")}
              accessibilityRole="button"
              onPress={() =>
                Linking.openURL(
                  `mailto:${SUPPORT_EMAIL}?subject=FlightMode%20Bug%20Report`
                )
              }
              style={({ pressed }) => [
                styles.supportRow,
                { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.supportRowLeft}
              >
                <Ionicons color={theme.tint} name="bug-outline" size={20} />
                <Text style={styles.supportRowTitle}>
                  {t("settingsReportBug")}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={16}
              />
            </Pressable>

            <Pressable
              accessibilityLabel={t("settingsSuggestFeature")}
              accessibilityRole="button"
              onPress={() =>
                Linking.openURL(
                  `mailto:${SUPPORT_EMAIL}?subject=FlightMode%20Feature%20Suggestion`
                )
              }
              style={({ pressed }) => [
                styles.supportRow,
                { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.supportRowLeft}
              >
                <Ionicons color={theme.tint} name="bulb-outline" size={20} />
                <Text style={styles.supportRowTitle}>
                  {t("settingsSuggestFeature")}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={16}
              />
            </Pressable>

            <Pressable
              accessibilityLabel={t("settingsBecomeSupporter")}
              accessibilityRole="button"
              onPress={handleSupportOpen}
              style={({ pressed }) => [
                styles.supportRow,
                { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.supportRowLeft}
              >
                <Ionicons
                  color={theme.tint}
                  name="airplane-outline"
                  size={20}
                />
                <Text style={styles.supportRowTitle}>
                  {t("settingsBecomeSupporter")}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={16}
              />
            </Pressable>

            <View
              darkColor="transparent"
              lightColor="transparent"
              style={[styles.supportRow, { borderBottomColor: theme.border }]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.supportRowLeft}
              >
                <Ionicons
                  color={theme.mutedText}
                  name="heart-outline"
                  size={20}
                />
                <Text
                  style={[styles.supportRowTitle, { color: theme.mutedText }]}
                >
                  {t("settingsSupportDevelopment")}
                </Text>
              </View>
            </View>

            <View
              darkColor="transparent"
              lightColor="transparent"
              style={[styles.supportRow, styles.supportRowLast]}
            >
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={styles.supportRowLeft}
              >
                <Ionicons
                  color={theme.mutedText}
                  name="information-circle-outline"
                  size={20}
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

interface SettingsSectionProps {
  children: ReactNode;
  hint?: string;
  theme: (typeof Colors)["dark"];
  title: string;
}

function SettingsSection({
  title,
  hint,
  theme,
  children,
}: SettingsSectionProps) {
  return (
    <View
      darkColor="transparent"
      lightColor="transparent"
      style={styles.section}
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

interface SettingControlRowProps {
  children: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  theme: (typeof Colors)["dark"];
}

function SettingControlRow({
  icon,
  label,
  theme,
  children,
}: SettingControlRowProps) {
  return (
    <View
      darkColor="transparent"
      lightColor="transparent"
      style={styles.preferenceRow}
    >
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.preferenceLabelWrap}
      >
        <Ionicons color={theme.tint} name={icon} size={18} />
        <Text style={styles.preferenceLabel}>{label}</Text>
      </View>
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.preferenceControl}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  analyticsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  analyticsRowLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    paddingRight: 12,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 24,
    paddingTop: 12,
  },
  currencyLabel: { fontSize: 15, fontWeight: "600" },
  currencyLabelRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  currencyRow: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 10,
    padding: 14,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionRowLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    paddingRight: 12,
  },
  optionRowTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  preferenceControl: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  preferenceLabelWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    width: 92,
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  section: {
    gap: 8,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -3,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  supportCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  supportRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  supportRowHint: {
    fontSize: 11,
    marginTop: 1,
  },
  supportRowLast: {
    borderBottomWidth: 0,
  },
  supportRowLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  supportRowTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  versionText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
