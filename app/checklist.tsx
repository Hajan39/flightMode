import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChecklistSection from "@/components/ChecklistSection";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { type ChecklistSection as SectionDef, checklistSections } from "@/data/checklist";
import { getDestinationById } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import {
	destinationItemId,
	getChecklistProgress,
	useChecklistStore,
} from "@/store/useChecklistStore";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function ChecklistScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const flight = useFlightStore((s) => s.flight);
	const checkedIds = useChecklistStore((s) => s.checkedIds);
	const customItems = useChecklistStore((s) => s.customItems);
	const resetForFlight = useChecklistStore((s) => s.resetForFlight);

	const destination = flight?.destinationId
		? getDestinationById(flight.destinationId)
		: undefined;
	const destinationExtras = (destination?.checklistExtras ?? []).map((labelKey) => ({
		id: destinationItemId(labelKey),
		labelKey,
	}));
	/**
	 * Rendered blocks: the fixed templates, with a synthetic destination block
	 * ("For Tokyo") inserted right before "At arrival" when the flight has one.
	 */
	type Block = {
		key: string;
		section: SectionDef;
		title?: string;
		extraItems?: typeof destinationExtras;
		hideAddField?: boolean;
	};
	const blocks: Block[] = checklistSections.flatMap((section) => {
		const own: Block = { key: section.id, section };
		if (section.id !== "atArrival" || !destination || destinationExtras.length === 0) {
			return [own];
		}
		return [
			{
				key: "destination",
				section: {
					id: "atArrival",
					titleKey: "checklistSectionForCity",
					icon: "location-outline",
					items: [],
				},
				title: t("checklistSectionForCity", { city: destination.city }),
				extraItems: destinationExtras,
				hideAddField: true,
			},
			own,
		];
	});
	const { done, total } = getChecklistProgress(
		{ checkedIds, customItems },
		destinationExtras.map((item) => item.id),
	);
	const ratio = total > 0 ? done / total : 0;
	const allDone = total > 0 && done >= total;

	useEffect(() => {
		captureAnalyticsEvent("checklist_open", { source: "screen" });
	}, []);

	const confirmReset = () => {
		Alert.alert(t("checklistResetTitle"), t("checklistResetMessage"), [
			{ text: t("gameCancel"), style: "cancel" },
			{
				text: t("checklistReset"),
				style: "destructive",
				onPress: () => resetForFlight(flight?.id ?? null, "manual"),
			},
		]);
	};

	return (
		<>
			<Stack.Screen
				options={{
					headerRight: () => (
						<Pressable
							onPress={confirmReset}
							hitSlop={10}
							accessibilityRole="button"
							accessibilityLabel={t("checklistReset")}
						>
							<Ionicons name="refresh-outline" size={22} color={theme.tint} />
						</Pressable>
					),
				}}
			/>
			<SafeAreaView
				style={[styles.screen, { backgroundColor: theme.background }]}
				edges={["bottom"]}
			>
				<KeyboardAvoidingView
					style={styles.screen}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<ScrollView
						style={styles.screen}
						contentContainerStyle={styles.container}
						keyboardShouldPersistTaps="handled"
					>
						<View style={styles.hero} lightColor="transparent" darkColor="transparent">
							<View
								style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Ionicons
									name={allDone ? "checkmark-done" : "checkbox-outline"}
									size={34}
									color={theme.tint}
								/>
							</View>
							<Text style={styles.heroTitle}>
								{flight?.flightNumber
									? `${t("checklistHeroTitle")} · ${flight.flightNumber}`
									: t("checklistHeroTitle")}
							</Text>
							<Text style={[styles.heroSub, { color: theme.mutedText }]}>
								{allDone
									? t("checklistAllDone")
									: t("checklistHeroSubtitle")}
							</Text>
							<View
								style={[styles.progressBar, { backgroundColor: theme.progressTrack }]}
								lightColor="transparent"
								darkColor="transparent"
							>
								<View
									style={[
										styles.progressFill,
										{ backgroundColor: theme.tint, width: `${Math.round(ratio * 100)}%` },
									]}
									lightColor="transparent"
									darkColor="transparent"
								/>
							</View>
							<Text style={[styles.progressText, { color: theme.tint }]}>
								{t("checklistProgress", { done, total })}
							</Text>
						</View>

						<View style={styles.list} lightColor="transparent" darkColor="transparent">
							{blocks.map((block) => (
								<ChecklistSection
									key={block.key}
									section={block.section}
									sectionTitle={block.title}
									extraItems={block.extraItems}
									hideAddField={block.hideAddField}
									customItems={
										block.key === "destination"
											? []
											: customItems.filter(
													(item) => item.sectionId === block.section.id,
												)
									}
								/>
							))}
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	container: { padding: Spacing.xl, paddingBottom: Spacing["4xl"] * 2 },
	hero: { alignItems: "center", gap: Spacing.sm + 2, marginTop: Spacing.sm, marginBottom: Spacing["2xl"] },
	heroIcon: {
		width: 72,
		height: 72,
		borderRadius: 36,
		alignItems: "center",
		justifyContent: "center",
	},
	heroTitle: { fontSize: FontSize["2xl"], fontWeight: FontWeight.bold, textAlign: "center" },
	heroSub: {
		fontSize: FontSize.base,
		lineHeight: 20,
		textAlign: "center",
		paddingHorizontal: Spacing.sm,
	},
	progressBar: {
		alignSelf: "stretch",
		height: 8,
		borderRadius: Radius.pill,
		overflow: "hidden",
		marginTop: Spacing.sm,
	},
	progressFill: { height: "100%", borderRadius: Radius.pill },
	progressText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	list: { gap: Spacing.md },
});
