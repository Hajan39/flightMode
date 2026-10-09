import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useEffect, useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { MAX_MATCH_PLAYERS } from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { type MatchPlayer, useMatchPlayers } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import {
  MAX_PLAYER_NAME_LENGTH,
  usePlayersStore,
} from "@/store/usePlayersStore";

interface Props {
  /** Game-specific options (best-of, difficulty, board mode) rendered between names and Start. */
  children?: ReactNode;
  /** Locks the player count (e.g. 2 for head-to-head games). */
  fixedCount?: number;
  maxPlayers?: number;
  minPlayers?: number;
  /** Show the name fields expanded on first render (icebreaker games want names). */
  namesExpanded?: boolean;
  onStart: (players: MatchPlayer[]) => void;
  startLabel?: string;
  /** One-line rules teaser or hint under the title. */
  subtitle?: string;
  /** Game title shown at the top (usually `t(def.titleKey)`). */
  title: string;
}

/**
 * Shared setup screen for every multiplayer game: player count chips, optional
 * per-seat names (persisted across games), game options, and a Start button.
 */
export default function PlayerSetup({
  title,
  subtitle,
  minPlayers = 2,
  maxPlayers = MAX_MATCH_PLAYERS,
  fixedCount,
  children,
  namesExpanded = false,
  startLabel,
  onStart,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const seats = usePlayersStore((s) => s.seats);
  const lastCount = usePlayersStore((s) => s.lastCount);
  const setSeatName = usePlayersStore((s) => s.setSeatName);
  const setLastCount = usePlayersStore((s) => s.setLastCount);

  const clamp = (n: number) => Math.max(minPlayers, Math.min(maxPlayers, n));
  const [count, setCount] = useState(fixedCount ?? clamp(lastCount));
  const [showNames, setShowNames] = useState(
    namesExpanded || seats.slice(0, count).some((s) => s.name.trim().length > 0)
  );
  const players = useMatchPlayers(count);

  useEffect(() => {
    if (fixedCount !== undefined) {
      setCount(fixedCount);
    }
  }, [fixedCount]);

  const handleStart = () => {
    haptic.tap();
    if (fixedCount === undefined) {
      setLastCount(count);
    }
    onStart(players);
  };

  const countOptions = Array.from(
    { length: maxPlayers - minPlayers + 1 },
    (_, i) => minPlayers + i
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <Animated.View entering={FadeInDown.duration(220)} style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {fixedCount === undefined ? (
        <RNView style={styles.block}>
          <Text style={[styles.blockLabel, { color: theme.mutedText }]}>
            {t("mpSelectPlayers")}
          </Text>
          <RNView style={styles.countRow}>
            {countOptions.map((n) => {
              const active = count === n;
              return (
                <Pressable
                  accessibilityLabel={t("mpPlayersCount", { n })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={n}
                  onPress={() => {
                    haptic.tap();
                    setCount(n);
                  }}
                  style={[
                    styles.countBtn,
                    {
                      backgroundColor: active ? theme.tint : theme.card,
                      borderColor: active ? theme.tint : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBtnText,
                      { color: active ? theme.onTint : theme.text },
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </RNView>
        </RNView>
      ) : null}

      <RNView style={styles.block}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showNames }}
          onPress={() => {
            haptic.tap();
            setShowNames((v) => !v);
          }}
          style={styles.namesToggle}
        >
          <RNView style={styles.dotRow}>
            {players.map((p) => (
              <RNView
                key={p.index}
                style={[styles.dot, { backgroundColor: p.color }]}
              />
            ))}
          </RNView>
          <Text style={[styles.namesToggleText, { color: theme.text }]}>
            {showNames ? t("mpHideNames") : t("mpAddNames")}
          </Text>
          <Ionicons
            color={theme.mutedText}
            name={showNames ? "chevron-up" : "chevron-down"}
            size={18}
          />
        </Pressable>

        {showNames ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            style={styles.nameList}
          >
            {players.map((p) => (
              <RNView key={p.index} style={styles.nameRow}>
                <RNView style={[styles.dotLarge, { backgroundColor: p.color }]}>
                  <Text style={styles.dotLargeText}>{p.index + 1}</Text>
                </RNView>
                <TextInput
                  accessibilityLabel={t("mpNameFor", { n: p.index + 1 })}
                  autoCorrect={false}
                  maxLength={MAX_PLAYER_NAME_LENGTH}
                  onChangeText={(v) => setSeatName(p.index, v)}
                  placeholder={
                    p.isHost
                      ? `${t("mpPlayerN", { n: 1 })} · ${t("mpYouHint")}`
                      : t("mpPlayerN", { n: p.index + 1 })
                  }
                  placeholderTextColor={theme.mutedText}
                  returnKeyType="done"
                  style={[
                    styles.nameInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={seats[p.index]?.name ?? ""}
                />
              </RNView>
            ))}
          </Animated.View>
        ) : null}
      </RNView>

      {children ? <RNView style={styles.block}>{children}</RNView> : null}

      <Pressable
        accessibilityLabel={startLabel ?? t("start")}
        accessibilityRole="button"
        onPress={handleStart}
        style={[styles.startBtn, { backgroundColor: theme.tint }]}
      >
        <Ionicons color={theme.onTint} name="play" size={20} />
        <Text style={[styles.startBtnText, { color: theme.onTint }]}>
          {startLabel ?? t("start")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/** Small helper for option chips inside `PlayerSetup` children. */
export function OptionChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const haptic = useHaptic();
  return (
    <RNView style={styles.optionBlock}>
      {label ? (
        <Text style={[styles.blockLabel, { color: theme.mutedText }]}>
          {label}
        </Text>
      ) : null}
      <RNView style={styles.optionRow}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={String(opt.value)}
              onPress={() => {
                haptic.tap();
                onChange(opt.value);
              }}
              style={[
                styles.optionChip,
                {
                  backgroundColor: active ? theme.tint : theme.card,
                  borderColor: active ? theme.tint : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionChipText,
                  { color: active ? theme.onTint : theme.text },
                ]}
              >
                {opt.label}
              </Text>
              {opt.hint ? (
                <Text
                  style={[
                    styles.optionChipHint,
                    { color: active ? theme.onTint : theme.mutedText },
                  ]}
                >
                  {opt.hint}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.sm },
  blockLabel: { ...TextStyle.statLabel },
  container: {
    flexGrow: 1,
    gap: Spacing.xl,
    justifyContent: "center",
    padding: Spacing.xl,
    paddingBottom: Spacing["4xl"],
  },
  countBtn: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  countBtnText: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  dot: { borderRadius: 5, height: 10, width: 10 },
  dotLarge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  dotLargeText: {
    color: "#0b1620",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
  },
  dotRow: { flexDirection: "row", gap: 4 },
  header: { alignItems: "center", gap: Spacing.xs },
  nameInput: {
    borderRadius: Radius.card,
    borderWidth: 1,
    flex: 1,
    fontSize: FontSize.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  nameList: { gap: Spacing.sm },
  nameRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  namesToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    minHeight: 44,
  },
  namesToggleText: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  optionBlock: { gap: Spacing.sm },
  optionChip: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1.5,
    flexGrow: 1,
    justifyContent: "center",
    minWidth: 90,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  optionChipHint: { fontSize: FontSize.xs, marginTop: 2 },
  optionChipText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  scroll: { flex: 1, width: "100%" },
  startBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  startBtnText: { ...TextStyle.buttonPrimary },
  subtitle: {
    ...TextStyle.hint,
    paddingHorizontal: Spacing.md,
    textAlign: "center",
  },
  title: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
    textAlign: "center",
  },
});
