import { useState } from "react";
import {
Dimensions,
Pressable,
StyleSheet,
View as RNView,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";
import { pickWord, type Difficulty } from "./words";
import type { TranslationKey } from "@/i18n/translations";

const MAX_WRONG = 6;
const TOTAL_ROUNDS = 8;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const KEY_ROWS = [ALPHABET.slice(0, 9), ALPHABET.slice(9, 18), ALPHABET.slice(18, 26)];
const MAX_PLAYERS = 6;

const PLAYER_COLORS = ["#ef5350", "#ffd54f", "#4FC3F7", "#81C784", "#CE93D8", "#FF8A65"];

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIFF_LABELS: Record<Difficulty, TranslationKey> = {
easy: "hmDiffEasy",
medium: "hmDiffMedium",
hard: "hmDiffHard",
};
const DIFF_HINTS: Record<Difficulty, TranslationKey> = {
easy: "hmDiffEasyHint",
medium: "hmDiffMediumHint",
hard: "hmDiffHardHint",
};
const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

function getRoundDifficulty(base: Difficulty, round: number): Difficulty {
const baseIndex = DIFFICULTY_ORDER.indexOf(base);
const ramp = Math.floor((round - 1) / 3);
return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, baseIndex + ramp)];
}

/* Hangman figure parts */
const PARTS: ((color: string) => React.ReactNode)[] = [
(c) => (<RNView key="head" style={{ position: "absolute", top: 30, left: 44, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, borderColor: c }} />),
(c) => (<RNView key="body" style={{ position: "absolute", top: 54, left: 55, width: 2.5, height: 30, backgroundColor: c }} />),
(c) => (<RNView key="larm" style={{ position: "absolute", top: 60, left: 40, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "30deg" }] }} />),
(c) => (<RNView key="rarm" style={{ position: "absolute", top: 60, left: 57, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "-30deg" }] }} />),
(c) => (<RNView key="lleg" style={{ position: "absolute", top: 82, left: 42, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "-30deg" }] }} />),
(c) => (<RNView key="rleg" style={{ position: "absolute", top: 82, left: 54, width: 16, height: 2.5, backgroundColor: c, transform: [{ rotate: "30deg" }] }} />),
];

