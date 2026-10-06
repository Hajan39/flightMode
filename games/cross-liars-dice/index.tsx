import { useState } from "react";
import {
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import GameControls from "@/components/GameControls";
import {
  MatchResult,
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
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "cross-liars-dice";
const STARTING_DICE = 5;
const FACES = [1, 2, 3, 4, 5, 6] as const;
const DICE_EMOJI: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

type Phase = "setup" | "passPeek" | "peek" | "bid" | "reveal" | "done";
interface Bid {
  face: number;
  qty: number;
}

function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export default function CrossLiarsDiceGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();

  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [diceCounts, setDiceCounts] = useState<number[]>([]);
  const [allDice, setAllDice] = useState<number[][]>([]);
  const [roundNum, setRoundNum] = useState(1);
  const [currentPeeker, setCurrentPeeker] = useState(0);
  const [peekStartIndex, setPeekStartIndex] = useState(0);
  const [currentBidder, setCurrentBidder] = useState(0);
  const [currentBid, setCurrentBid] = useState<Bid | null>(null);
  const [lastBidder, setLastBidder] = useState(-1);
  const [bidQty, setBidQty] = useState(1);
  const [bidFace, setBidFace] = useState(2);
  const [revealResult, setRevealResult] = useState<{
    liar: boolean;
    total: number;
    loser: number;
  } | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

  const totalDice = diceCounts.reduce((a, b) => a + b, 0);
  const count = players.length;

  function nextActive(from: number, counts?: number[]): number {
    const dc = counts ?? diceCounts;
    let idx = from;
    for (let i = 0; i < count; i += 1) {
      idx = (idx + 1) % count;
      if (dc[idx] > 0) {
        return idx;
      }
    }
    return from;
  }

  const startMatch = (matchPlayers: MatchPlayer[]) => {
    const counts = new Array(matchPlayers.length).fill(
      STARTING_DICE
    ) as number[];
    setPlayers(matchPlayers);
    setDiceCounts(counts);
    setAllDice(counts.map((c) => rollDice(c)));
    setRoundNum(1);
    setCurrentPeeker(0);
    setPeekStartIndex(0);
    setCurrentBid(null);
    setLastBidder(-1);
    setBidQty(1);
    setBidFace(2);
    setRevealResult(null);
    setWinner(null);
    setProgress(undefined);
    setPhase("passPeek");
  };

  const peekDone = () => {
    haptic.tap();
    const next = nextActive(currentPeeker);
    if (next === peekStartIndex) {
      setCurrentBidder(peekStartIndex);
      setPhase("bid");
    } else {
      setCurrentPeeker(next);
      setPhase("passPeek");
    }
  };

  const isValidBid = (qty: number, face: number): boolean => {
    if (!currentBid) {
      return true;
    }
    if (qty > currentBid.qty) {
      return true;
    }
    return qty === currentBid.qty && face > currentBid.face;
  };

  const placeBid = () => {
    if (!isValidBid(bidQty, bidFace)) {
      haptic.error();
      return;
    }
    setCurrentBid({ face: bidFace, qty: bidQty });
    setLastBidder(currentBidder);
    setCurrentBidder(nextActive(currentBidder));
    haptic.tap();
  };

  const callLiar = () => {
    if (!currentBid || lastBidder < 0) {
      return;
    }
    const total = allDice.flat().filter((d) => d === currentBid.face).length;
    const bidWasTrue = total >= currentBid.qty;
    const loser = bidWasTrue ? currentBidder : lastBidder;
    setRevealResult({ liar: !bidWasTrue, loser, total });
    setPhase("reveal");
    if (loser === currentBidder) {
      haptic.error();
    } else {
      haptic.success();
    }
  };

  const nextRound = () => {
    if (!revealResult) {
      return;
    }
    haptic.tap();
    const { loser } = revealResult;
    const newCounts = [...diceCounts];
    newCounts[loser] -= 1;

    const alive = newCounts.filter((c) => c > 0).length;
    if (alive <= 1) {
      const winnerIdx = newCounts.findIndex((c) => c > 0);
      setDiceCounts(newCounts);
      setWinner(winnerIdx);
      setProgress(
        recordMatch(
          GAME_ID,
          newCounts.map((c) => ({ score: c })),
          { bonusIfWon: 10 }
        )
      );
      setPhase("done");
      return;
    }

    setDiceCounts(newCounts);
    setAllDice(newCounts.map((c) => (c > 0 ? rollDice(c) : [])));
    setRoundNum((r) => r + 1);
    setCurrentBid(null);
    setLastBidder(-1);
    setBidQty(1);
    setBidFace(2);
    setRevealResult(null);
    const fp = newCounts[loser] > 0 ? loser : nextActive(loser, newCounts);
    setCurrentPeeker(fp);
    setPeekStartIndex(fp);
    setPhase("passPeek");
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        minPlayers={2}
        onStart={startMatch}
        subtitle={t("ldDiceRolledHint")}
        title={t("ldTitle")}
      />
    );
  }

  const peeker = players[currentPeeker];
  const bidder = players[currentBidder];

  let bannerLabel: string | undefined;
  if (phase === "peek" || phase === "passPeek") {
    bannerLabel = `${peeker.name} · ${t("ldYourDice")}`;
  } else if (phase === "reveal" && revealResult) {
    bannerLabel = `${players[revealResult.loser].name} ${t("ldLosesDie")}`;
  }

  return (
    <View style={styles.container}>
      <RNView style={styles.topRow}>
        <TurnBanner
          compact
          label={bannerLabel}
          player={phase === "peek" || phase === "passPeek" ? peeker : bidder}
          right={
            <Text style={[styles.roundChip, { color: theme.mutedText }]}>
              {t("ldRound", { n: roundNum })}
            </Text>
          }
        />
        <GameControls onReset={() => startMatch(players)} />
      </RNView>

      <PlayerScoreStrip
        activeIndex={phase === "bid" ? currentBidder : undefined}
        format={(v) => (v > 0 ? `${v} 🎲` : "💀")}
        players={players}
        scores={diceCounts}
      />

      {phase === "peek" ? (
        <Animated.View
          entering={FadeInDown.duration(240)}
          style={styles.center}
        >
          <Text style={[styles.hint, { color: theme.mutedText }]}>
            {t("ldDiceRolledHint")}
          </Text>
          <RNView style={styles.diceRow}>
            {(allDice[currentPeeker] ?? []).map((d, i) => (
              <Animated.View
                accessibilityLabel={t("a11yDieFace", { n: d })}
                entering={ZoomIn.delay(i * 80).duration(200)}
                key={`${currentPeeker}-${roundNum}-${i}`}
                style={[
                  styles.dieBox,
                  { backgroundColor: theme.card, borderColor: peeker.color },
                ]}
              >
                <Text style={styles.dieText}>{DICE_EMOJI[d]}</Text>
              </Animated.View>
            ))}
          </RNView>
          <Pressable
            accessibilityLabel={t("passPhoneReady")}
            accessibilityRole="button"
            onPress={peekDone}
            style={[styles.primaryBtn, { backgroundColor: peeker.color }]}
          >
            <Text style={styles.primaryBtnText}>{t("passPhoneReady")}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {phase === "bid" ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          <Text style={[styles.diceInfo, { color: theme.mutedText }]}>
            {t("ldTotalDice", { total: totalDice })}
          </Text>

          <RNView style={styles.bidSection}>
            <Text style={[styles.bidLabel, { color: theme.mutedText }]}>
              {t("ldCurrentBid")}
            </Text>
            {currentBid ? (
              <Text style={styles.bidValue}>
                {currentBid.qty}× {DICE_EMOJI[currentBid.face]} ·{" "}
                {players[lastBidder]?.name}
              </Text>
            ) : (
              <Text style={[styles.bidValue, { color: theme.mutedText }]}>
                {t("ldNoBid")}
              </Text>
            )}
          </RNView>

          <RNView
            style={[
              styles.bidCard,
              { backgroundColor: theme.card, borderColor: bidder.color },
            ]}
          >
            <RNView style={styles.spinnerRow}>
              <Text style={styles.spinnerLabel}>{t("ldQuantity")}</Text>
              <Pressable
                accessibilityLabel={t("a11yDecreaseQty")}
                accessibilityRole="button"
                onPress={() => {
                  haptic.tap();
                  setBidQty((q) => Math.max(1, q - 1));
                }}
                style={[styles.spinnerBtn, { borderColor: theme.border }]}
              >
                <Text style={styles.spinnerBtnText}>−</Text>
              </Pressable>
              <Text style={styles.spinnerValue}>{bidQty}</Text>
              <Pressable
                accessibilityLabel={t("a11yIncreaseQty")}
                accessibilityRole="button"
                onPress={() => {
                  haptic.tap();
                  setBidQty((q) => Math.min(totalDice, q + 1));
                }}
                style={[styles.spinnerBtn, { borderColor: theme.border }]}
              >
                <Text style={styles.spinnerBtnText}>+</Text>
              </Pressable>
            </RNView>
            <RNView style={styles.faceRow}>
              {FACES.map((f) => (
                <Pressable
                  accessibilityLabel={t("a11yDieFace", { n: f })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: bidFace === f }}
                  key={f}
                  onPress={() => {
                    haptic.tap();
                    setBidFace(f);
                  }}
                  style={[
                    styles.faceBtn,
                    {
                      backgroundColor:
                        bidFace === f ? bidder.color : "transparent",
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={styles.faceBtnText}>{DICE_EMOJI[f]}</Text>
                </Pressable>
              ))}
            </RNView>
            <Pressable
              accessibilityLabel={t("ldPlaceBid")}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isValidBid(bidQty, bidFace) }}
              disabled={!isValidBid(bidQty, bidFace)}
              onPress={placeBid}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: bidder.color,
                  opacity: isValidBid(bidQty, bidFace) ? 1 : 0.35,
                },
              ]}
            >
              <Text style={styles.actionBtnText}>{t("ldPlaceBid")}</Text>
            </Pressable>
          </RNView>

          {currentBid && lastBidder >= 0 ? (
            <AnimatedPressable
              accessibilityLabel={t("ldLiar")}
              accessibilityRole="button"
              onPress={callLiar}
              scaleTo={0.92}
              style={[styles.liarBtn, { backgroundColor: theme.danger }]}
            >
              <Text style={styles.liarBtnText}>🤥 {t("ldLiar")}</Text>
            </AnimatedPressable>
          ) : null}
        </ScrollView>
      ) : null}

      {phase === "reveal" ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {allDice.map((dice, i) =>
            dice.length > 0 ? (
              <Animated.View
                entering={FadeInDown.delay(i * 50).duration(200)}
                key={players[i].index}
                style={styles.revealPlayerRow}
              >
                <RNView
                  style={[
                    styles.playerDot,
                    { backgroundColor: players[i].color },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.revealPlayerName, { color: players[i].color }]}
                >
                  {players[i].name}
                </Text>
                <RNView style={styles.diceRowSmall}>
                  {dice.map((d, j) => (
                    <Animated.View
                      entering={ZoomIn.delay(i * 50 + j * 30).duration(150)}
                      key={`${i}-${j}`}
                      style={[
                        styles.dieBoxSmall,
                        {
                          backgroundColor:
                            d === currentBid?.face ? theme.warning : theme.card,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={styles.dieTextSmall}>{DICE_EMOJI[d]}</Text>
                    </Animated.View>
                  ))}
                </RNView>
              </Animated.View>
            ) : null
          )}

          {currentBid && revealResult ? (
            <Animated.View
              entering={ZoomIn.duration(300)}
              style={styles.resultCard}
            >
              <Text style={styles.resultTitle}>
                {revealResult.liar ? "🤥 " : "😤 "}
                {currentBid.qty}× {DICE_EMOJI[currentBid.face]} →{" "}
                {t("ldActual")}: {revealResult.total}
              </Text>
              <Text
                style={[
                  styles.resultText,
                  { color: players[revealResult.loser].color },
                ]}
              >
                {players[revealResult.loser].name} {t("ldLosesDie")}
              </Text>
              <Pressable
                accessibilityLabel={t("ldNextRound")}
                accessibilityRole="button"
                onPress={nextRound}
                style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onTint }]}>
                  {t("ldNextRound")}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>
      ) : null}

      <PassDeviceOverlay
        hint={t("ldDiceRolledHint")}
        onReady={() => setPhase("peek")}
        readyLabel={t("ldPeek")}
        secret
        toPlayer={peeker}
        visible={phase === "passPeek"}
      />

      {phase === "done" ? (
        <MatchResult
          onChangePlayers={() => setPhase("setup")}
          onRematch={() => startMatch(players)}
          progress={progress}
          scoreLabel="🎲"
          standings={players.map((p, i) => ({
            detail: diceCounts[i] > 0 ? "🏆" : "💀",
            player: p,
            score: diceCounts[i],
          }))}
          subtitle={`${t("ldRoundsPlayed")}: ${roundNum}`}
          winnerIndex={winner}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.sm + 2,
  },
  actionBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
  bidCard: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.card,
    borderWidth: 1.5,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  bidLabel: { ...TextStyle.statLabel },
  bidSection: { alignItems: "center" },
  bidValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    marginTop: 2,
  },
  center: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.lg,
    justifyContent: "center",
  },
  container: {
    alignItems: "stretch",
    flex: 1,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  diceInfo: { ...TextStyle.hint },
  diceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  diceRowSmall: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dieBox: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 2,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  dieBoxSmall: {
    alignItems: "center",
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  dieText: { fontSize: FontSize["3xl"] },
  dieTextSmall: { fontSize: FontSize.xl },
  faceBtn: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  faceBtnText: { fontSize: FontSize["2xl"] + 2 },
  faceRow: { flexDirection: "row", gap: 6, marginVertical: 6 },
  hint: { ...TextStyle.hint, textAlign: "center" },
  liarBtn: {
    borderRadius: Radius.button,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
  },
  liarBtnText: {
    color: "#fff",
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
  },
  playerDot: { borderRadius: 5, height: 10, width: 10 },
  primaryBtn: {
    borderRadius: Radius.card,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
  },
  primaryBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
  resultCard: { alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  resultText: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  resultTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: "center",
  },
  revealPlayerName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    maxWidth: 96,
    minWidth: 64,
  },
  revealPlayerRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  roundChip: { ...TextStyle.chipLabel },
  scroll: { flex: 1 },
  scrollContent: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing["3xl"],
  },
  spinnerBtn: {
    alignItems: "center",
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  spinnerBtnText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  spinnerLabel: { ...TextStyle.hint },
  spinnerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm + 2,
  },
  spinnerValue: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.extrabold,
    minWidth: 32,
    textAlign: "center",
  },
  topRow: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
});
