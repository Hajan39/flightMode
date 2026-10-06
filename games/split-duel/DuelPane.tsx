import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";

import { type Challenge, COLOR_HEX, type ColorId } from "./logic";

export type PaneStatus = "idle" | "countdown" | "live" | "won" | "lost" | "tie";

export interface PaneProps {
  challenge: Challenge | null;
  /** 3,2,1 during countdown. */
  countdown: number;
  /** Current disc color for the "color" challenge. */
  discColor: ColorId | null;
  /** True once the "green" challenge has turned green. */
  greenOn: boolean;
  /** Live hold duration for the "hold" challenge (ms), null when not holding. */
  holdMs: number | null;
  onHoldEnd: () => void;
  onHoldStart: () => void;
  onTap: (payload?: number) => void;
  player: MatchPlayer;
  /** Reaction time to show on a won pane. */
  reactionMs: number | null;
  status: PaneStatus;
  wins: number;
}

const COLOR_KEYS: Record<ColorId, TranslationKey> = {
  blue: "sdColorBlue",
  green: "sdColorGreen",
  orange: "sdColorOrange",
  purple: "sdColorPurple",
  red: "sdColorRed",
  yellow: "sdColorYellow",
};

/**
 * One half of the Split Duel screen. The parent renders two of these with the
 * same props; the top one is rotated 180° so it faces the other player.
 */
export default function DuelPane({
  player,
  challenge,
  status,
  countdown,
  discColor,
  greenOn,
  holdMs,
  reactionMs,
  wins,
  onTap,
  onHoldStart,
  onHoldEnd,
}: PaneProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();

  const resultBg =
    status === "won"
      ? `${player.color}33`
      : status === "lost"
        ? `${theme.danger}22`
        : status === "tie"
          ? theme.surface
          : theme.card;

  const renderBody = () => {
    if (status === "idle") {
      return (
        <Text style={[styles.big, { color: theme.mutedText }]}>
          {t("sdGetReady")}
        </Text>
      );
    }
    if (status === "countdown") {
      return (
        <Animated.Text
          entering={ZoomIn.duration(160)}
          key={countdown}
          style={[styles.countdown, { color: player.color }]}
        >
          {countdown > 0 ? countdown : t("gameGo")}
        </Animated.Text>
      );
    }
    if (status !== "live") {
      const label =
        status === "won"
          ? t("sdRoundWon")
          : status === "lost"
            ? t("sdRoundLost")
            : t("sdRoundTie");
      return (
        <Animated.View entering={FadeIn.duration(160)} style={styles.center}>
          <Text
            style={[
              styles.big,
              {
                color:
                  status === "won"
                    ? player.color
                    : status === "lost"
                      ? theme.danger
                      : theme.mutedText,
              },
            ]}
          >
            {status === "won" ? "🏆 " : status === "lost" ? "✖ " : "🤝 "}
            {label}
          </Text>
          {status === "won" && reactionMs !== null ? (
            <Text style={[styles.sub, { color: theme.mutedText }]}>
              {t("sdReaction", { ms: Math.round(reactionMs) })}
            </Text>
          ) : null}
        </Animated.View>
      );
    }
    if (!challenge) {
      return null;
    }

    switch (challenge.kind) {
      case "color":
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => onTap()}
            style={styles.fill}
          >
            <Text style={[styles.prompt, { color: theme.text }]}>
              {t("sdTapWhen", { color: t(COLOR_KEYS[challenge.target]) })}
            </Text>
            <RNView
              style={[
                styles.disc,
                {
                  backgroundColor: discColor
                    ? COLOR_HEX[discColor]
                    : theme.surface,
                },
              ]}
            />
          </Pressable>
        );
      case "odd":
        return (
          <RNView style={styles.center}>
            <Text style={[styles.prompt, { color: theme.text }]}>
              {t("sdFindOdd")}
            </Text>
            <RNView style={styles.grid}>
              {challenge.grid.map((emoji, i) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${i}-${emoji}`}
                  onPress={() => onTap(i)}
                  style={[
                    styles.gridCell,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Text style={styles.gridEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </RNView>
          </RNView>
        );
      case "hold":
        return (
          <RNView style={styles.center}>
            <Text style={[styles.prompt, { color: theme.text }]}>
              {t("sdHoldRelease", {
                seconds: (challenge.targetMs / 1000).toFixed(1),
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPressIn={onHoldStart}
              onPressOut={onHoldEnd}
              style={[
                styles.holdBtn,
                {
                  backgroundColor: holdMs === null ? theme.card : player.color,
                  borderColor: player.color,
                },
              ]}
            >
              <Text
                style={[
                  styles.holdText,
                  { color: holdMs === null ? theme.text : "#0b1620" },
                ]}
              >
                {holdMs === null ? t("sdHold") : t("sdHolding")}
              </Text>
            </Pressable>
          </RNView>
        );
      case "math":
        return (
          <RNView style={styles.center}>
            <Text style={[styles.mathPrompt, { color: theme.text }]}>
              {challenge.prompt}
            </Text>
            <RNView style={styles.optionRow}>
              {challenge.options.map((opt) => (
                <Pressable
                  accessibilityRole="button"
                  key={opt}
                  onPress={() => onTap(opt)}
                  style={[
                    styles.optionBtn,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.optionText, { color: theme.text }]}>
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </RNView>
          </RNView>
        );
      case "green":
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => onTap()}
            style={[
              styles.fill,
              {
                backgroundColor: greenOn ? COLOR_HEX.green : theme.surface,
                borderRadius: Radius.panel,
              },
            ]}
          >
            <Text
              style={[
                styles.prompt,
                { color: greenOn ? "#0b1620" : theme.text },
              ]}
            >
              {greenOn ? t("sdTapNow") : t("sdTapGreen")}
            </Text>
          </Pressable>
        );
    }
  };

  return (
    <RNView
      style={[
        styles.pane,
        { backgroundColor: resultBg, borderColor: player.color },
      ]}
    >
      <RNView style={styles.header}>
        <RNView style={[styles.dot, { backgroundColor: player.color }]} />
        <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
          {player.name}
        </Text>
        <Text style={[styles.wins, { color: player.color }]}>
          {"●".repeat(wins)}
          <Text style={{ color: theme.border }}>
            {"●".repeat(Math.max(0, 3 - wins))}
          </Text>
        </Text>
      </RNView>
      <RNView style={styles.body}>{renderBody()}</RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  big: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    textAlign: "center",
  },
  body: { flex: 1 },
  center: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
    justifyContent: "center",
  },
  countdown: { fontSize: FontSize["5xl"], fontWeight: FontWeight.black },
  disc: { borderRadius: 48, height: 96, width: 96 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  fill: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    width: 174,
  },
  gridCell: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  gridEmoji: { fontSize: 26 },
  header: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  holdBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    borderWidth: 2,
    paddingVertical: Spacing.lg,
    width: 160,
  },
  holdText: { ...TextStyle.buttonSecondary },
  mathPrompt: { fontSize: FontSize["3xl"], fontWeight: FontWeight.black },
  name: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  optionBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    borderWidth: 1.5,
    minWidth: 84,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  optionRow: { flexDirection: "row", gap: Spacing.md },
  optionText: { fontSize: FontSize["2xl"], fontWeight: FontWeight.black },
  pane: {
    borderRadius: Radius.panel,
    borderWidth: 2,
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  prompt: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: "center",
  },
  sub: { ...TextStyle.hint },
  wins: { fontSize: FontSize.sm, letterSpacing: 2 },
});
