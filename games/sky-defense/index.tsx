import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { baseScheme } from "@/components/colorSchemes";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

/* ================================================================
   CONSTANTS & TYPES
   ================================================================ */

const TICK = 33; // ~30 fps
const CELL = 40; // grid cell size
const COLS = 9;
const ROWS = 14;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;

interface Pt {
  x: number;
  y: number;
}

/** Path waypoints in grid coords (col, row) — enemies walk along these */
const PATH_GRID: Pt[] = [
  { x: 0, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 3 },
  { x: 7, y: 3 },
  { x: 7, y: 5 },
  { x: 1, y: 5 },
  { x: 1, y: 7 },
  { x: 6, y: 7 },
  { x: 6, y: 9 },
  { x: 2, y: 9 },
  { x: 2, y: 11 },
  { x: 8, y: 11 },
  { x: 8, y: 13 },
];

/** Convert grid coord to pixel center */
const g2p = (g: Pt): Pt => ({
  x: g.x * CELL + CELL / 2,
  y: g.y * CELL + CELL / 2,
});

/** Path as pixel coords */
const PATH_PX = PATH_GRID.map(g2p);
/** Final waypoint (the runway enemies try to reach) */
const PATH_END_PX: Pt = PATH_PX.at(-1) ?? { x: 0, y: 0 };

/** All grid cells that are on the path (for blocking tower placement) */
function getPathCells(): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < PATH_GRID.length - 1; i += 1) {
    const a = PATH_GRID[i];
    const b = PATH_GRID[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let cx = a.x,
      cy = a.y;
    while (cx !== b.x || cy !== b.y) {
      set.add(`${cx},${cy}`);
      cx += dx;
      cy += dy;
    }
  }
  const lastCell = PATH_GRID.at(-1);
  if (lastCell) {
    set.add(`${lastCell.x},${lastCell.y}`);
  }
  return set;
}
const PATH_CELLS = getPathCells();

/* ---------- tower definitions ---------- */
type TowerKind = "radar" | "sam" | "wind" | "bolt";

interface TowerDef {
  color: string;
  cost: number;
  damage: number;
  emoji: string;
  fireRate: number; // ticks between shots
  key: TowerKind;
  label: string;
  range: number; // px
}

const TOWER_DEFS: TowerDef[] = [
  {
    color: "#4fc3f7",
    cost: 15,
    damage: 8,
    emoji: "📡",
    fireRate: 18,
    key: "radar",
    label: "Radar",
    range: 90,
  },
  {
    color: "#ef5350",
    cost: 30,
    damage: 25,
    emoji: "🚀",
    fireRate: 30,
    key: "sam",
    label: "SAM",
    range: 120,
  },
  {
    color: "#66bb6a",
    cost: 20,
    damage: 5,
    emoji: "🌀",
    fireRate: 12,
    key: "wind",
    label: "Wind",
    range: 80,
  },
  {
    color: "#ffd54f",
    cost: 40,
    damage: 40,
    emoji: "⚡",
    fireRate: 40,
    key: "bolt",
    label: "Bolt",
    range: 140,
  },
];

const tdByKey = Object.fromEntries(TOWER_DEFS.map((d) => [d.key, d]));

/* ---------- enemy definitions ---------- */
type EnemyKind = "cloud" | "storm" | "hail" | "tornado";

interface EnemyDef {
  emoji: string;
  hp: number;
  key: EnemyKind;
  reward: number;
  size: number;
  speed: number; // px per tick
}

const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  cloud: { emoji: "☁️", hp: 30, key: "cloud", reward: 5, size: 22, speed: 0.8 },
  hail: { emoji: "🌨️", hp: 100, key: "hail", reward: 15, size: 28, speed: 0.5 },
  storm: { emoji: "⛈️", hp: 60, key: "storm", reward: 10, size: 26, speed: 0.6 },
  tornado: {
    emoji: "🌪️",
    hp: 200,
    key: "tornado",
    reward: 30,
    size: 32,
    speed: 0.4,
  },
};

/* ---------- wave definitions ---------- */
interface WaveEntry {
  count: number;
  interval: number; // ticks between spawns in this group
  kind: EnemyKind;
}
type Wave = WaveEntry[];

const BASE_WAVES: Wave[] = [
  [{ count: 6, interval: 20, kind: "cloud" }],
  [
    { count: 8, interval: 18, kind: "cloud" },
    { count: 2, interval: 25, kind: "storm" },
  ],
  [
    { count: 6, interval: 20, kind: "storm" },
    { count: 4, interval: 15, kind: "cloud" },
  ],
  [
    { count: 4, interval: 22, kind: "hail" },
    { count: 4, interval: 18, kind: "storm" },
  ],
  [
    { count: 6, interval: 18, kind: "hail" },
    { count: 6, interval: 12, kind: "cloud" },
  ],
  [
    { count: 2, interval: 40, kind: "tornado" },
    { count: 5, interval: 18, kind: "hail" },
  ],
  [
    { count: 3, interval: 35, kind: "tornado" },
    { count: 8, interval: 14, kind: "storm" },
  ],
  [
    { count: 5, interval: 25, kind: "tornado" },
    { count: 6, interval: 16, kind: "hail" },
    { count: 10, interval: 10, kind: "storm" },
  ],
];

