import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  View as RNView,
  StyleSheet,
} from "react-native";

import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  type Board,
  deal,
  extent,
  FACES,
  finalScore,
  findPairs,
  isFree,
  LAYOUT_IDS,
  LAYOUTS,
  type LayoutId,
  removePair,
  shuffleBoard,
} from "./logic";

type Phase = "menu" | "playing" | "won";

interface Clock {
  pausedAt: number | null;
  pausedMs: number;
  start: number;
}

const LAYOUT_NAME_KEY: Record<LayoutId, TranslationKey> = {
  easy: "mjLayoutEasy",
  jet: "mjLayoutJet",
  turtle: "mjLayoutTurtle",
};

/** Tile height / width, and the 3-D edge as a share of the width. */
const TILE_ASPECT = 1.25;
const EDGE = 0.13;
const MAX_TILE_W = 56;

const FACE_IVORY = "#FFF9EC";
const SIDE_COLOR = "#B89B6A";
const SIDE_DARK = "#7A6440";
const HINT_RING = "#22C55E";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function MahjongGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const router = useRouter();
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("menu");
  const [layoutId, setLayoutId] = useState<LayoutId>("easy");
  const [board, setBoard] = useState<Board>([]);
  const [history, setHistory] = useState<Board[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [hints, setHints] = useState(0);
  const [shuffles, setShuffles] = useState(0);
  const [clock, setClock] = useState<Clock>({
    pausedAt: null,
    pausedMs: 0,
    start: 0,
  });
  const [now, setNow] = useState(0);
  const [paused, setPaused] = useState(false);
  const [area, setArea] = useState<{ h: number; w: number } | null>(null);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);
  const [final, setFinal] = useState({ score: 0, seconds: 0 });

  const elapsedSec = (at: number) =>
    Math.max(
      0,
      Math.floor(((clock.pausedAt ?? at) - clock.start - clock.pausedMs) / 1000)
    );

  // Wall-clock display tick (the value itself always comes from Date.now()).
  useEffect(() => {
    if (phase !== "playing" || paused) {
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  const startGame = (id: LayoutId) => {
    setLayoutId(id);
    setBoard(deal(LAYOUTS[id], Math.random).board);
    setHistory([]);
    setSelected(null);
    setHint(null);
    setHints(0);
    setShuffles(0);
    const start = Date.now();
    setClock({ pausedAt: null, pausedMs: 0, start });
    setNow(start);
    setPaused(false);
    setResult(null);
    setPhase("playing");
  };

  /** Restarting or quitting mid-game counts as a loss once a pair is gone. */
  const resign = () => {
    if (phase === "playing" && board.length < LAYOUTS[layoutId].length) {
      updateProgress("mahjong", 0, { won: false });
    }
  };

  const pause = () => {
    setPaused(true);
    setClock((c) => (c.pausedAt ? c : { ...c, pausedAt: Date.now() }));
  };
  const resume = () => {
    setPaused(false);
    setClock((c) =>
      c.pausedAt
        ? {
            ...c,
            pausedAt: null,
            pausedMs: c.pausedMs + Date.now() - c.pausedAt,
          }
        : c
    );
  };

  const pairs = findPairs(board);
  const freeIds = new Set(
    board.filter((tile) => isFree(board, tile)).map((tile) => tile.id)
  );
  const stuck = phase === "playing" && board.length > 0 && pairs.length === 0;

  const commitBoard = (next: Board) => {
    setHistory((h) => [...h, board]);
    setBoard(next);
    setSelected(null);
    setHint(null);
  };

  const onTilePress = (id: number) => {
    if (phase !== "playing" || paused) {
      return;
    }
    if (!freeIds.has(id)) {
      haptic.error();
      return;
    }
    if (selected === null || selected === id) {
      haptic.tap();
      setSelected(selected === id ? null : id);
      return;
    }
    const a = board.find((tile) => tile.id === selected);
    const b = board.find((tile) => tile.id === id);
    if (!(a && b) || a.face !== b.face) {
      haptic.tap();
      setSelected(id);
      return;
    }
    const next = removePair(board, a.id, b.id);
    commitBoard(next);
    if (next.length > 0) {
      haptic.tap();
      return;
    }
    const seconds = elapsedSec(Date.now());
    const score = finalScore(
      LAYOUTS[layoutId].length,
      seconds,
      hints,
      shuffles
    );
    setFinal({ score, seconds });
    setResult(updateProgress("mahjong", score, { won: true }));
    haptic.success();
    setPhase("won");
  };

  const onHint = () => {
    const [first] = pairs;
    if (!first) {
      haptic.error();
      return;
    }
    haptic.tap();
    setHint(first);
    setSelected(null);
    setHints((n) => n + 1);
  };

  const onShuffle = () => {
    haptic.tap();
    commitBoard(shuffleBoard(board, Math.random));
    setShuffles((n) => n + 1);
  };

  const onUndo = () => {
    const prev = history.at(-1);
    if (!prev) {
      return;
    }
    haptic.tap();
    setHistory((h) => h.slice(0, -1));
    setBoard(prev);
    setSelected(null);
    setHint(null);
  };

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ h: height, w: width });
  };

  /* ---------------------------------------------------------------- menu */

  if (phase === "menu") {
    return (
      <View style={[styles.menu, { backgroundColor: theme.background }]}>
        <Text style={styles.menuTitle}>{t("gameMahjongName")}</Text>
        <Text style={styles.menuFaces}>
          {FACES.slice(0, 6)
            .map((f) => f.emoji)
            .join(" ")}
        </Text>
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("mjChooseLayout")}
        </Text>
        {LAYOUT_IDS.map((id) => (
          <Pressable
            accessibilityRole="button"
            key={id}
            onPress={() => {
              haptic.tap();
              startGame(id);
            }}
            style={[
              styles.modeBtn,
              id === layoutId
                ? { backgroundColor: theme.tint, borderColor: theme.tint }
                : { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.modeTitle,
                { color: id === layoutId ? theme.onTint : theme.text },
              ]}
            >
              {t(LAYOUT_NAME_KEY[id])}
            </Text>
            <Text
              style={[
                styles.modeDesc,
                { color: id === layoutId ? theme.onTint : theme.mutedText },
              ]}
            >
              {t("mjTiles", { count: LAYOUTS[id].length })}
            </Text>
          </Pressable>
        ))}
        <Text style={[styles.menuHint, { color: theme.mutedText }]}>
          {t("mjHowTo")}
        </Text>
      </View>
    );
  }

  /* --------------------------------------------------------------- board */

  // Fit the whole layout (plus its 3-D edges) into the measured area.
  const box = extent(LAYOUTS[layoutId]);
  const tileW = area
    ? Math.min(
        MAX_TILE_W,
        area.w / (box.maxX / 2 + (box.maxZ + 1) * EDGE),
        area.h / ((box.maxY / 2) * TILE_ASPECT + (box.maxZ + 1) * EDGE)
      )
    : 0;
  const tileH = tileW * TILE_ASPECT;
  const edge = Math.max(2, Math.round(tileW * EDGE));
  const boardW = (box.maxX / 2) * tileW + (box.maxZ + 1) * edge;
  const boardH = (box.maxY / 2) * tileH + (box.maxZ + 1) * edge;
  const hintIds = new Set(hint ?? []);

  const stat = (label: string, value: string) => (
    <RNView
      style={[
        styles.statBox,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.mutedText }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </RNView>
  );

  const action = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    opts: { disabled?: boolean; highlight?: boolean } = {}
  ) => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!opts.disabled }}
      disabled={opts.disabled}
      onPress={onPress}
      style={[
        styles.actionBtn,
        opts.highlight
          ? { backgroundColor: theme.tint, borderColor: theme.tint }
          : { backgroundColor: theme.card, borderColor: theme.border },
        { opacity: opts.disabled ? 0.4 : 1 },
      ]}
    >
      <Ionicons
        color={opts.highlight ? theme.onTint : theme.text}
        name={icon}
        size={18}
      />
      <Text
        style={[
          styles.actionText,
          { color: opts.highlight ? theme.onTint : theme.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RNView style={styles.topBar}>
        <RNView style={styles.statsRow}>
          {stat(t("mjTime"), formatTime(elapsedSec(now)))}
          {stat(t("mjPairsLeft"), String(board.length / 2))}
          {stat(t("mjMatches"), String(pairs.length))}
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={() => (paused ? resume() : pause())}
          onReset={() => {
            resign();
            startGame(layoutId);
          }}
        />
      </RNView>

      <RNView onLayout={onAreaLayout} style={styles.area}>
        {area && tileW > 0 ? (
          <RNView style={{ height: boardH, width: boardW }}>
            {board.map((tile) => {
              const free = freeIds.has(tile.id);
              const isSelected = selected === tile.id;
              const isHint = hintIds.has(tile.id);
              const look = FACES[tile.face];
              // Higher layers shift up-left so the edges below stay visible.
              const lift = (box.maxZ - tile.z) * edge;
              return (
                <Pressable
                  accessibilityLabel={look.emoji}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !free,
                    selected: isSelected,
                  }}
                  key={tile.id}
                  onPress={() => onTilePress(tile.id)}
                  style={[
                    styles.tile,
                    {
                      height: tileH,
                      left: (tile.x / 2) * tileW + lift,
                      top: (tile.y / 2) * tileH + lift,
                      width: tileW,
                    },
                  ]}
                >
                  <RNView
                    style={[
                      styles.side,
                      {
                        backgroundColor: SIDE_COLOR,
                        borderColor: SIDE_DARK,
                        height: tileH - edge,
                        left: edge,
                        top: edge,
                        width: tileW - edge,
                      },
                    ]}
                  />
                  <RNView
                    style={[
                      styles.face,
                      {
                        backgroundColor: isSelected ? "#FFE8A3" : FACE_IVORY,
                        borderColor:
                          (isSelected && theme.tint) ||
                          (isHint && HINT_RING) ||
                          look.color,
                        borderWidth: isSelected || isHint ? 3 : 1.5,
                        height: tileH - edge,
                        width: tileW - edge,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: tileW * 0.52 }}>{look.emoji}</Text>
                    <RNView
                      style={[styles.stripe, { backgroundColor: look.color }]}
                    />
                    {free ? null : <RNView style={styles.dim} />}
                  </RNView>
                </Pressable>
              );
            })}
          </RNView>
        ) : null}
      </RNView>

      <Text
        style={[
          styles.footHint,
          { color: stuck ? theme.tint : theme.mutedText },
        ]}
      >
        {stuck ? t("mjNoMoves") : t("mjHowTo")}
      </Text>

      <RNView style={styles.actions}>
        {action("arrow-undo", t("mjUndo"), onUndo, {
          disabled: history.length === 0,
        })}
        {action("bulb-outline", t("mjHint"), onHint, {
          disabled: stuck,
        })}
        {action("shuffle", t("mjShuffle"), onShuffle, {
          highlight: stuck,
        })}
      </RNView>

      <GamePauseOverlay
        onQuit={() => {
          resign();
          if (router.canGoBack()) {
            router.back();
          }
        }}
        onRestart={() => {
          resign();
          startGame(layoutId);
        }}
        onResume={resume}
        visible={paused}
      />

      {phase === "won" && result ? (
        <GameResult
          best={result.best}
          isNewBest={result.isNewBest}
          last={result.last === final.score ? undefined : result.last}
          onPlayAgain={() => setPhase("menu")}
          score={final.score}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          subtitle={t("mjResultSubtitle", {
            hints,
            shuffles,
            time: formatTime(final.seconds),
          })}
          title={t("mjYouWin")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  area: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  container: {
    flex: 1,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(30,24,12,0.32)",
  },
  face: {
    alignItems: "center",
    borderRadius: 5,
    justifyContent: "center",
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
  },
  footHint: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  menu: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  menuFaces: {
    fontSize: FontSize.xl,
  },
  menuHint: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  menuTitle: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.black,
  },
  modeBtn: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: Radius.button,
    borderWidth: 1,
    gap: 2,
    paddingVertical: Spacing.md,
  },
  modeDesc: {
    fontSize: FontSize.sm,
  },
  modeTitle: {
    ...TextStyle.buttonSecondary,
  },
  side: {
    borderBottomWidth: 1,
    borderRadius: 5,
    borderRightWidth: 1,
    position: "absolute",
  },
  statBox: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statLabel: {
    ...TextStyle.statLabel,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
  },
  stripe: {
    bottom: 0,
    height: 3,
    left: 0,
    position: "absolute",
    right: 0,
  },
  tile: {
    position: "absolute",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