export default function DuelHangmanGame() {
const colorScheme = useColorScheme();
const theme = Colors[colorScheme];
const updateProgress = useGameStore((s) => s.updateProgress);
const { t, language } = useTranslation();
const haptic = useHaptic();

/* setup */
const [playerCount, setPlayerCount] = useState(2);
const [difficulty, setDifficulty] = useState<Difficulty>("medium");
const [phase, setPhase] = useState<"setup" | "handoff" | "playing" | "result">("setup");

/* game */
const [word, setWord] = useState("");
const [guessed, setGuessed] = useState<Set<string>>(new Set());
const [scores, setScores] = useState<number[]>([]);
const [round, setRound] = useState(1);
const [guesser, setGuesser] = useState(0); // 0-indexed

const wrongCount = word ? [...guessed].filter((l) => !word.includes(l)).length : 0;
const isWon = word ? word.split("").every((l) => guessed.has(l)) : false;
const isLost = wrongCount >= MAX_WRONG;
const gameOver = isWon || isLost;
const currentRoundDifficulty = getRoundDifficulty(difficulty, round);
const guesserColor = PLAYER_COLORS[guesser % PLAYER_COLORS.length];

const startGame = (d: Difficulty) => {
setDifficulty(d);
setScores(Array(playerCount).fill(0));
setRound(1);
setGuesser(0);
setGuessed(new Set());
setPhase("handoff");
};

const startRound = () => {
const diff = getRoundDifficulty(difficulty, round);
setWord(pickWord(language, diff));
setGuessed(new Set());
setPhase("playing");
};

const handleGuess = (letter: string) => {
if (gameOver || guessed.has(letter)) return;
const next = new Set(guessed);
next.add(letter);
setGuessed(next);

if (word.includes(letter)) {
haptic.success();
} else {
haptic.error();
}

const won = word.split("").every((l) => next.has(l));
const lost = [...next].filter((l) => !word.includes(l)).length >= MAX_WRONG;

if (won) {
setScores((prev) => {
const next = [...prev];
next[guesser] += 10;
return next;
});
} else if (lost) {
/* others each get 5 points */
setScores((prev) =>
prev.map((s, i) => (i === guesser ? s : s + 5)),
);
}
};

const nextRound = () => {
if (round >= TOTAL_ROUNDS) {
updateProgress("duel-hangman", Math.max(...scores));
setPhase("result");
return;
}
setRound((r) => r + 1);
setGuesser((g) => (g + 1) % playerCount);
setGuessed(new Set());
setPhase("handoff");
};

/* �� SETUP �� */
if (phase === "setup") {
return (
<View style={styles.root}>
<Text style={styles.title}>{t("gameDuelHangmanName")}</Text>
<Text style={[styles.subtitle, { color: theme.mutedText }]}>
{t("mpSelectPlayers")}
</Text>
<RNView style={styles.countRow}>
{Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
<Pressable
key={n}
style={[
styles.countBtn,
{
backgroundColor: playerCount === n ? theme.tint : theme.card,
borderColor: playerCount === n ? theme.tint : theme.border,
},
]}
onPress={() => setPlayerCount(n)}
>
<Text style={[styles.countBtnText, { color: playerCount === n ? "#fff" : theme.text }]}>
{n}
</Text>
</Pressable>
))}
</RNView>
<Text style={[styles.diffHint, { color: theme.mutedText }]}>
{t("hmPickDifficulty")}
</Text>
<RNView style={styles.diffRow}>
{DIFFICULTIES.map((d) => (
<Pressable
key={d}
onPress={() => startGame(d)}
style={[styles.diffBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
>
<Text style={styles.diffEmoji}>
{d === "easy" ? "\u2708\uFE0F" : d === "medium" ? "\uD83D\uDEE9\uFE0F" : "\uD83D\uDE80"}
</Text>
<Text style={[styles.diffLabel, { color: theme.text }]}>{t(DIFF_LABELS[d])}</Text>
<Text style={[styles.diffMeta, { color: theme.mutedText }]}>{t(DIFF_HINTS[d])}</Text>
</Pressable>
))}
</RNView>
</View>
);
}

/* �� HANDOFF �� */
if (phase === "handoff") {
return (
<View style={styles.root}>
<Text style={{ fontSize: 48, marginBottom: 16 }}>{"\uD83D\uDD04"}</Text>
<Text style={styles.title}>{t("passPhone")}</Text>
<Text style={[styles.guesserHint, { color: guesserColor, fontSize: 18, marginTop: 8 }]}>
{t("hmPassToGuesser", { player: String(guesser + 1) })}
</Text>
<Text style={[styles.diffHint, { color: theme.mutedText, marginTop: 8 }]}>
{t("hmPassToGuesserHint")}
</Text>
<Pressable
style={[styles.btn, { backgroundColor: guesserColor, marginTop: 32 }]}
onPress={startRound}
>
<Text style={styles.btnText}>{t("passPhoneReady")}</Text>
</Pressable>
</View>
);
}

/* �� RESULT �� */
if (phase === "result") {
const maxScore = Math.max(...scores);
const winners = scores.map((s, i) => (s === maxScore ? i : -1)).filter((i) => i >= 0);
const winnerName = winners.length === 1
? t("dicePlayerWins", { player: String(winners[0] + 1) })
: t("diceDraw");
return (
<View style={styles.root}>
<Text style={styles.title}>{winnerName}</Text>
<RNView style={styles.finalTable}>
{scores.map((s, i) => (
<RNView key={i} style={[styles.finalTableRow, { borderColor: theme.border + "44" }]}>
<RNView style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[i] }]} />
<Text style={[styles.finalName, { color: theme.text }]}>
{t("mpPlayerN", { n: i + 1 })}
</Text>
<Text style={[styles.finalNum, { color: PLAYER_COLORS[i] }]}>{s}</Text>
</RNView>
))}
</RNView>
<Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => setPhase("setup")}>
<Text style={styles.btnText}>{t("playAgain")}</Text>
</Pressable>
</View>
);
}

/* �� PLAYING �� */
const figureColor = colorScheme === "dark" ? "#fff" : "#1a1a2e";