const EXTRA_WAVES: Wave[] = [
  [
    { count: 6, interval: 20, kind: "tornado" },
    { count: 8, interval: 12, kind: "hail" },
  ],
  [
    { count: 8, interval: 16, kind: "tornado" },
    { count: 12, interval: 8, kind: "storm" },
  ],
  [
    { count: 10, interval: 14, kind: "tornado" },
    { count: 10, interval: 10, kind: "hail" },
    { count: 15, interval: 6, kind: "cloud" },
  ],
  [
    { count: 12, interval: 12, kind: "tornado" },
    { count: 12, interval: 8, kind: "hail" },
    { count: 15, interval: 6, kind: "storm" },
  ],
  [
    { count: 14, interval: 10, kind: "tornado" },
    { count: 14, interval: 8, kind: "hail" },
    { count: 18, interval: 5, kind: "storm" },
    { count: 20, interval: 4, kind: "cloud" },
  ],
  [
    { count: 16, interval: 9, kind: "tornado" },
    { count: 16, interval: 7, kind: "hail" },
    { count: 20, interval: 5, kind: "storm" },
  ],
];

/* ---------- difficulty presets ---------- */
type Difficulty = "easy" | "normal" | "hard" | "insane";

interface DifficultyPreset {
  desc: string;
  emoji: string;
  hpMul: number;
  key: Difficulty;
  label: string;
  rewardMul: number;
  spawnMul: number; // multiplier on spawn intervals (< 1 = faster spawning)
  spdMul: number;
  startGold: number;
  startLives: number;
  waveCount: number; // how many waves from BASE + EXTRA
}

const DIFFICULTIES: DifficultyPreset[] = [
  {
    desc: "Fewer waves, weaker enemies",
    emoji: "🟢",
    hpMul: 0.7,
    key: "easy",
    label: "Easy",
    rewardMul: 1.2,
    spawnMul: 1.3,
    spdMul: 0.8,
    startGold: 80,
    startLives: 15,
    waveCount: 6,
  },
  {
    desc: "Balanced challenge",
    emoji: "🟡",
    hpMul: 1.0,
    key: "normal",
    label: "Normal",
    rewardMul: 1.0,
    spawnMul: 1.0,
    spdMul: 1.0,
    startGold: 50,
    startLives: 10,
    waveCount: 8,
  },
  {
    desc: "Tougher enemies, less gold",
    emoji: "🔴",
    hpMul: 2.2,
    key: "hard",
    label: "Hard",
    rewardMul: 0.7,
    spawnMul: 0.7,
    spdMul: 1.5,
    startGold: 35,
    startLives: 5,
    waveCount: 12,
  },
  {
    desc: "Only for the brave",
    emoji: "💀",
    hpMul: 3.0,
    key: "insane",
    label: "Insane",
    rewardMul: 0.6,
    spawnMul: 0.55,
    spdMul: 1.7,
    startGold: 30,
    startLives: 4,
    waveCount: 14,
  },
];

function getWaves(preset: DifficultyPreset): Wave[] {
  const all = [...BASE_WAVES, ...EXTRA_WAVES];
  return all.slice(0, preset.waveCount);
}

/* ---------- runtime state ---------- */
interface Enemy {
  dist: number; // distance along path in px
  emoji: string;
  hp: number;
  id: number;
  kind: EnemyKind;
  maxHp: number;
  reward: number;
  size: number;
  speed: number;
}

interface Tower {
  col: number;
  cooldown: number;
  id: number;
  kind: TowerKind;
  row: number;
}

interface Bullet {
  color: string;
  damage: number;
  enemyId: number;
  id: number;
  speed: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
}

/* ================================================================
   HELPERS
   ================================================================ */

