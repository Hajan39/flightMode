import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  /** All-time best score for this game. */
  best?: number;
  /** Optional formatter for any numeric stat (score / best / last). */
  formatScore?: (value: number) => string;
  /** When true, displays a "🎉 New Best!" badge above the score. */
  isNewBest?: boolean;
  /** Score from previous round, if different from current. */
  last?: number;
  onPlayAgain: () => void;
  /** Called when the user taps "Quit". Defaults to router.back(). */
  onQuit?: () => void;
  score: number;
  /** Current win streak. */
  streak?: number;
  subtitle?: string;
  title: string;
}

export default function GameResult({
  title,
  score,
  subtitle,
  onPlayAgain,
  onQuit,
  isNewBest,
  best,
  last,
  streak,
  formatScore,
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();
  const haptic = useHaptic();
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // Delay so the haptic fires when the card is fully visible (~450ms after mount)
    const timer = setTimeout(() => {
      if (isNewBest) {
        haptic.success();
      } else {
        haptic.heavy();
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [haptic, isNewBest]);

  const handleQuit = () => {
    haptic.tap();
    if (onQuit) {
      onQuit();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const handlePlayAgain = () => {
    haptic.tap();
    onPlayAgain();
  };

  const fmt = formatScore ?? ((v: number) => String(v));

  const showStats =
    best !== undefined ||
    (last !== undefined && last !== score) ||
    (streak !== undefined && streak > 0);

  return (
    <Animated.View
      entering={FadeIn.delay(300).duration(200)}
      style={styles.overlay}
    >
      <Animated.View
        entering={
          reduceMotion
            ? FadeIn.delay(380).duration(180)
            : ZoomIn.delay(380).duration(220)
        }
        style={[
          styles.card,
          { backgroundColor: theme.elevated, borderColor: theme.border },
        ]}
      >
        {isNewBest ? (
          <Animated.View
            entering={
              reduceMotion
                ? FadeIn.delay(280).duration(180)
                : ZoomIn.delay(280).duration(200)
            }
            style={[styles.newBestBadge, { backgroundColor: theme.tint }]}
          >
            <Ionicons color="#fff" name="sparkles" size={14} />
            <Text style={styles.newBestText}>{t("gameNewBest")}</Text>
          </Animated.View>
        ) : (
          <Ionicons color={theme.tint} name="trophy-outline" size={32} />
        )}

        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

        <Text style={[styles.score, { color: theme.tint }]}>{fmt(score)}</Text>

        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {subtitle}
          </Text>
        ) : null}

        {showStats ? (
          <RNView style={styles.statsRow}>
            {best === undefined ? null : (
              <Stat
                color={theme.text}
                label={t("gameBest")}
                mutedColor={theme.mutedText}
                value={fmt(best)}
              />
            )}
            {last !== undefined && last !== score ? (
              <>
                {best === undefined ? null : (
                  <RNView
                    style={[
                      styles.statDivider,
                      { backgroundColor: theme.border },
                    ]}
                  />
                )}
                <Stat
                  color={theme.text}
                  label={t("gameLast")}
                  mutedColor={theme.mutedText}
                  value={fmt(last)}
                />
              </>
            ) : null}
            {streak !== undefined && streak > 0 ? (
              <>
                <RNView
                  style={[
                    styles.statDivider,
                    { backgroundColor: theme.border },
                  ]}
                />
                <Stat
                  color={theme.text}
                  label={t("gameStreak")}
                  mutedColor={theme.mutedText}
                  value={`🔥 ${streak}`}
                />
              </>
            ) : null}
          </RNView>
        ) : null}

        <RNView style={styles.actions}>
          <Pressable
            onPress={handleQuit}
            style={[
              styles.btnSecondary,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.mutedText} name="close" size={18} />
            <Text style={[styles.btnSecondaryText, { color: theme.text }]}>
              {t("gameQuit")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handlePlayAgain}
            style={[styles.btnPrimary, { backgroundColor: theme.tint }]}
          >
            <Ionicons color="#fff" name="refresh" size={20} />
            <Text style={styles.btnPrimaryText}>{t("playAgain")}</Text>
          </Pressable>
        </RNView>
      </Animated.View>
    </Animated.View>
  );
}

function Stat({
  label,
  value,
  color,
  mutedColor,
}: {
  label: string;
  value: string;
  color: string;
  mutedColor: string;
}) {
  return (
    <RNView style={styles.statBlock}>
      <Text style={[styles.statLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  btnPrimary: {
    alignItems: "center",
    borderRadius: Radius.button,
    flex: 2,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  btnSecondary: {
    alignItems: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  btnSecondaryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  card: {
    alignItems: "center",
    borderRadius: Radius.modal,
    borderWidth: 1,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing["3xl"],
    paddingTop: Spacing["3xl"],
    width: "100%",
    ...Shadow.modal,
  },
  newBestBadge: {
    alignItems: "center",
    borderRadius: Radius.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  newBestText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: Spacing["4xl"],
    zIndex: 10,
  },
  score: {
    fontSize: FontSize["5xl"],
    fontWeight: FontWeight.black,
    letterSpacing: -1,
    lineHeight: FontSize["5xl"] + 6,
  },
  statBlock: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statDivider: {
    height: 32,
    width: 1,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: -2,
    textAlign: "center",
  },
  title: {
    ...TextStyle.cardTitle,
    fontSize: FontSize.xl,
    marginTop: Spacing.xs,
  },
});
