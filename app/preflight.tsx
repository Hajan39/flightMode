import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { gameRegistry } from "@/data/games";
import { useContentItems } from "@/hooks/useContentItems";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getChecklistProgress,
  getCurrentDestinationItemIds,
  useChecklistStore,
} from "@/store/useChecklistStore";
import { useContentStore } from "@/store/useContentStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useRatesStore } from "@/store/useRatesStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

function ReadyRow({
  icon,
  label,
  sublabel,
  theme,
  onPress,
  done = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  theme: (typeof Colors)["dark"];
  /** When set the row becomes a link (chevron instead of checkmark unless `done`). */
  onPress?: () => void;
  done?: boolean;
}) {
  const Wrapper = onPress ? AnimatedPressable : View;
  return (
    <Wrapper
      style={[styles.row, { borderColor: theme.border }]}
      {...(onPress ? { accessibilityRole: "button" as const, onPress } : {})}
    >
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}
      >
        <Ionicons color={theme.tint} name={icon} size={20} />
      </View>
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.rowText}
      >
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowSub, { color: theme.mutedText }]}>
          {sublabel}
        </Text>
      </View>
      {onPress && !done ? (
        <Ionicons color={theme.mutedText} name="chevron-forward" size={22} />
      ) : (
        <Ionicons
          color={theme.successBorder}
          name="checkmark-circle"
          size={22}
        />
      )}
    </Wrapper>
  );
}

export default function PreflightScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();

  const articles = useContentItems();
  const checkedIds = useChecklistStore((s) => s.checkedIds);
  const customItems = useChecklistStore((s) => s.customItems);
  const checklist = getChecklistProgress(
    { checkedIds, customItems },
    getCurrentDestinationItemIds()
  );
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const syncStatus = useContentStore((s) => s.status);
  const syncContent = useContentStore((s) => s.syncContent);
  const syncRates = useRatesStore((s) => s.syncRates);

  const online = isInternetReachable === true;
  const gameCount = gameRegistry.length;
  const articleCount = articles.length;

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        style={styles.screen}
      >
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.hero}
        >
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}
          >
            <Ionicons color={theme.tint} name="airplane" size={34} />
          </View>
          <Text style={styles.heroTitle}>{t("preflightHeroTitle")}</Text>
          <Text style={[styles.heroSub, { color: theme.mutedText }]}>
            {t("preflightHeroSubtitle")}
          </Text>
        </View>

        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.list}
        >
          <ReadyRow
            icon="game-controller-outline"
            label={t("preflightGamesCount", { count: gameCount })}
            sublabel={t("preflightReadyLabel")}
            theme={theme}
          />
          <ReadyRow
            icon="document-text-outline"
            label={t("preflightArticlesCount", { count: articleCount })}
            sublabel={t("preflightReadyLabel")}
            theme={theme}
          />
          <ReadyRow
            icon="leaf-outline"
            label={t("preflightRelax")}
            sublabel={t("preflightReadyLabel")}
            theme={theme}
          />
          <ReadyRow
            done={checklist.total > 0 && checklist.done >= checklist.total}
            icon="checkbox-outline"
            label={t("preflightChecklistRow")}
            onPress={() => {
              captureAnalyticsEvent("checklist_open", { source: "preflight" });
              router.push("/checklist" as never);
            }}
            sublabel={t("checklistProgress", {
              done: checklist.done,
              total: checklist.total,
            })}
            theme={theme}
          />
        </View>

        {/* Network status */}
        <View
          style={[
            styles.networkRow,
            {
              backgroundColor: online ? theme.successSurface : theme.card,
              borderColor: online ? theme.successBorder : theme.border,
            },
          ]}
        >
          <Ionicons
            color={online ? theme.successBorder : theme.mutedText}
            name={online ? "wifi" : "airplane-outline"}
            size={18}
          />
          <Text style={[styles.networkText, { color: theme.text }]}>
            {online
              ? t("preflightNetworkOnline")
              : t("preflightNetworkOffline")}
          </Text>
        </View>

        {/* Optional: refresh remote content while still online */}
        {online && (
          <AnimatedPressable
            disabled={syncStatus === "syncing"}
            onPress={() => {
              void syncContent();
              void syncRates({ force: true });
            }}
            style={[
              styles.refreshBtn,
              {
                backgroundColor: theme.tint,
                opacity: syncStatus === "syncing" ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons color="#fff" name="cloud-download-outline" size={18} />
            <Text style={styles.refreshText}>
              {syncStatus === "syncing"
                ? t("preflightRefreshing")
                : syncStatus === "success" || syncStatus === "skipped"
                  ? t("preflightUpToDate")
                  : t("preflightRefresh")}
            </Text>
          </AnimatedPressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: "center", gap: 10, marginBottom: 24, marginTop: 8 },
  heroIcon: {
    alignItems: "center",
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  heroTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  list: { gap: 10 },
  networkRow: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    padding: 14,
  },
  networkText: { flex: 1, fontSize: 14, fontWeight: "600" },
  refreshBtn: {
    alignItems: "center",
    borderRadius: 24,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 14,
  },
  refreshText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  row: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowSub: { fontSize: 12 },
  rowText: { flex: 1, gap: 2 },
  screen: { flex: 1 },
});
