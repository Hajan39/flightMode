import { useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import {
  MatchResult,
  OptionChips,
  PassDeviceOverlay,
  PlayerScoreStrip,
  PlayerSetup,
  TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import {
  actKeys,
  type ConnectorId,
  connectors,
  storyFrameKeys,
  tileDecks,
} from "@/data/emojiStoryTiles";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

import {
  ACTS,
  type Contribution,
  drawHand,
  MAX_TILES_PER_TURN,
  tallyVotes,
  turnSequence,
} from "./logic";

const GAME_ID = "emoji-story";
type Phase =
  | "setup"
  | "pass"
  | "write"
  | "passVote"
  | "vote"
  | "actEnd"
  | "readout"
  | "done";

/**
 * Turbulence Tales — pass-and-play collaborative story. Each turn a player
 * adds a connector word + 1–2 emoji tiles; after every act players secretly
 * vote for the best contribution. Emoji keep the game language-neutral.
 */
export default function EmojiStoryGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [storyOnly, setStoryOnly] = useState<"votes" | "story">("votes");
  const [frame, setFrame] = useState("");
  const [sequence, setSequence] = useState<{ act: number; author: number }[]>(
    []
  );
  const [turn, setTurn] = useState(0);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [hand, setHand] = useState<string[]>([]);
  const [selectedTiles, setSelectedTiles] = useState<string[]>([]);
  const [connector, setConnector] = useState<ConnectorId>("then");
  const [scores, setScores] = useState<number[]>([]);
  const [voter, setVoter] = useState(0);
  const [votes, setVotes] = useState<(number | null)[]>([]);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  const currentTurn = sequence[turn];
  const currentAct = currentTurn?.act ?? ACTS - 1;
  const author = players[currentTurn?.author ?? 0];
  const _usedTiles = new Set(contributions.flatMap((c) => c.tiles));

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    const travel = tileDecks.travel;
    const emoji = travel[Math.floor(Math.random() * travel.length)];
    const frameKey =
      storyFrameKeys[Math.floor(Math.random() * storyFrameKeys.length)];
    setPlayers(matchPlayers);
    setFrame(t(frameKey, { emoji }));
    setSequence(turnSequence(matchPlayers.length));
    setTurn(0);
    setContributions([]);
    setScores(new Array(matchPlayers.length).fill(0));
    setVotes(new Array(matchPlayers.length).fill(null));
    setProgress(undefined);
    setHand(drawHand(Math.random, new Set()));
    setSelectedTiles([]);
    setConnector("then");
    setPhase("pass");
  };

  const toggleTile = (tile: string) => {
    haptic.tap();
    setSelectedTiles((prev) =>
      prev.includes(tile)
        ? prev.filter((x) => x !== tile)
        : prev.length >= MAX_TILES_PER_TURN
          ? [...prev.slice(1), tile]
          : [...prev, tile]
    );
  };

  const confirmTurn = () => {
    if (!currentTurn || selectedTiles.length === 0) {
      return;
    }
    haptic.success();
    const next = [
      ...contributions,
      {
        act: currentTurn.act,
        author: currentTurn.author,
        connector,
        tiles: selectedTiles,
      },
    ];
    setContributions(next);
    setSelectedTiles([]);
    setConnector("then");
    const nextTurn = turn + 1;
    const actDone =
      nextTurn >= sequence.length || sequence[nextTurn].act !== currentTurn.act;
    if (actDone) {
      if (storyOnly === "story") {
        advanceAfterAct(nextTurn, next);
      } else {
        setVoter(0);
        setVotes(new Array(players.length).fill(null));
        setPhase("passVote");
      }
      return;
    }
    setTurn(nextTurn);
    setHand(drawHand(Math.random, new Set(next.flatMap((c) => c.tiles))));
    setPhase("pass");
  };

  const advanceAfterAct = (nextTurn: number, all: Contribution[]) => {
    if (nextTurn >= sequence.length) {
      setPhase("readout");
      return;
    }
    setTurn(nextTurn);
    setHand(drawHand(Math.random, new Set(all.flatMap((c) => c.tiles))));
    setPhase("pass");
  };

  const actContributions = contributions.filter((c) => c.act === currentAct);

  const castVote = (index: number) => {
    haptic.tap();
    const next = [...votes];
    next[voter] = index;
    setVotes(next);
    const nextVoter = voter + 1;
    if (nextVoter >= players.length) {
      const gained = tallyVotes(actContributions, next, players.length);
      setScores((prev) => prev.map((s, i) => s + gained[i]));
      setPhase("actEnd");
      return;
    }
    setVoter(nextVoter);
    setPhase("passVote");
  };

  const finish = () => {
    haptic.tap();
    if (storyOnly === "story") {
      setProgress(
        updateProgress(
          GAME_ID,
          contributions.reduce((n, c) => n + c.tiles.length, 0),
          { won: true }
        )
      );
    } else {
      setProgress(
        recordMatch(
          GAME_ID,
          scores.map((score) => ({ score }))
        )
      );
    }
    setPhase("done");
  };

  const renderStory = (compact = false) => (
    <RNView style={styles.story}>
      <Text style={[styles.frame, { color: theme.text }]}>{frame}</Text>
      {contributions.map((c, i) => (
        <RNView key={`${c.act}-${c.author}-${i}`} style={styles.storyLine}>
          <Text
            style={[styles.connectorText, { color: players[c.author].color }]}
          >
            {t(connectors.find((x) => x.id === c.connector)?.key ?? "esThen")}
          </Text>
          <Text style={compact ? styles.storyEmojiSmall : styles.storyEmoji}>
            {c.tiles.join(" ")}
          </Text>
        </RNView>
      ))}
    </RNView>
  );

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={2}
        onStart={startMatch}
        subtitle={t("esIntro")}
        title={t("gameEmojiStoryName")}
      >
        <OptionChips
          label={t("mpMatchSettings")}
          onChange={setStoryOnly}
          options={[
            {
              hint: t("esModeVotesHint"),
              label: t("esModeVotes"),
              value: "votes",
            },
            {
              hint: t("esStoryOnlyHint"),
              label: t("esStoryOnly"),
              value: "story",
            },
          ]}
          value={storyOnly}
        />
      </PlayerSetup>
    );
  }

  const actLabel = t(actKeys[Math.min(currentAct, ACTS - 1)]);

  return (
    <View style={styles.root}>
      <RNView style={styles.topRow}>
        <TurnBanner
          compact
          label={
            phase === "vote" || phase === "passVote"
              ? t("esVoteBest")
              : phase === "actEnd"
                ? t("esActDone", { act: actLabel })
                : phase === "readout"
                  ? t("esReadStory")
                  : undefined
          }
          player={
            phase === "vote" || phase === "passVote" ? players[voter] : author
          }
          right={
            <Text style={[styles.roundChip, { color: theme.mutedText }]}>
              {actLabel}
            </Text>
          }
        />
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      {storyOnly === "votes" ? (
        <PlayerScoreStrip players={players} scores={scores} />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {phase === "write" ? (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={styles.section}
          >
            <RNView
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {renderStory(true)}
            </RNView>

            <Text style={[styles.label, { color: theme.mutedText }]}>
              {t("esPickConnector")}
            </Text>
            <RNView style={styles.connectorRow}>
              {connectors.map((c) => {
                const active = c.id === connector;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={c.id}
                    onPress={() => {
                      haptic.tap();
                      setConnector(c.id);
                    }}
                    style={[
                      styles.connectorChip,
                      {
                        backgroundColor: active ? author.color : theme.card,
                        borderColor: active ? author.color : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.connectorChipText,
                        { color: active ? "#0b1620" : theme.text },
                      ]}
                    >
                      {t(c.key)}
                    </Text>
                  </Pressable>
                );
              })}
            </RNView>

            <Text style={[styles.label, { color: theme.mutedText }]}>
              {t("esPickTiles")}
            </Text>
            <RNView style={styles.hand}>
              {hand.map((tile) => {
                const selected = selectedTiles.includes(tile);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={tile}
                    onPress={() => toggleTile(tile)}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: selected
                          ? `${author.color}33`
                          : theme.elevated,
                        borderColor: selected ? author.color : theme.border,
                      },
                    ]}
                  >
                    <Text style={styles.tileEmoji}>{tile}</Text>
                  </Pressable>
                );
              })}
            </RNView>

            <Pressable
              accessibilityRole="button"
              disabled={selectedTiles.length === 0}
              onPress={confirmTurn}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: author.color,
                  opacity: selectedTiles.length === 0 ? 0.4 : 1,
                },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {t("esAddToStory")} {selectedTiles.join(" ")}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {phase === "vote" ? (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={styles.section}
          >
            <Text style={[styles.label, { color: theme.mutedText }]}>
              {t("esVoteHint")}
            </Text>
            {actContributions.map((c, i) => {
              const own = c.author === voter;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={own}
                  key={`${c.author}-${i}`}
                  onPress={() => castVote(i)}
                  style={[
                    styles.voteCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      opacity: own ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.connectorText, { color: theme.mutedText }]}
                  >
                    {t(
                      connectors.find((x) => x.id === c.connector)?.key ??
                        "esThen"
                    )}
                  </Text>
                  <Text style={styles.storyEmoji}>{c.tiles.join(" ")}</Text>
                  {own ? (
                    <Text style={[styles.ownTag, { color: theme.mutedText }]}>
                      {t("esYours")}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {phase === "actEnd" ? (
          <Animated.View entering={ZoomIn.duration(220)} style={styles.section}>
            <RNView
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {renderStory(true)}
            </RNView>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptic.tap();
                advanceAfterAct(turn + 1, contributions);
              }}
              style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onTint }]}>
                {turn + 1 >= sequence.length
                  ? t("esReadStory")
                  : t("hmNextRound")}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {phase === "readout" ? (
          <Animated.View
            entering={FadeInDown.duration(240)}
            style={styles.section}
          >
            <RNView
              style={[
                styles.card,
                styles.readoutCard,
                { backgroundColor: theme.card, borderColor: theme.tint },
              ]}
            >
              <Text style={[styles.readoutTitle, { color: theme.tint }]}>
                📖 {t("esReadStory")}
              </Text>
              {renderStory(false)}
            </RNView>
            <Pressable
              accessibilityRole="button"
              onPress={finish}
              style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onTint }]}>
                {t("hmSeeResult")}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>

      <PassDeviceOverlay
        hint={t("esYourTurn", { act: actLabel })}
        onReady={() => setPhase("write")}
        toPlayer={author}
        visible={phase === "pass"}
      />
      <PassDeviceOverlay
        hint={t("esVoteBest")}
        onReady={() => setPhase("vote")}
        secret
        toPlayer={players[voter]}
        visible={phase === "passVote"}
      />

      {phase === "done" ? (
        <MatchResult
          cooperative={storyOnly === "story"}
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel={storyOnly === "story" ? t("esTiles") : t("esVotes")}
          standings={players.map((p, i) => ({
            player: p,
            score:
              storyOnly === "story"
                ? contributions
                    .filter((c) => c.author === i)
                    .reduce((n, c) => n + c.tiles.length, 0)
                : scores[i],
          }))}
          title={storyOnly === "story" ? t("esStoryComplete") : undefined}
          winnerIndex={
            storyOnly === "story"
              ? null
              : getSoleWinnerIndex(scores.map((score) => ({ score })))
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: Spacing["3xl"] },
  card: { borderRadius: Radius.panel, borderWidth: 1, padding: Spacing.lg },
  connectorChip: {
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  connectorChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  connectorRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  connectorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  frame: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: 22,
  },
  hand: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  label: { ...TextStyle.statLabel, marginTop: Spacing.xs },
  ownTag: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  primaryBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.md + 2,
  },
  primaryBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
  readoutCard: { borderWidth: 2 },
  readoutTitle: { ...TextStyle.cardTitle, marginBottom: Spacing.sm },
  root: {
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  roundChip: { ...TextStyle.chipLabel },
  section: { gap: Spacing.sm },
  story: { gap: Spacing.sm },
  storyEmoji: { fontSize: FontSize["3xl"], lineHeight: 36 },
  storyEmojiSmall: { fontSize: FontSize.xl, lineHeight: 26 },
  storyLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tile: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 2,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  tileEmoji: { fontSize: 34 },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  voteCard: {
    borderRadius: Radius.card,
    borderWidth: 1.5,
    gap: 4,
    padding: Spacing.md,
  },
});