return (
<View style={styles.root}>
{/* HUD */}
<RNView style={styles.hud}>
<RNView style={styles.hudScores}>
{scores.map((s, i) => (
<RNView key={i} style={[styles.hudChip, i === guesser && { borderColor: PLAYER_COLORS[i], borderWidth: 1.5 }]}>
<RNView style={[styles.hudDot, { backgroundColor: PLAYER_COLORS[i] }]} />
<Text style={[styles.hudNum, { color: PLAYER_COLORS[i] }]}>{s}</Text>
</RNView>
))}
</RNView>
<RNView style={styles.hudCenter}>
<Text style={[styles.roundText, { color: theme.mutedText }]}>
{t("hmRound", { round, total: TOTAL_ROUNDS })}
</Text>
<Text style={[styles.guesserHint, { color: guesserColor }]}>
{t("hmGuesser", { player: String(guesser + 1) })}
</Text>
</RNView>
</RNView>

{/* Gallows */}
<RNView style={styles.gallowsBox}>
<RNView style={[styles.gallowBase, { backgroundColor: figureColor }]} />
<RNView style={[styles.gallowPole, { backgroundColor: figureColor }]} />
<RNView style={[styles.gallowTop, { backgroundColor: figureColor }]} />
<RNView style={[styles.gallowRope, { backgroundColor: figureColor }]} />
{PARTS.slice(0, wrongCount).map((fn) => fn(figureColor))}
</RNView>

{/* Word */}
<RNView style={styles.wordRow}>
{word.split("").map((letter, i) => {
const screenW = Dimensions.get("window").width - 32;
const gap = word.length > 10 ? 4 : 8;
const slotW = Math.min(32, (screenW - (word.length - 1) * gap) / word.length);
const fontSize = slotW > 24 ? 24 : Math.max(14, slotW - 4);
return (
<RNView
key={`w-${i}`}
style={[styles.letterSlot, { width: slotW, marginHorizontal: gap / 2, borderBottomColor: gameOver ? (isWon ? "#66bb6a" : "#ef5350") : guesserColor }]}
>
<Text style={[styles.letterChar, { fontSize, color: guessed.has(letter) ? theme.text : gameOver ? "#ef5350" : "transparent" }]}>
{guessed.has(letter) || gameOver ? letter : "_"}
</Text>
</RNView>
);
})}
</RNView>

<Text style={[styles.wrongHint, { color: theme.mutedText }]}>
{t("hmWrongCount", { count: wrongCount, max: MAX_WRONG })}
</Text>

{!gameOver ? (
<RNView style={styles.keyboard}>
{KEY_ROWS.map((row, ri) => (
<RNView key={`kr-${ri}`} style={styles.keyRow}>
{row.map((letter) => {
const used = guessed.has(letter);
const correct = used && word.includes(letter);
const wrong = used && !word.includes(letter);
return (
<Pressable
key={letter}
style={[styles.key, { backgroundColor: correct ? "#66bb6a" : wrong ? "#ef5350" : theme.elevated, opacity: used ? 0.5 : 1 }]}
onPress={() => handleGuess(letter)}
disabled={used}
>
<Text style={[styles.keyText, { color: used ? "#fff" : theme.text }]}>{letter}</Text>
</Pressable>
);
})}
</RNView>
))}
</RNView>
) : (
<RNView style={styles.gameOverRow}>
<Text style={[styles.gameOverText, { color: isWon ? "#66bb6a" : "#ef5350" }]}>
{isWon ? t("hmCorrect") : t("hmFailed", { word })}
</Text>
<Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={nextRound}>
<Text style={styles.btnText}>
{round >= TOTAL_ROUNDS ? t("hmSeeResult") : t("hmNextRound")}
</Text>
</Pressable>
</RNView>
)}
</View>
);
}

const styles = StyleSheet.create({
root: { flex: 1, alignItems: "center", padding: 16, paddingTop: 8 },
title: { fontSize: 24, fontWeight: "900", marginBottom: 8 },
subtitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
countRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
countBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
countBtnText: { fontSize: 20, fontWeight: "800" },
hud: { width: "100%", alignItems: "center", marginBottom: 4, gap: 4 },
hudScores: { flexDirection: "row", gap: 8, justifyContent: "center" },
hudChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
hudDot: { width: 8, height: 8, borderRadius: 4 },
hudNum: { fontSize: 18, fontWeight: "900" },
hudCenter: { alignItems: "center" },
roundText: { fontSize: 11, fontWeight: "700" },
guesserHint: { fontSize: 13, fontWeight: "800" },
gallowsBox: { width: 112, height: 120, position: "relative", marginBottom: 8 },
gallowBase: { position: "absolute", bottom: 0, left: 10, width: 60, height: 3, borderRadius: 1.5 },
gallowPole: { position: "absolute", bottom: 0, left: 25, width: 3, height: 110, borderRadius: 1.5 },
gallowTop: { position: "absolute", top: 0, left: 25, width: 33, height: 3, borderRadius: 1.5 },
gallowRope: { position: "absolute", top: 3, left: 55, width: 2.5, height: 27, borderRadius: 1 },
wordRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 8 },
letterSlot: { height: 40, alignItems: "center", justifyContent: "flex-end", borderBottomWidth: 3 },
letterChar: { fontWeight: "900" },
wrongHint: { fontSize: 12, fontWeight: "600", marginBottom: 10 },
keyboard: { gap: 6, width: "100%" },
keyRow: { flexDirection: "row", gap: 4, justifyContent: "center" },
key: { width: 34, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
keyText: { fontSize: 15, fontWeight: "700" },
gameOverRow: { alignItems: "center", gap: 12, marginTop: 8 },
gameOverText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
btn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
playerDot: { width: 10, height: 10, borderRadius: 5 },
finalTable: { width: "100%", gap: 6, marginBottom: 16 },
finalTableRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
finalName: { fontSize: 16, fontWeight: "700", flex: 1 },
finalNum: { fontSize: 24, fontWeight: "900" },
diffHint: { fontSize: 14, textAlign: "center", marginBottom: 16 },
diffRow: { flexDirection: "row", gap: 12, marginTop: 4 },
diffBtn: { flex: 1, alignItems: "center", gap: 6, padding: 14, borderWidth: 1, borderRadius: 14 },
diffEmoji: { fontSize: 28 },
diffLabel: { fontSize: 15, fontWeight: "800" },
diffMeta: { fontSize: 11, textAlign: "center" },
});
