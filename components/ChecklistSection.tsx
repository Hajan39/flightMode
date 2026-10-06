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

interface Props {
  customItems: CustomChecklistItem[];
  /** Destination-specific rows inserted before the custom ones. */
  extraItems?: {
    id: string;
    labelKey: SectionDef["items"][number]["labelKey"];
  }[];
  /** Destination sections have no "add your own" field. */
  hideAddField?: boolean;
  /** Template section, or a synthetic one for the destination block. */
  section: SectionDef;
  /** Overrides `t(section.titleKey)` — used for the interpolated "For {city}". */
  sectionTitle?: string;
}

interface Row {
  id: string;
  isCustom: boolean;
  label: string;
}

export default function ChecklistSection({
  section,
  customItems,
  extraItems = [],
  hideAddField,
  sectionTitle,
}: Props) {
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
      isCustom: false,
      label: t(item.labelKey),
    })),
    ...extraItems.map((item) => ({
      id: item.id,
      isCustom: false,
      label: t(item.labelKey),
    })),
    ...customItems.map((item) => ({
      id: item.id,
      isCustom: true,
      label: item.label,
    })),
  ];
  const done = rows.filter((row) => checkedIds.includes(row.id)).length;

  const submitDraft = () => {
    if (draft.trim().length === 0) {
      return;
    }
    addCustomItem(section.id, draft);
    haptic.tap();
    setDraft("");
  };

  const confirmDelete = (row: Row) => {
    Alert.alert(
      t("checklistDeleteCustomTitle"),
      t("checklistDeleteCustomMessage"),
      [
        { style: "cancel", text: t("gameCancel") },
        {
          onPress: () => removeCustomItem(row.id),
          style: "destructive",
          text: t("checklistDeleteCustomConfirm"),
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View
        darkColor="transparent"
        lightColor="transparent"
        style={styles.header}
      >
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}
        >
          <Ionicons
            color={theme.tint}
            name={section.icon as keyof typeof Ionicons.glyphMap}
            size={18}
          />
        </View>
        <Text style={styles.title}>{sectionTitle ?? t(section.titleKey)}</Text>
        <Text style={[styles.count, { color: theme.mutedText }]}>
          {done}/{rows.length}
        </Text>
      </View>

      {rows.map((row) => {
        const checked = checkedIds.includes(row.id);
        return (
          <Pressable
            accessibilityLabel={row.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            hitSlop={4}
            key={row.id}
            onLongPress={row.isCustom ? () => confirmDelete(row) : undefined}
            onPress={() => {
              haptic.tap();
              toggleItem(row.id);
            }}
            style={styles.row}
          >
            <Ionicons
              color={checked ? theme.tint : theme.mutedText}
              name={checked ? "checkbox" : "square-outline"}
              size={22}
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
              <Ionicons
                color={theme.mutedText}
                name="person-outline"
                size={14}
              />
            ) : null}
          </Pressable>
        );
      })}

      {hideAddField ? null : (
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.addRow}
        >
          <TextInput
            maxLength={MAX_CUSTOM_ITEM_LENGTH}
            onChangeText={setDraft}
            onSubmitEditing={submitDraft}
            placeholder={t("checklistAddPlaceholder")}
            placeholderTextColor={theme.mutedText}
            returnKeyType="done"
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={draft}
          />
          <Pressable
            accessibilityLabel={t("checklistAdd")}
            accessibilityRole="button"
            disabled={draft.trim().length === 0}
            onPress={submitDraft}
            style={[
              styles.addBtn,
              {
                backgroundColor: theme.tint,
                opacity: draft.trim().length === 0 ? 0.4 : 1,
              },
            ]}
          >
            <Ionicons color={theme.onTint} name="add" size={20} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    alignItems: "center",
    borderRadius: Radius.card,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  addRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  card: {
    borderRadius: Radius.panel,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.lg,
  },
  count: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  input: {
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    fontSize: FontSize.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    minHeight: 44,
    paddingVertical: Spacing.sm + 2,
  },
  rowLabel: { flex: 1, fontSize: FontSize.base, lineHeight: 20 },
  title: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