/** Total path length in px */
function totalPathLen(): number {
  let len = 0;
  for (let i = 1; i < PATH_PX.length; i += 1) {
    const dx = PATH_PX[i].x - PATH_PX[i - 1].x;
    const dy = PATH_PX[i].y - PATH_PX[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}
const TOTAL_PATH_LEN = totalPathLen();

/** Position on path given distance traveled */
function posOnPath(distance: number): Pt {
  let rem = distance;
  for (let i = 1; i < PATH_PX.length; i += 1) {
    const dx = PATH_PX[i].x - PATH_PX[i - 1].x;
    const dy = PATH_PX[i].y - PATH_PX[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (rem <= segLen) {
      const t = rem / segLen;
      return { x: PATH_PX[i - 1].x + dx * t, y: PATH_PX[i - 1].y + dy * t };
    }
    rem -= segLen;
  }
  return PATH_END_PX;
}

function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ================================================================
   BUILD THE PATH SVG-LIKE SEGMENTS FOR PRETTY RENDERING
   ================================================================ */

function buildPathSegments(): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}[] {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < PATH_PX.length; i += 1) {
    segs.push({
      x1: PATH_PX[i - 1].x,
      x2: PATH_PX[i].x,
      y1: PATH_PX[i - 1].y,
      y2: PATH_PX[i].y,
    });
  }
  return segs;
}

/* ================================================================
   COMPONENTS
   ================================================================ */

/** Visual path rendered with RN Views (thick rounded lines) */
function PathOverlay() {
  const segs = buildPathSegments();
  return (
    <>
      {segs.map((seg, i) => {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <RNView
            key={i}
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 5,
              height: 10,
              left: seg.x1,
              position: "absolute",
              top: seg.y1 - 5,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: "left center",
              width: len,
            }}
          />
        );
      })}
      {/* dashed center line overlay */}
      {segs.map((seg, i) => {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <RNView
            key={`d${i}`}
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              borderRadius: 1,
              borderStyle: "dashed",
              borderWidth: 1,
              height: 2,
              left: seg.x1,
              position: "absolute",
              top: seg.y1 - 1,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: "left center",
              width: len,
            }}
          />
        );
      })}
    </>
  );
}

/** HP bar above enemies */
function HpBar({
  hp,
  maxHp,
  size,
}: {
  hp: number;
  maxHp: number;
  size: number;
}) {
  const pct = Math.max(0, hp / maxHp);
  let barColor = "#ef5350";
  if (pct > 0.5) {
    barColor = "#66bb6a";
  } else if (pct > 0.25) {
    barColor = "#ffa726";
  }
  return (
    <RNView
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        borderRadius: 1.5,
        height: 3,
        left: (size - size * 0.9) / 2,
        position: "absolute",
        top: -6,
        width: size * 0.9,
      }}
    >
      <RNView
        style={{
          backgroundColor: barColor,
          borderRadius: 1.5,
          height: 3,
          width: `${pct * 100}%`,
        }}
      />
    </RNView>
  );
}

/** Rendered enemy */
function EnemySprite({ enemy }: { enemy: Enemy }) {
  const pos = posOnPath(enemy.dist);
  return (
    <RNView
      style={{
        alignItems: "center",
        height: enemy.size,
        justifyContent: "center",
        left: pos.x - enemy.size / 2,
        position: "absolute",
        top: pos.y - enemy.size / 2,
        width: enemy.size,
      }}
    >
      <HpBar hp={enemy.hp} maxHp={enemy.maxHp} size={enemy.size} />
      <Text style={{ fontSize: enemy.size * 0.7 }}>{enemy.emoji}</Text>
    </RNView>
  );
}

/** Tower on the board */
function TowerSprite({ tower }: { tower: Tower }) {
  const def = tdByKey[tower.kind];
  const cx = tower.col * CELL;
  const cy = tower.row * CELL;
  return (
    <Animated.View
      entering={ZoomIn.duration(200)}
      style={{
        alignItems: "center",
        backgroundColor: `${def.color}30`,
        borderColor: `${def.color}80`,
        borderRadius: 8,
        borderWidth: 1.5,
        height: CELL - 4,
        justifyContent: "center",
        left: cx + 2,
        position: "absolute",
        top: cy + 2,
        width: CELL - 4,
      }}
    >
      <Text style={{ fontSize: 18 }}>{def.emoji}</Text>
    </Animated.View>
  );
}

