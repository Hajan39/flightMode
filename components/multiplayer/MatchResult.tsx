import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { rankStandings } from "@/utils/multiplayerScoring";

export interface MatchStanding {
  /** Secondary text next to the score, e.g. "3 wins · 41 pts". */
  detail?: string;
  player: MatchPlayer;
  score: number;
  tiebreak?: number;
}

interface Props {
  /** Hide the ranking when everyone shares one result (cooperative games). */
  cooperative?: boolean;
  format?: (value: number) => string;
  onChangePlayers?: () => void;
  onQuit?: () => void;
  onRematch: () => void;
  /** Host's `recordMatch` result — shows streak / new-best line for seat 0. */
  progress?: GameProgressUpdate;
  /** Column label for the score (e.g. "wins", "points"). */
  scoreLabel: string;
  standings: MatchStanding[];
  subtitle?: string;
  /** Overrides the default "{winner} wins!" / "Draw" headline (e.g. a cooperative tier). */
  title?: string;
  /** null → draw. Usually `getSoleWinnerIndex(...)`. */
  winnerIndex: number | null;
}

/**
 * Leaderboard variant of `GameResult` for multiplayer games: ranked players,
 * winner highlight, host streak line, and Rematch / Change players / Quit.
 */
export default function MatchResult({
  title,
  subtitle,
  standings,
  winnerIndex,
  scoreLabel,
  progress,
  cooperative,
  onRematch,
  onChangePlayers,
  onQuit,
  format = (v) => String(v),
}: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();
  const haptic = useHaptic();
  const reduceMotion = useReduceMotion();

  const hostWon = winnerIndex === 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hostWon || progress?.isNewBest) {
        haptic.success();
      } else {
        haptic.heavy();
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [haptic, hostWon, progress?.isNewBest]);

  const ranked = rankStandings(
    standings.map((s) => ({ score: s.score, tiebreak: s.tiebreak }))
  ).map((r) => ({ ...standings[r.index], rank: r.rank }));

  const winner = winnerIndex === null ? null : standings[winnerIndex]?.player;
  const headline =
    title ?? (winner ? t("mpWins", { player: winner.name }) : t("mpDraw"));

  const handleQuit = () => {
    haptic.tap();
    if (onQuit) {
      onQuit();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(200)}
      style={styles.overlay}
    >
      <Animated.View
        entering={
          reduceMotion
            ? FadeIn.delay(280).duration(180)
            : ZoomIn.delay(280).duration(220)
        }
        style={[
          styles.card,
          { backgroundColor: theme.elevated, borderColor: theme.border },
        ]}
      >
        <RNView
          style={[
            styles.trophy,
            { backgroundColor: winner ? `${winner.color}33` : theme.surface },
          ]}
        >
          <Ionicons
            color={winner ? winner.color : theme.mutedText}
            name={winner ? "trophy" : "people"}
            size={30}
          />
        </RNView>
        <Text style={[styles.title, { color: theme.text }]}>{headline}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {subtitle}
          </Text>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.table}
          showsVerticalScrollIndicator={false}
          style={styles.tableScroll}
        >
          {ranked.map((row) => {
            const isWinner = row.player.index === winnerIndex;
            return (
              <RNView
                accessibilityLabel={`${cooperative ? "" : `#${row.rank} `}${row.player.name}: ${format(row.score)} ${scoreLabel}`}
                key={row.player.index}
                style={[
                  styles.row,
                  {
                    backgroundColor: isWinner
                      ? `${row.player.color}1F`
                      : theme.card,
                    borderColor: isWinner ? row.player.color : theme.border,
                  },
                ]}
              >
                {cooperative ? null : (
                  <Text style={[styles.rank, { color: theme.mutedText }]}>
                    #{row.rank}
                  </Text>
                )}
                <RNView
                  style={[styles.dot, { backgroundColor: row.player.color }]}
                />
                <RNView style={styles.nameBlock}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, { color: theme.text }]}
                  >
                    {row.player.name}
                    {row.player.isHost ? (
                      <Text style={[styles.youTag, { color: theme.mutedText }]}>
                        {"  "}
                        {t("mpYouHint")}
                      </Text>
                    ) : null}
                  </Text>
                  {row.detail ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.detail, { color: theme.mutedText }]}
                    >
                      {row.detail}
                    </Text>
                  ) : null}
                </RNView>
                <RNView style={styles.scoreBlock}>
                  <Text
                    style={[
                      styles.score,
                      { color: isWinner ? row.player.color : theme.text },
                    ]}
                  >
                    {format(row.score)}
                  </Text>
                  <Text style={[styles.scoreLabel, { color: theme.mutedText }]}>
                    {scoreLabel}
                  </Text>
                </RNView>
              </RNView>
            );
          })}
        </ScrollView>

        {progress ? (
          <RNView style={styles.hostLine}>
            {progress.isNewBest ? (
              <RNView style={[styles.newBest, { backgroundColor: theme.tint }]}>
                <Ionicons color={theme.onTint} name="sparkles" size={12} />
                <Text style={[styles.newBestText, { color: theme.onTint }]}>
                  {t("gameNewBest")}
                </Text>
              </RNView>
            ) : null}
            <Text style={[styles.hostText, { color: theme.mutedText }]}>
              {t("mpHostStats", {
                best: format(progress.best),
                streak: progress.currentStreak,
              })}
            </Text>
          </RNView>
        ) : null}

        <RNView style={styles.actions}>
          <Pressable
            accessibilityLabel={t("mpRematch")}
            accessibilityRole="button"
            onPress={() => {
              haptic.tap();
              onRematch();
            }}
            style={[styles.btnPrimary, { backgroundColor: theme.tint }]}
          >
            <Ionicons color={theme.onTint} name="refresh" size={20} />
            <Text style={[styles.btnPrimaryText, { color: theme.onTint }]}>
              {t("mpRematch")}
            </Text>
          </Pressable>
          <RNView style={styles.secondaryRow}>
            {onChangePlayers ? (
              <Pressable
                accessibilityLabel={t("mpChangePlayers")}
                accessibilityRole="button"
                onPress={() => {
                  haptic.tap();
                  onChangePlayers();
                }}
                style={[
                  styles.btnSecondary,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Ionicons color={theme.text} name="people-outline" size={18} />
                <Text style={[styles.btnSecondaryText, { color: theme.text }]}>
                  {t("mpChangePlayers")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={t("gameQuit")}
              accessibilityRole="button"
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
          </RNView>
        </RNView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: { alignSelf: "stretch", gap: Spacing.sm, marginTop: Spacing.md },
  btnPrimary: {
    alignItems: "center",
    borderRadius: Radius.button,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
  },
  btnPrimaryText: { ...TextStyle.buttonPrimary },
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
  btnSecondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  card: {
    alignItems: "center",
    borderRadius: Radius.modal,
    borderWidth: 1,
    gap: Spacing.sm,
    maxHeight: "92%",
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    width: "100%",
    ...Shadow.modal,
  },
  detail: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 1,
  },
  dot: { borderRadius: 6, height: 12, width: 12 },
  hostLine: { alignItems: "center", gap: 6, marginTop: Spacing.sm },
  hostText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold },
  nameBlock: { flex: 1 },
  newBest: {
    alignItems: "center",
    borderRadius: Radius.pill,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  newBestText: {
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
    padding: Spacing.xl,
    zIndex: 10,
  },
  rank: { fontSize: FontSize.sm, fontWeight: FontWeight.black, width: 26 },
  row: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  score: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  scoreBlock: { alignItems: "flex-end" },
  scoreLabel: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    textTransform: "uppercase",
  },
  secondaryRow: { flexDirection: "row", gap: Spacing.sm },
  subtitle: { ...TextStyle.hint, textAlign: "center" },
  table: { gap: Spacing.sm },
  tableScroll: { alignSelf: "stretch", flexGrow: 0, marginTop: Spacing.sm },
  title: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  trophy: {
    alignItems: "center",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  youTag: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
