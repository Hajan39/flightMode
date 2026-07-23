import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { gameRegistry } from "@/data/games";
import { useContentItems } from "@/hooks/useContentItems";
import { useTranslation } from "@/hooks/useTranslation";
import { useContentStore } from "@/store/useContentStore";
import { useNetworkStore } from "@/store/useNetworkStore";

const SOUNDSCAPE_COUNT = 4; // rain / white noise / ocean / cabin — see relax.tsx

function ReadyRow({
	icon,
	label,
	sublabel,
	theme,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	sublabel: string;
	theme: (typeof Colors)["dark"];
}) {
	return (
		<View style={[styles.row, { borderColor: theme.border }]}>
			<View
				style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}
				lightColor="transparent"
				darkColor="transparent"
			>
				<Ionicons name={icon} size={20} color={theme.tint} />
			</View>
			<View
				style={styles.rowText}
				lightColor="transparent"
				darkColor="transparent"
			>
				<Text style={styles.rowLabel}>{label}</Text>
				<Text style={[styles.rowSub, { color: theme.mutedText }]}>
					{sublabel}
				</Text>
			</View>
			<Ionicons name="checkmark-circle" size={22} color={theme.successBorder} />
		</View>
	);
}

export default function PreflightScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	const articles = useContentItems();
	const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
	const syncStatus = useContentStore((s) => s.status);
	const syncContent = useContentStore((s) => s.syncContent);

	const online = isInternetReachable === true;
	const gameCount = gameRegistry.length;
	const articleCount = articles.length;

	return (
		<SafeAreaView
			style={[styles.screen, { backgroundColor: theme.background }]}
			edges={["bottom"]}
		>
			<ScrollView
				style={styles.screen}
				contentContainerStyle={styles.container}
			>
				<View
					style={styles.hero}
					lightColor="transparent"
					darkColor="transparent"
				>
					<View
						style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}
						lightColor="transparent"
						darkColor="transparent"
					>
						<Ionicons name="airplane" size={34} color={theme.tint} />
					</View>
					<Text style={styles.heroTitle}>{t("preflightHeroTitle")}</Text>
					<Text style={[styles.heroSub, { color: theme.mutedText }]}>
						{t("preflightHeroSubtitle")}
					</Text>
				</View>
	
				<View
					style={styles.list}
					lightColor="transparent"
					darkColor="transparent"
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
						name={online ? "wifi" : "airplane-outline"}
						size={18}
						color={online ? theme.successBorder : theme.mutedText}
					/>
					<Text style={[styles.networkText, { color: theme.text }]}>
						{online ? t("preflightNetworkOnline") : t("preflightNetworkOffline")}
					</Text>
				</View>
	
				{/* Optional: refresh remote content while still online */}
				{online && (
					<AnimatedPressable
						disabled={syncStatus === "syncing"}
						onPress={() => void syncContent()}
						style={[
							styles.refreshBtn,
							{ backgroundColor: theme.tint, opacity: syncStatus === "syncing" ? 0.6 : 1 },
						]}
					>
						<Ionicons name="cloud-download-outline" size={18} color="#fff" />
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
	screen: { flex: 1 },
	container: { padding: 20, paddingBottom: 40 },
	hero: { alignItems: "center", gap: 10, marginTop: 8, marginBottom: 24 },
	heroIcon: {
		width: 72,
		height: 72,
		borderRadius: 36,
		alignItems: "center",
		justifyContent: "center",
	},
	heroTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
	heroSub: { fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: 8 },
	list: { gap: 10 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		borderWidth: 1,
		borderRadius: 14,
		padding: 14,
	},
	rowIcon: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	rowText: { flex: 1, gap: 2 },
	rowLabel: { fontSize: 15, fontWeight: "600" },
	rowSub: { fontSize: 12 },
	networkRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		borderWidth: 1,
		borderRadius: 12,
		padding: 14,
		marginTop: 20,
	},
	networkText: { fontSize: 14, fontWeight: "600", flex: 1 },
	refreshBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		borderRadius: 24,
		paddingVertical: 14,
		marginTop: 16,
	},
	refreshText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