/** Bullet projectile */
function BulletSprite({ bullet }: { bullet: Bullet }) {
  return (
    <RNView
      style={{
        backgroundColor: bullet.color,
        borderRadius: 3,
        height: 6,
        left: bullet.x - 3,
        position: "absolute",
        shadowColor: bullet.color,
        shadowOffset: { height: 0, width: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        top: bullet.y - 3,
        width: 6,
      }}
    />
  );
}

/** Range ring preview when selecting tower placement */
function RangeRing({
  col,
  row,
  range,
  color,
}: {
  col: number;
  row: number;
  range: number;
  color: string;
}) {
  const cx = col * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2;
  return (
    <RNView
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}50`,
        borderRadius: range,
        borderWidth: 1,
        height: range * 2,
        left: cx - range,
        position: "absolute",
        top: cy - range,
        width: range * 2,
      }}
    />
  );
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function SkyDefenseGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const updateProgress = useGameStore((state) => state.updateProgress);
  const storedBest = useGameStore(
    (state) => state.progress["sky-defense"]?.highScore ?? 0
  );

  const towerLabel = (key: TowerKind) => {
    switch (key) {
      case "radar":
        return t("skyDefenseTowerRadar");
      case "sam":
        return t("skyDefenseTowerSam");
      case "wind":
        return t("skyDefenseTowerWind");
      case "bolt":
        return t("skyDefenseTowerBolt");
      default:
        // Exhaustive over TowerKind — unreachable.
        return key satisfies never;
    }
  };

  const difficultyLabel = (key: Difficulty) => {
    switch (key) {
      case "easy":
        return t("skyDefenseDifficultyEasy");
      case "normal":
        return t("skyDefenseDifficultyNormal");
      case "hard":
        return t("skyDefenseDifficultyHard");
      case "insane":
        return t("skyDefenseDifficultyInsane");
      default:
        // Exhaustive over Difficulty — unreachable.
        return key satisfies never;
    }
  };

  /* --- state --- */
  const [phase, setPhase] = useState<
    "start" | "build" | "playing" | "won" | "lost"
  >("start");
  const [difficulty, setDifficulty] = useState<DifficultyPreset>(
    DIFFICULTIES[1]
  );
  const [gold, setGold] = useState(50);
  const [lives, setLives] = useState(10);
  const [score, setScore] = useState(0);
  const [waveIdx, setWaveIdx] = useState(0);
  const wavesRef = useRef<Wave[]>(BASE_WAVES);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [selectedTower, setSelectedTower] = useState<TowerKind | null>(null);
  const [placeCursor, setPlaceCursor] = useState<{
    col: number;
    row: number;
  } | null>(null);
  const [selectedPlaced, setSelectedPlaced] = useState<number | null>(null);
  const [gameSpeed, setGameSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  const nextId = useRef(1);
  const spawnQueue = useRef<{ kind: EnemyKind; tickAt: number }[]>([]);
  const tick = useRef(0);

  /* refs for interval access */
  const enemiesRef = useRef(enemies);
  enemiesRef.current = enemies;
  const towersRef = useRef(towers);
  towersRef.current = towers;
  const bulletsRef = useRef(bullets);
  bulletsRef.current = bullets;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const goldRef = useRef(gold);
  goldRef.current = gold;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  // Synchronous game-over guard: the game-loop interval keeps firing until
  // effect cleanup clears it after the phase state flushes, so a tick landing
  // in that window would re-detect the terminal condition and fire
  // updateProgress twice.
  const endedRef = useRef<boolean>(false);
  const isGamePaused = paused || showRestartConfirm;

  // Board origin in window coordinates. Tower placement is derived from the
  // touch's absolute pageX/pageY minus this origin — NOT from the event's
  // locationX/Y, which is relative to whichever child (enemy, tower, grid
  // line) was actually under the finger and would land the tower on the
  // wrong cell when tapping over on-board elements.
  const boardViewRef = useRef<RNView>(null);
  const boardOriginRef = useRef({ x: 0, y: 0 });
  const measureBoard = () => {
    boardViewRef.current?.measureInWindow((x, y) => {
      boardOriginRef.current = { x, y };
    });
  };

  const cellFromEvent = (e: {
    nativeEvent: { pageX: number; pageY: number };
  }) => {
    const col = Math.floor(
      (e.nativeEvent.pageX - boardOriginRef.current.x) / CELL
    );
    const row = Math.floor(
      (e.nativeEvent.pageY - boardOriginRef.current.y) / CELL
    );
    return { col, row };
  };

  const updatePlaceCursor = (e: {
    nativeEvent: { pageX: number; pageY: number };
  }) => {
    if (!selectedTower || isGamePaused) {
      return;
    }
    const { col, row } = cellFromEvent(e);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      return;
    }
    setPlaceCursor({ col, row });
  };

  /* --- wave setup --- */
  const startWave = (wi: number, preset?: DifficultyPreset) => {
    const diff = preset ?? difficulty;
    const wave = wavesRef.current[wi];
    const queue: { kind: EnemyKind; tickAt: number }[] = [];
    let spawnTick = 10;
    for (const entry of wave) {
      for (let i = 0; i < entry.count; i += 1) {
        queue.push({ kind: entry.kind, tickAt: spawnTick });
        spawnTick += Math.max(4, Math.round(entry.interval * diff.spawnMul));
      }
    }
    spawnQueue.current = queue;
    tick.current = 0;
    setPhase("playing");
  };

  /* --- game loop --- */
  useEffect(() => {
    if (phase !== "playing" || isGamePaused) {
      return;
    }

    const ivl = setInterval(() => {
      if (endedRef.current) {
        return;
      }
      tick.current += 1;
      const now = tick.current;

      /* -- spawn -- */
      const toSpawn = spawnQueue.current.filter(
        (entry) => entry.tickAt === now
      );
      let newEnemies = [...enemiesRef.current];

      for (const sp of toSpawn) {
        const def = ENEMY_DEFS[sp.kind];
        const hp = Math.round(def.hp * difficulty.hpMul);
        const enemyId = nextId.current;
        nextId.current += 1;
        newEnemies.push({
          dist: 0,
          emoji: def.emoji,
          hp,
          id: enemyId,
          kind: sp.kind,
          maxHp: hp,
          reward: Math.round(def.reward * difficulty.rewardMul),
          size: def.size,
          speed: def.speed * difficulty.spdMul,
        });
      }

      /* -- move enemies -- */
      let leaked = 0;
      newEnemies = newEnemies
        .map((e) => ({ ...e, dist: e.dist + e.speed }))
        .filter((e) => {
          if (e.dist >= TOTAL_PATH_LEN) {
            leaked += 1;
            return false;
          }
          return true;
        });

      const newLives = livesRef.current - leaked;

      /* -- towers fire -- */
      const newTowers = towersRef.current.map((tw) => ({
        ...tw,
        cooldown: Math.max(0, tw.cooldown - 1),
      }));
      let newBullets = [...bulletsRef.current];

      for (const tw of newTowers) {
        if (tw.cooldown > 0) {
          continue;
        }
        const def = tdByKey[tw.kind];
        const tPos: Pt = {
          x: tw.col * CELL + CELL / 2,
          y: tw.row * CELL + CELL / 2,
        };
        // find closest enemy in range
        let best: Enemy | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const e of newEnemies) {
          if (e.hp <= 0) {
            continue;
          }
          const ePos = posOnPath(e.dist);
          const d = dist(tPos, ePos);
          if (d <= def.range && d < bestDist) {
            bestDist = d;
            best = e;
          }
        }
        if (best) {
          tw.cooldown = def.fireRate;
          const ePos = posOnPath(best.dist);
          const bulletId = nextId.current;
          nextId.current += 1;
          newBullets.push({
            color: def.color,
            damage: def.damage,
            enemyId: best.id,
            id: bulletId,
            speed: 4,
            tx: ePos.x,
            ty: ePos.y,
            x: tPos.x,
            y: tPos.y,
          });
        }
      }

      /* -- move bullets + hit -- */
      let goldGain = 0;
      let scoreGain = 0;
      newBullets = newBullets
        .map((b) => {
          const dx = b.tx - b.x;
          const dy = b.ty - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < b.speed) {
            return { ...b, x: b.tx, y: b.ty };
          }
          return {
            ...b,
            x: b.x + (dx / d) * b.speed,
            y: b.y + (dy / d) * b.speed,
          };
        })
        .filter((b) => {
          if (Math.abs(b.x - b.tx) < 2 && Math.abs(b.y - b.ty) < 2) {
            // hit
            const enemy = newEnemies.find((e) => e.id === b.enemyId);
            if (enemy) {
              enemy.hp -= b.damage;
              if (enemy.hp <= 0) {
                goldGain += enemy.reward;
                scoreGain += enemy.reward;
              }
            }
            return false;
          }
          return true;
        });

      // remove dead
      newEnemies = newEnemies.filter((e) => e.hp > 0);

      const newGold = goldRef.current + goldGain;
      const newScore = scoreRef.current + scoreGain;

      setEnemies(newEnemies);
      setTowers(newTowers);
      setBullets(newBullets);
      setLives(newLives);
      setGold(newGold);
      setScore(newScore);

      enemiesRef.current = newEnemies;
      towersRef.current = newTowers;
      bulletsRef.current = newBullets;
      livesRef.current = newLives;
      goldRef.current = newGold;
      scoreRef.current = newScore;

      /* -- check end conditions -- */
      if (newLives <= 0) {
        endedRef.current = true;
        setPhase("lost");
        setProgressInfo(
          updateProgress("sky-defense", newScore, { won: false })
        );
        return;
      }
      // wave done?
      const allSpawned = spawnQueue.current.every(
        (entry) => entry.tickAt <= now
      );
      if (allSpawned && newEnemies.length === 0) {
        if (waveIdx >= wavesRef.current.length - 1) {
          endedRef.current = true;
          setPhase("won");
          setProgressInfo(
            updateProgress("sky-defense", newScore, { won: true })
          );
        } else {
          // Next wave waits in the build phase until the player launches it.
          setBullets([]);
          setWaveIdx(waveIdx + 1);
          setPhase("build");
        }
      }
    }, TICK / gameSpeed);

    return () => clearInterval(ivl);
  }, [phase, waveIdx, updateProgress, gameSpeed, difficulty, isGamePaused]);

  /* --- place tower --- */
  const handleBoardPress = (e: {
    nativeEvent: { pageX: number; pageY: number };
  }) => {
    if (phase !== "playing" && phase !== "build") {
      return;
    }
    const { col, row } = cellFromEvent(e);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      return;
    }

    // Tap existing tower to see its range
    const existing = towers.find((tw) => tw.col === col && tw.row === row);
    if (existing) {
      setSelectedPlaced(selectedPlaced === existing.id ? null : existing.id);
      setPlaceCursor(null);
      return;
    }

    setSelectedPlaced(null);
    if (!selectedTower) {
      return;
    }
    if (PATH_CELLS.has(`${col},${row}`)) {
      return;
    }

    const def = tdByKey[selectedTower];
    if (gold < def.cost) {
      return;
    }

    const towerId = nextId.current;
    nextId.current += 1;
    const newTower: Tower = {
      col,
      cooldown: 0,
      id: towerId,
      kind: selectedTower,
      row,
    };
    haptic.tap();
    setTowers((prev) => [...prev, newTower]);
    setGold((g) => g - def.cost);
    setPlaceCursor(null);
  };

  /* --- launch the wave the player has been building for --- */
  const launchWave = () => {
    setSelectedTower(null);
    setPlaceCursor(null);
    startWave(waveIdx);
  };

  /* --- restart --- */
  const restart = () => {
    setShowRestartConfirm(false);
    setPhase("start");
    setGold(difficulty.startGold);
    setLives(difficulty.startLives);
    setScore(0);
    setWaveIdx(0);
    setEnemies([]);
    setTowers([]);
    setBullets([]);
    setSelectedTower(null);
    setPlaceCursor(null);
    setSelectedPlaced(null);
    setPaused(false);
    setProgressInfo(null);
    spawnQueue.current = [];
    tick.current = 0;
    endedRef.current = false;
  };

  const requestRestart = () => {
    setShowRestartConfirm(true);
  };

  /* --- start game with difficulty --- */
  const startGame = (preset: DifficultyPreset) => {
    setDifficulty(preset);
    setGold(preset.startGold);
    setLives(preset.startLives);
    setScore(0);
    setWaveIdx(0);
    setEnemies([]);
    setTowers([]);
    setBullets([]);
    setSelectedTower(null);
    setPlaceCursor(null);
    setSelectedPlaced(null);
    spawnQueue.current = [];
    tick.current = 0;
    endedRef.current = false;
    wavesRef.current = getWaves(preset);
    // Build first: the first wave starts when the player launches it.
    setPhase("build");
  };

  /* ================================================================
	   RENDER
	   ================================================================ */

  /* -- start screen -- */
  if (phase === "start") {
    return (
      <View style={s.root}>
        <Text style={s.title}>{t("skyDefenseTitle")}</Text>
        <Text style={[s.desc, { color: theme.mutedText }]}>
          {t("skyDefenseIntro")}
        </Text>
        <RNView style={s.towerInfo}>
          {TOWER_DEFS.map((d) => (
            <RNView key={d.key} style={s.towerInfoRow}>
              <Text style={{ fontSize: 20 }}>{d.emoji}</Text>
              <Text style={[s.towerInfoText, { color: theme.text }]}>
                {towerLabel(d.key)} —{" "}
                {t("skyDefenseTowerStats", {
                  cost: d.cost,
                  damage: d.damage,
                  range: d.range,
                })}
              </Text>
            </RNView>
          ))}
        </RNView>
        <RNView style={s.enemyInfo}>
          {(Object.values(ENEMY_DEFS) as EnemyDef[]).map((d) => (
            <RNView key={d.key} style={s.towerInfoRow}>
              <Text style={{ fontSize: 18 }}>{d.emoji}</Text>
              <Text style={[s.towerInfoText, { color: theme.mutedText }]}>
                {t("skyDefenseEnemyStats", {
                  hp: d.hp,
                  speed: d.speed.toFixed(1),
                })}
              </Text>
            </RNView>
          ))}
        </RNView>

        <Text style={[s.diffLabel, { color: theme.mutedText }]}>
          {t("skyDefenseSelectDifficulty")}
        </Text>
        <RNView style={s.diffRow}>
          {DIFFICULTIES.map((d) => (
            <Pressable
              accessibilityLabel={difficultyLabel(d.key)}
              accessibilityRole="button"
              key={d.key}
              onPress={() => startGame(d)}
              style={[
                s.diffBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{d.emoji}</Text>
              <Text style={[s.diffBtnLabel, { color: theme.text }]}>
                {difficultyLabel(d.key)}
              </Text>
              <Text style={[s.diffBtnDesc, { color: theme.mutedText }]}>
                {t("skyDefenseWavesCount", { count: d.waveCount })}
              </Text>
              <Text style={[s.diffBtnDesc, { color: theme.mutedText }]}>
                ❤️{d.startLives} 💰{d.startGold}
              </Text>
            </Pressable>
          ))}
        </RNView>
      </View>
    );
  }

  /* -- game over / won -- */
  if (phase === "lost" || phase === "won") {
    return (
      <View style={s.root}>
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={score}
          streak={progressInfo?.currentStreak}
          subtitle={t("skyDefenseDifficultyWave", {
            emoji: difficulty.emoji,
            label: difficultyLabel(difficulty.key),
            total: wavesRef.current.length,
            wave: waveIdx + 1,
          })}
          title={
            phase === "won"
              ? t("skyDefenseResultWin")
              : t("skyDefenseResultLose")
          }
        />
      </View>
    );
  }

  /* -- build / playing -- */
  return (
    <View style={s.root}>
      {/* Top controls row */}
      <RNView style={s.topRow}>
        <RNView style={[s.bestPill, { backgroundColor: theme.card }]}>
          <Text style={[s.bestLabel, { color: theme.mutedText }]}>
            {t("gameBest")}
          </Text>
          <Text style={[s.bestValue, { color: theme.tint }]}>{storedBest}</Text>
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={phase === "playing" ? () => setPaused(true) : undefined}
          onReset={requestRestart}
        />
      </RNView>

      {/* HUD */}
      <RNView style={s.hud}>
        <Text style={[s.hudText, { color: theme.text }]}>❤️ {lives}</Text>
        <Text style={[s.hudText, { color: theme.tint }]}>💰 {gold}</Text>
        <Text style={[s.hudText, { color: theme.text }]}>🏆 {score}</Text>
        <Text style={[s.hudText, { color: theme.mutedText }]}>
          {t("skyDefenseWaveProgress", {
            total: wavesRef.current.length,
            wave: waveIdx + 1,
          })}
        </Text>
        {enemies.length > 0 && (
          <Text style={[s.hudText, { color: theme.mutedText }]}>
            👾 {enemies.length}
          </Text>
        )}
        <Pressable
          accessibilityLabel={gameSpeed === 1 ? "Set 2x speed" : "Set 1x speed"}
          accessibilityRole="button"
          onPress={() => setGameSpeed((speed) => (speed === 1 ? 2 : 1))}
          style={[
            s.hudBtn,
            { borderColor: gameSpeed === 2 ? theme.tint : theme.border },
          ]}
        >
          <Text
            style={[
              s.hudText,
              { color: gameSpeed === 2 ? theme.tint : theme.mutedText },
            ]}
          >
            {gameSpeed === 1 ? "1×" : "2×"}
          </Text>
        </Pressable>
      </RNView>

      {/* Tower palette */}
      <RNView style={s.palette}>
        {TOWER_DEFS.map((d) => {
          const selected = selectedTower === d.key;
          const affordable = gold >= d.cost;
          return (
            <Pressable
              accessibilityLabel={towerLabel(d.key)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !affordable, selected }}
              key={d.key}
              onPress={() => {
                if (!affordable) {
                  return;
                }
                setSelectedTower(selected ? null : d.key);
                setSelectedPlaced(null);
              }}
              style={[
                s.paletteBtn,
                {
                  backgroundColor: selected
                    ? `${d.color}25`
                    : "rgba(255,255,255,0.04)",
                  borderColor: selected ? d.color : "rgba(255,255,255,0.15)",
                  opacity: affordable ? 1 : 0.4,
                },
              ]}
            >
              <Text style={{ fontSize: 16 }}>{d.emoji}</Text>
              <Text style={[s.paletteCost, { color: d.color }]}>
                💰{d.cost}
              </Text>
            </Pressable>
          );
        })}
      </RNView>

      {/* Board */}
      <Pressable onPress={handleBoardPress}>
        <RNView
          onLayout={measureBoard}
          onTouchMove={updatePlaceCursor}
          onTouchStart={updatePlaceCursor}
          ref={boardViewRef}
          style={[
            s.board,
            {
              backgroundColor:
                baseScheme(colorScheme) === "dark" ? "#0a1520" : "#e6eef4",
              height: BOARD_H,
              width: BOARD_W,
            },
          ]}
        >
          {/* grid lines */}
          {Array.from({ length: COLS + 1 }).map((_, i) => (
            <RNView
              key={`vc${i}`}
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                height: BOARD_H,
                left: i * CELL,
                position: "absolute",
                top: 0,
                width: 1,
              }}
            />
          ))}
          {Array.from({ length: ROWS + 1 }).map((_, i) => (
            <RNView
              key={`hr${i}`}
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                height: 1,
                left: 0,
                position: "absolute",
                top: i * CELL,
                width: BOARD_W,
              }}
            />
          ))}

          {/* path */}
          <PathOverlay />

          {/* start / end markers */}
          <RNView
            style={{
              alignItems: "center",
              backgroundColor: "rgba(102,187,106,0.3)",
              borderColor: "rgba(102,187,106,0.5)",
              borderRadius: 10,
              borderWidth: 1,
              height: 20,
              justifyContent: "center",
              left: PATH_PX[0].x - 10,
              position: "absolute",
              top: PATH_PX[0].y - 10,
              width: 20,
            }}
          >
            <Text style={{ fontSize: 10 }}>▶</Text>
          </RNView>
          <RNView
            style={{
              alignItems: "center",
              backgroundColor: "rgba(239,83,80,0.25)",
              borderColor: "rgba(239,83,80,0.5)",
              borderRadius: 12,
              borderWidth: 1,
              height: 24,
              justifyContent: "center",
              left: PATH_END_PX.x - 12,
              position: "absolute",
              top: PATH_END_PX.y - 12,
              width: 24,
            }}
          >
            <Text style={{ fontSize: 12 }}>✈️</Text>
          </RNView>

          {/* range ring for selected placed tower */}
          {selectedPlaced !== null &&
            towers
              .filter((tw) => tw.id === selectedPlaced)
              .map((tw) => (
                <RangeRing
                  col={tw.col}
                  color={tdByKey[tw.kind].color}
                  key={`sel-${tw.id}`}
                  range={tdByKey[tw.kind].range}
                  row={tw.row}
                />
              ))}

          {/* range ring preview for new placement */}
          {selectedTower && placeCursor ? (
            <RangeRing
              col={placeCursor.col}
              color={tdByKey[selectedTower].color}
              range={tdByKey[selectedTower].range}
              row={placeCursor.row}
            />
          ) : null}

          {/* towers */}
          {towers.map((tw) => (
            <TowerSprite key={tw.id} tower={tw} />
          ))}

          {/* enemies */}
          {enemies.map((e) => (
            <EnemySprite enemy={e} key={e.id} />
          ))}

          {/* bullets */}
          {bullets.map((b) => (
            <BulletSprite bullet={b} key={b.id} />
          ))}
        </RNView>
      </Pressable>

      {phase === "build" && (
        <RNView pointerEvents="box-none" style={s.waveModalBackdrop}>
          <RNView
            style={[
              s.waveModalCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[s.waveModalTitle, { color: theme.text }]}>
              {waveIdx === 0
                ? t("skyDefenseBuildHint")
                : t("skyDefenseWaveCleared", { wave: waveIdx })}
            </Text>
            <Pressable
              accessibilityLabel={t("skyDefenseStartWave", {
                wave: waveIdx + 1,
              })}
              accessibilityRole="button"
              onPress={launchWave}
              style={[s.waveModalBtn, { backgroundColor: theme.tint }]}
            >
              <Text style={[s.mainBtnText, { color: theme.onTint }]}>
                {t("skyDefenseStartWave", { wave: waveIdx + 1 })}
              </Text>
            </Pressable>
          </RNView>
        </RNView>
      )}

      <GamePauseOverlay
        onRestart={requestRestart}
        onResume={() => setPaused(false)}
        visible={paused}
      />

      {showRestartConfirm ? (
        <RNView style={s.confirmBackdrop}>
          <RNView
            style={[
              s.confirmCard,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <Text style={[s.confirmTitle, { color: theme.text }]}>
              {t("gameRestartConfirmTitle")}
            </Text>
            <Text style={[s.confirmText, { color: theme.mutedText }]}>
              {t("gameRestartConfirmMessage")}
            </Text>
            <RNView style={s.confirmActions}>
              <Pressable
                accessibilityLabel={t("gameCancel")}
                accessibilityRole="button"
                onPress={() => setShowRestartConfirm(false)}
                style={[
                  s.confirmSecondaryBtn,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[s.confirmSecondaryText, { color: theme.text }]}>
                  {t("gameCancel")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t("gameRestart")}
                accessibilityRole="button"
                onPress={restart}
                style={[s.confirmPrimaryBtn, { backgroundColor: theme.tint }]}
              >
                <Text style={[s.mainBtnText, { color: theme.onTint }]}>
                  {t("gameRestart")}
                </Text>
              </Pressable>
            </RNView>
          </RNView>
        </RNView>
      ) : null}
    </View>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const s = StyleSheet.create({
  bestLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bestPill: {
    alignItems: "baseline",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bestValue: { fontSize: 16, fontWeight: "900" },

  board: {
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 30,
  },
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    maxWidth: 320,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: "100%",
  },
  confirmPrimaryBtn: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 10,
  },
  confirmSecondaryBtn: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 10,
  },
  confirmSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  desc: { fontSize: 13, lineHeight: 20, marginBottom: 12, textAlign: "center" },
  diffBtn: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 2,
    paddingVertical: 10,
    width: 78,
  },
  diffBtnDesc: { fontSize: 9 },
  diffBtnLabel: { fontSize: 12, fontWeight: "800" },

  diffLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  diffRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  enemyInfo: { gap: 2, marginBottom: 12 },
  finalScore: { fontSize: 38, fontWeight: "900", marginBottom: 4 },

  hud: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    paddingVertical: 6,
    width: BOARD_W,
  },
  hudBtn: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hudText: { fontSize: 13, fontWeight: "700" },
  mainBtn: {
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  mainBtnText: { fontSize: 16, fontWeight: "800" },

  palette: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 6,
    marginTop: 2,
  },
  paletteBtn: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    width: 56,
  },
  paletteCost: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  title: { fontSize: 28, fontWeight: "900", marginBottom: 8 },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    width: "100%",
  },
  towerInfo: { gap: 4, marginBottom: 8 },
  towerInfoRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  towerInfoText: { fontSize: 12 },

  waveModalBackdrop: {
    alignItems: "center",
    bottom: 16,
    justifyContent: "flex-end",
    left: 0,
    paddingHorizontal: 24,
    position: "absolute",
    right: 0,
    top: 0,
  },
  waveModalBtn: {
    borderRadius: 10,
    marginTop: 2,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  waveModalCard: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: Math.min(BOARD_W - 24, 320),
  },
  waveModalTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
