import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { ChecklistSection as SectionDef } from "@/data/checklist";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import {
	type CustomChecklistItem,
	MAX_CUSTOM_ITEM_LENGTH,
	useChecklistStore,
} from "@/store/useChecklistStore";

type Props = {
	section: SectionDef;
	customItems: CustomChecklistItem[];
};

type Row = { id: string; label: string; isCustom: boolean };

export default function ChecklistSection({ section, customItems }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const checkedIds = useChecklistStore((s) => s.checkedIds);
	const toggleItem = useChecklistStore((s) => s.toggleItem);
	const addCustomItem = useChecklistStore((s) => s.addCustomItem);
	const removeCustomItem = useChecklistStore((s) => s.removeCustomItem);
	const [draft, setDraft] = useState("");

	const rows: Row[] = [
		...section.items.map((item) => ({
			id: item.id,
			label: t(item.labelKey),
			isCustom: false,
		})),
		...customItems.map((item) => ({
			id: item.id,
			label: item.label,
			isCustom: true,
		})),
	];
	const done = rows.filter((row) => checkedIds.includes(row.id)).length;

	const submitDraft = () => {
		if (draft.trim().length === 0) return;
		addCustomItem(section.id, draft);
		haptic.tap();
		setDraft("");
	};

	const confirmDelete = (row: Row) => {
		Alert.alert(
			t("checklistDeleteCustomTitle"),
			t("checklistDeleteCustomMessage"),
			[
				{ text: t("gameCancel"), style: "cancel" },
				{
					text: t("checklistDeleteCustomConfirm"),
					style: "destructive",
					onPress: () => removeCustomItem(row.id),
				},
			],
		);
	};

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: theme.card, borderColor: theme.border },
			]}
		>
			<View style={styles.header} lightColor="transparent" darkColor="transparent">
				<View
					style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}
					lightColor="transparent"
					darkColor="transparent"
				>
					<Ionicons
						name={section.icon as keyof typeof Ionicons.glyphMap}
						size={18}
						color={theme.tint}
					/>
				</View>
				<Text style={styles.title}>{t(section.titleKey)}</Text>
				<Text style={[styles.count, { color: theme.mutedText }]}>
					{done}/{rows.length}
				</Text>
			</View>

			{rows.map((row) => {
				const checked = checkedIds.includes(row.id);
				return (
					<Pressable
						key={row.id}
						style={styles.row}
						onPress={() => {
							haptic.tap();
							toggleItem(row.id);
						}}
						onLongPress={row.isCustom ? () => confirmDelete(row) : undefined}
						accessibilityRole="checkbox"
						accessibilityState={{ checked }}
						accessibilityLabel={row.label}
						hitSlop={4}
					>
						<Ionicons
							name={checked ? "checkbox" : "square-outline"}
							size={22}
							color={checked ? theme.tint : theme.mutedText}
						/>
						<Text
							style={[
								styles.rowLabel,
								checked && {
									color: theme.mutedText,
									textDecorationLine: "line-through",
								},
							]}
						>
							{row.label}
						</Text>
						{row.isCustom ? (
							<Ionicons name="person-outline" size={14} color={theme.mutedText} />
						) : null}
					</Pressable>
				);
			})}

			<View style={styles.addRow} lightColor="transparent" darkColor="transparent">
				<TextInput
					value={draft}
					onChangeText={setDraft}
					onSubmitEditing={submitDraft}
					placeholder={t("checklistAddPlaceholder")}
					placeholderTextColor={theme.mutedText}
					maxLength={MAX_CUSTOM_ITEM_LENGTH}
					returnKeyType="done"
					style={[
						styles.input,
						{
							backgroundColor: theme.inputBackground,
							borderColor: theme.border,
							color: theme.text,
						},
					]}
				/>
				<Pressable
					onPress={submitDraft}
					disabled={draft.trim().length === 0}
					accessibilityRole="button"
					accessibilityLabel={t("checklistAdd")}
					style={[
						styles.addBtn,
						{
							backgroundColor: theme.tint,
							opacity: draft.trim().length === 0 ? 0.4 : 1,
						},
					]}
				>
					<Ionicons name="add" size={20} color={theme.onTint} />
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1,
		borderRadius: Radius.panel,
		padding: Spacing.lg,
		gap: Spacing.xs,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		marginBottom: Spacing.sm,
	},
	headerIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	title: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold },
	count: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingVertical: Spacing.sm + 2,
		minHeight: 44,
	},
	rowLabel: { flex: 1, fontSize: FontSize.base, lineHeight: 20 },
	addRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		marginTop: Spacing.sm,
	},
	input: {
		flex: 1,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm + 2,
		fontSize: FontSize.base,
	},
	addBtn: {
		width: 40,
		height: 40,
		borderRadius: Radius.card,
		alignItems: "center",
		justifyContent: "center",
	},
});
