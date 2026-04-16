import { useState, useRef, useEffect } from "react";
import { StyleSheet, Pressable, View as RNView } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

/* ================================================================
   CONSTANTS & TYPES
   ================================================================ */

const TICK = 33; // ~30 fps
const CELL = 40; // grid cell size
const COLS = 9;
const ROWS = 14;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;

type Pt = { x: number; y: number };

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

/** All grid cells that are on the path (for blocking tower placement) */
function getPathCells(): Set<string> {
	const set = new Set<string>();
	for (let i = 0; i < PATH_GRID.length - 1; i++) {
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
	set.add(
		`${PATH_GRID[PATH_GRID.length - 1].x},${PATH_GRID[PATH_GRID.length - 1].y}`,
	);
	return set;
}
const PATH_CELLS = getPathCells();

/* ---------- tower definitions ---------- */
type TowerKind = "radar" | "sam" | "wind" | "bolt";

interface TowerDef {
	key: TowerKind;
	label: string;
	cost: number;
	range: number; // px
	fireRate: number; // ticks between shots
	damage: number;
	color: string;
	emoji: string;
}

const TOWER_DEFS: TowerDef[] = [
	{
		key: "radar",
		label: "Radar",
		cost: 15,
		range: 90,
		fireRate: 18,
		damage: 8,
		color: "#4fc3f7",
		emoji: "📡",
	},
	{
		key: "sam",
		label: "SAM",
		cost: 30,
		range: 120,
		fireRate: 30,
		damage: 25,
		color: "#ef5350",
		emoji: "🚀",
	},
	{
		key: "wind",
		label: "Wind",
		cost: 20,
		range: 80,
		fireRate: 12,
		damage: 5,
		color: "#66bb6a",
		emoji: "🌀",
	},
	{
		key: "bolt",
		label: "Bolt",
		cost: 40,
		range: 140,
		fireRate: 40,
		damage: 40,
		color: "#ffd54f",
		emoji: "⚡",
	},
];

const tdByKey = Object.fromEntries(TOWER_DEFS.map((d) => [d.key, d]));

/* ---------- enemy definitions ---------- */
type EnemyKind = "cloud" | "storm" | "hail" | "tornado";

interface EnemyDef {
	key: EnemyKind;
	hp: number;
	speed: number; // px per tick
	reward: number;
	emoji: string;
	size: number;
}

const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
	cloud: { key: "cloud", hp: 30, speed: 0.8, reward: 5, emoji: "☁️", size: 22 },
	storm: { key: "storm", hp: 60, speed: 0.6, reward: 10, emoji: "⛈️", size: 26 },
	hail: { key: "hail", hp: 100, speed: 0.5, reward: 15, emoji: "🌨️", size: 28 },
	tornado: {
		key: "tornado",
		hp: 200,
		speed: 0.4,
		reward: 30,
		emoji: "🌪️",
		size: 32,
	},
};

/* ---------- wave definitions ---------- */
interface WaveEntry {
	kind: EnemyKind;
	count: number;
	interval: number; // ticks between spawns in this group
}
type Wave = WaveEntry[];

const BASE_WAVES: Wave[] = [
	[{ kind: "cloud", count: 6, interval: 20 }],
	[
		{ kind: "cloud", count: 8, interval: 18 },
		{ kind: "storm", count: 2, interval: 25 },
	],
	[
		{ kind: "storm", count: 6, interval: 20 },
		{ kind: "cloud", count: 4, interval: 15 },
	],
	[
		{ kind: "hail", count: 4, interval: 22 },
		{ kind: "storm", count: 4, interval: 18 },
	],
	[
		{ kind: "hail", count: 6, interval: 18 },
		{ kind: "cloud", count: 6, interval: 12 },
	],
	[
		{ kind: "tornado", count: 2, interval: 40 },
		{ kind: "hail", count: 5, interval: 18 },
	],
	[
		{ kind: "tornado", count: 3, interval: 35 },
		{ kind: "storm", count: 8, interval: 14 },
	],
	[
		{ kind: "tornado", count: 5, interval: 25 },
		{ kind: "hail", count: 6, interval: 16 },
		{ kind: "storm", count: 10, interval: 10 },
	],
];

const EXTRA_WAVES: Wave[] = [
	[
		{ kind: "tornado", count: 6, interval: 20 },
		{ kind: "hail", count: 8, interval: 12 },
	],
	[
		{ kind: "tornado", count: 8, interval: 16 },
		{ kind: "storm", count: 12, interval: 8 },
	],
	[
		{ kind: "tornado", count: 10, interval: 14 },
		{ kind: "hail", count: 10, interval: 10 },
		{ kind: "cloud", count: 15, interval: 6 },
	],
	[
		{ kind: "tornado", count: 12, interval: 12 },
		{ kind: "hail", count: 12, interval: 8 },
		{ kind: "storm", count: 15, interval: 6 },
	],
	[
		{ kind: "tornado", count: 14, interval: 10 },
		{ kind: "hail", count: 14, interval: 8 },
		{ kind: "storm", count: 18, interval: 5 },
		{ kind: "cloud", count: 20, interval: 4 },
	],
	[
		{ kind: "tornado", count: 16, interval: 9 },
		{ kind: "hail", count: 16, interval: 7 },
		{ kind: "storm", count: 20, interval: 5 },
	],
];

/* ---------- difficulty presets ---------- */
type Difficulty = "easy" | "normal" | "hard" | "insane";

interface DifficultyPreset {
	key: Difficulty;
	label: string;
	emoji: string;
	hpMul: number;
	spdMul: number;
	rewardMul: number;
	startGold: number;
	startLives: number;
	waveCount: number; // how many waves from BASE + EXTRA
	desc: string;
}

const DIFFICULTIES: DifficultyPreset[] = [
	{
		key: "easy",
		label: "Easy",
		emoji: "🟢",
		hpMul: 0.7,
		spdMul: 0.8,
		rewardMul: 1.2,
		startGold: 80,
		startLives: 15,
		waveCount: 6,
		desc: "Fewer waves, weaker enemies",
	},
	{
		key: "normal",
		label: "Normal",
		emoji: "🟡",
		hpMul: 1.0,
		spdMul: 1.0,
		rewardMul: 1.0,
		startGold: 50,
		startLives: 10,
		waveCount: 8,
		desc: "Balanced challenge",
	},
	{
		key: "hard",
		label: "Hard",
		emoji: "🔴",
		hpMul: 1.5,
		spdMul: 1.2,
		rewardMul: 0.8,
		startGold: 40,
		startLives: 7,
		waveCount: 10,
		desc: "Tougher enemies, less gold",
	},
	{
		key: "insane",
		label: "Insane",
		emoji: "💀",
		hpMul: 2.2,
		spdMul: 1.4,
		rewardMul: 0.6,
		startGold: 30,
		startLives: 5,
		waveCount: 14,
		desc: "Only for the brave",
	},
];

function getWaves(preset: DifficultyPreset): Wave[] {
	const all = [...BASE_WAVES, ...EXTRA_WAVES];
	return all.slice(0, preset.waveCount);
}

/* ---------- runtime state ---------- */
interface Enemy {
	id: number;
	kind: EnemyKind;
	hp: number;
	maxHp: number;
	speed: number;
	reward: number;
	dist: number; // distance along path in px
	emoji: string;
	size: number;
}

interface Tower {
	id: number;
	kind: TowerKind;
	col: number;
	row: number;
	cooldown: number;
}

interface Bullet {
	id: number;
	x: number;
	y: number;
	tx: number;
	ty: number;
	damage: number;
	enemyId: number;
	color: string;
	speed: number;
}

/* ================================================================
   HELPERS
   ================================================================ */

/** Total path length in px */
function totalPathLen(): number {
	let len = 0;
	for (let i = 1; i < PATH_PX.length; i++) {
		const dx = PATH_PX[i].x - PATH_PX[i - 1].x;
		const dy = PATH_PX[i].y - PATH_PX[i - 1].y;
		len += Math.sqrt(dx * dx + dy * dy);
	}
	return len;
}
const TOTAL_PATH_LEN = totalPathLen();

/** Position on path given distance traveled */
function posOnPath(dist: number): Pt {
	let rem = dist;
	for (let i = 1; i < PATH_PX.length; i++) {
		const dx = PATH_PX[i].x - PATH_PX[i - 1].x;
		const dy = PATH_PX[i].y - PATH_PX[i - 1].y;
		const segLen = Math.sqrt(dx * dx + dy * dy);
		if (rem <= segLen) {
			const t = rem / segLen;
			return { x: PATH_PX[i - 1].x + dx * t, y: PATH_PX[i - 1].y + dy * t };
		}
		rem -= segLen;
	}
	return PATH_PX[PATH_PX.length - 1];
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
	for (let i = 1; i < PATH_PX.length; i++) {
		segs.push({
			x1: PATH_PX[i - 1].x,
			y1: PATH_PX[i - 1].y,
			x2: PATH_PX[i].x,
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
							position: "absolute",
							left: seg.x1,
							top: seg.y1 - 5,
							width: len,
							height: 10,
							backgroundColor: "rgba(255,255,255,0.06)",
							borderRadius: 5,
							transform: [{ rotate: `${angle}deg` }],
							transformOrigin: "left center",
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
							position: "absolute",
							left: seg.x1,
							top: seg.y1 - 1,
							width: len,
							height: 2,
							borderRadius: 1,
							borderStyle: "dashed",
							borderWidth: 1,
							borderColor: "rgba(255,255,255,0.12)",
							transform: [{ rotate: `${angle}deg` }],
							transformOrigin: "left center",
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
	const barColor = pct > 0.5 ? "#66bb6a" : pct > 0.25 ? "#ffa726" : "#ef5350";
	return (
		<RNView
			style={{
				position: "absolute",
				top: -6,
				left: (size - size * 0.9) / 2,
				width: size * 0.9,
				height: 3,
				borderRadius: 1.5,
				backgroundColor: "rgba(0,0,0,0.4)",
			}}
		>
			<RNView
				style={{
					width: `${pct * 100}%`,
					height: 3,
					borderRadius: 1.5,
					backgroundColor: barColor,
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
				position: "absolute",
				left: pos.x - enemy.size / 2,
				top: pos.y - enemy.size / 2,
				width: enemy.size,
				height: enemy.size,
				alignItems: "center",
				justifyContent: "center",
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
		<RNView
			style={{
				position: "absolute",
				left: cx + 2,
				top: cy + 2,
				width: CELL - 4,
				height: CELL - 4,
				borderRadius: 8,
				backgroundColor: def.color + "30",
				borderWidth: 1.5,
				borderColor: def.color + "80",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Text style={{ fontSize: 18 }}>{def.emoji}</Text>
		</RNView>
	);
}

/** Bullet projectile */
function BulletSprite({ bullet }: { bullet: Bullet }) {
	return (
		<RNView
			style={{
				position: "absolute",
				left: bullet.x - 3,
				top: bullet.y - 3,
				width: 6,
				height: 6,
				borderRadius: 3,
				backgroundColor: bullet.color,
				shadowColor: bullet.color,
				shadowOffset: { width: 0, height: 0 },
				shadowOpacity: 0.8,
				shadowRadius: 4,
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
				position: "absolute",
				left: cx - range,
				top: cy - range,
				width: range * 2,
				height: range * 2,
				borderRadius: range,
				borderWidth: 1,
				borderColor: color + "50",
				backgroundColor: color + "10",
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
	const updateProgress = useGameStore((s) => s.updateProgress);

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
		}
	};

	/* --- state --- */
	const [phase, setPhase] = useState<
		"start" | "playing" | "wave-clear" | "won" | "lost"
	>("start");
	const [difficulty, setDifficulty] = useState<DifficultyPreset>(
		DIFFICULTIES[1],
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

	/* --- wave setup --- */
	const startWave = (wi: number) => {
		const wave = wavesRef.current[wi];
		const queue: { kind: EnemyKind; tickAt: number }[] = [];
		let t = 10;
		for (const entry of wave) {
			for (let i = 0; i < entry.count; i++) {
				queue.push({ kind: entry.kind, tickAt: t });
				t += entry.interval;
			}
		}
		spawnQueue.current = queue;
		tick.current = 0;
		setPhase("playing");
	};

	/* --- game loop --- */
	useEffect(() => {
		if (phase !== "playing") return;

		const ivl = setInterval(() => {
			tick.current++;
			const t = tick.current;

			/* -- spawn -- */
			const toSpawn = spawnQueue.current.filter((s) => s.tickAt === t);
			let newEnemies = [...enemiesRef.current];

			for (const sp of toSpawn) {
				const def = ENEMY_DEFS[sp.kind];
				const hp = Math.round(def.hp * difficulty.hpMul);
				newEnemies.push({
					id: nextId.current++,
					kind: sp.kind,
					hp,
					maxHp: hp,
					speed: def.speed * difficulty.spdMul,
					reward: Math.round(def.reward * difficulty.rewardMul),
					dist: 0,
					emoji: def.emoji,
					size: def.size,
				});
			}

			/* -- move enemies -- */
			let leaked = 0;
			newEnemies = newEnemies
				.map((e) => ({ ...e, dist: e.dist + e.speed }))
				.filter((e) => {
					if (e.dist >= TOTAL_PATH_LEN) {
						leaked++;
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
				if (tw.cooldown > 0) continue;
				const def = tdByKey[tw.kind];
				const tPos: Pt = {
					x: tw.col * CELL + CELL / 2,
					y: tw.row * CELL + CELL / 2,
				};
				// find closest enemy in range
				let best: Enemy | null = null;
				let bestDist = Infinity;
				for (const e of newEnemies) {
					if (e.hp <= 0) continue;
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
					newBullets.push({
						id: nextId.current++,
						x: tPos.x,
						y: tPos.y,
						tx: ePos.x,
						ty: ePos.y,
						damage: def.damage,
						enemyId: best.id,
						color: def.color,
						speed: 4,
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
					if (d < b.speed) return { ...b, x: b.tx, y: b.ty };
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
				setPhase("lost");
				updateProgress("sky-defense", newScore);
				return;
			}
			// wave done?
			const allSpawned = spawnQueue.current.every((s) => s.tickAt <= t);
			if (allSpawned && newEnemies.length === 0) {
				if (waveIdx >= wavesRef.current.length - 1) {
					setPhase("won");
					updateProgress("sky-defense", newScore);
				} else {
					setPhase("wave-clear");
				}
			}
		}, TICK);

		return () => clearInterval(ivl);
	}, [phase, waveIdx, updateProgress]);

	/* --- place tower --- */
	const handleBoardPress = (e: {
		nativeEvent: { locationX: number; locationY: number };
	}) => {
		if (phase !== "playing" && phase !== "wave-clear") return;
		const col = Math.floor(e.nativeEvent.locationX / CELL);
		const row = Math.floor(e.nativeEvent.locationY / CELL);
		if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

		// Tap existing tower to see its range
		const existing = towers.find((tw) => tw.col === col && tw.row === row);
		if (existing) {
			setSelectedPlaced(selectedPlaced === existing.id ? null : existing.id);
			setPlaceCursor(null);
			return;
		}

		setSelectedPlaced(null);
		if (!selectedTower) return;
		if (PATH_CELLS.has(`${col},${row}`)) return;

		const def = tdByKey[selectedTower];
		if (gold < def.cost) return;

		const newTower: Tower = {
			id: nextId.current++,
			kind: selectedTower,
			col,
			row,
			cooldown: 0,
		};
		haptic.tap();
		setTowers((prev) => [...prev, newTower]);
		setGold((g) => g - def.cost);
		setPlaceCursor(null);
	};

	/* --- next wave --- */
	const nextWave = () => {
		const wi = waveIdx + 1;
		setWaveIdx(wi);
		startWave(wi);
	};

	/* --- restart --- */
	const restart = () => {
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
		spawnQueue.current = [];
		tick.current = 0;
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
		wavesRef.current = getWaves(preset);
		setPhase("playing");
		// start first wave after short delay
		setTimeout(() => startWave(0), 50);
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
							key={d.key}
							style={[
								s.diffBtn,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
							onPress={() => startGame(d)}
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
				<Text style={s.title}>
					{phase === "won"
						? t("skyDefenseResultWin")
						: t("skyDefenseResultLose")}
				</Text>
				<Text style={[s.finalScore, { color: theme.tint }]}>
					{t("skyDefenseScorePts", { score })}
				</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("skyDefenseDifficultyWave", {
						emoji: difficulty.emoji,
						label: difficultyLabel(difficulty.key),
						wave: waveIdx + 1,
						total: wavesRef.current.length,
					})}
				</Text>
				<Pressable
					style={[s.mainBtn, { backgroundColor: theme.tint }]}
					onPress={restart}
				>
					<Text style={s.mainBtnText}>{t("playAgain")}</Text>
				</Pressable>
			</View>
		);
	}

	/* -- playing / wave-clear -- */
	return (
		<View style={s.root}>
			{/* HUD */}
			<RNView style={s.hud}>
				<Text style={[s.hudText, { color: theme.text }]}>❤️ {lives}</Text>
				<Text style={[s.hudText, { color: theme.tint }]}>💰 {gold}</Text>
				<Text style={[s.hudText, { color: theme.text }]}>🏆 {score}</Text>
				<Text style={[s.hudText, { color: theme.mutedText }]}>
					{t("skyDefenseWaveProgress", {
						wave: waveIdx + 1,
						total: wavesRef.current.length,
					})}
				</Text>
				{enemies.length > 0 && (
					<Text style={[s.hudText, { color: theme.mutedText }]}>
						👾 {enemies.length}
					</Text>
				)}
			</RNView>

			{/* Tower palette */}
			<RNView style={s.palette}>
				{TOWER_DEFS.map((d) => {
					const selected = selectedTower === d.key;
					const affordable = gold >= d.cost;
					return (
						<Pressable
							key={d.key}
							style={[
								s.paletteBtn,
								{
									borderColor: selected ? d.color : "rgba(255,255,255,0.15)",
									backgroundColor: selected
										? d.color + "25"
										: "rgba(255,255,255,0.04)",
									opacity: affordable ? 1 : 0.4,
								},
							]}
							onPress={() => {
								if (!affordable) return;
								setSelectedTower(selected ? null : d.key);
								setSelectedPlaced(null);
							}}
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
					style={[
						s.board,
						{
							width: BOARD_W,
							height: BOARD_H,
							backgroundColor: colorScheme === "dark" ? "#0a1520" : "#e6eef4",
						},
					]}
				>
					{/* grid lines */}
					{Array.from({ length: COLS + 1 }).map((_, i) => (
						<RNView
							key={`vc${i}`}
							style={{
								position: "absolute",
								left: i * CELL,
								top: 0,
								width: 1,
								height: BOARD_H,
								backgroundColor: "rgba(255,255,255,0.04)",
							}}
						/>
					))}
					{Array.from({ length: ROWS + 1 }).map((_, i) => (
						<RNView
							key={`hr${i}`}
							style={{
								position: "absolute",
								left: 0,
								top: i * CELL,
								width: BOARD_W,
								height: 1,
								backgroundColor: "rgba(255,255,255,0.04)",
							}}
						/>
					))}

					{/* path */}
					<PathOverlay />

					{/* start / end markers */}
					<RNView
						style={{
							position: "absolute",
							left: PATH_PX[0].x - 10,
							top: PATH_PX[0].y - 10,
							width: 20,
							height: 20,
							borderRadius: 10,
							backgroundColor: "rgba(102,187,106,0.3)",
							borderWidth: 1,
							borderColor: "rgba(102,187,106,0.5)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text style={{ fontSize: 10 }}>▶</Text>
					</RNView>
					<RNView
						style={{
							position: "absolute",
							left: PATH_PX[PATH_PX.length - 1].x - 12,
							top: PATH_PX[PATH_PX.length - 1].y - 12,
							width: 24,
							height: 24,
							borderRadius: 12,
							backgroundColor: "rgba(239,83,80,0.25)",
							borderWidth: 1,
							borderColor: "rgba(239,83,80,0.5)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text style={{ fontSize: 12 }}>✈️</Text>
					</RNView>

					{/* range ring for selected placed tower */}
					{selectedPlaced != null &&
						towers
							.filter((tw) => tw.id === selectedPlaced)
							.map((tw) => (
								<RangeRing
									key={`sel-${tw.id}`}
									col={tw.col}
									row={tw.row}
									range={tdByKey[tw.kind].range}
									color={tdByKey[tw.kind].color}
								/>
							))}

					{/* range ring preview for new placement */}
					{selectedTower && placeCursor && (
						<RangeRing
							col={placeCursor.col}
							row={placeCursor.row}
							range={tdByKey[selectedTower].range}
							color={tdByKey[selectedTower].color}
						/>
					)}

					{/* towers */}
					{towers.map((tw) => (
						<TowerSprite key={tw.id} tower={tw} />
					))}

					{/* enemies */}
					{enemies.map((e) => (
						<EnemySprite key={e.id} enemy={e} />
					))}

					{/* bullets */}
					{bullets.map((b) => (
						<BulletSprite key={b.id} bullet={b} />
					))}
				</RNView>
			</Pressable>

			{/* wave-clear overlay */}
			{phase === "wave-clear" && (
				<RNView style={s.overlay}>
					<Text style={s.overlayTitle}>
						{t("skyDefenseWaveCleared", { wave: waveIdx + 1 })}
					</Text>
					<RNView style={s.waveStats}>
						<Text style={s.waveStatsText}>🏆 {score}</Text>
						<Text style={s.waveStatsText}>💰 {gold}</Text>
						<Text style={s.waveStatsText}>❤️ {lives}</Text>
					</RNView>
					<Pressable
						style={[s.mainBtn, { backgroundColor: theme.tint }]}
						onPress={nextWave}
					>
						<Text style={s.mainBtnText}>{t("skyDefenseNextWave")}</Text>
					</Pressable>
				</RNView>
			)}
		</View>
	);
}

/* ================================================================
   STYLES
   ================================================================ */

const s = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
	},
	title: { fontSize: 28, fontWeight: "900", marginBottom: 8 },
	desc: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 12 },
	finalScore: { fontSize: 38, fontWeight: "900", marginBottom: 4 },
	mainBtn: {
		paddingHorizontal: 40,
		paddingVertical: 14,
		borderRadius: 12,
		marginTop: 16,
	},
	mainBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
	towerInfo: { marginBottom: 8, gap: 4 },
	enemyInfo: { marginBottom: 12, gap: 2 },
	towerInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	towerInfoText: { fontSize: 12 },

	hud: {
		flexDirection: "row",
		justifyContent: "space-around",
		width: BOARD_W,
		paddingVertical: 6,
		paddingHorizontal: 4,
	},
	hudText: { fontSize: 13, fontWeight: "700" },

	palette: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 8,
		marginBottom: 6,
		marginTop: 2,
	},
	paletteBtn: {
		alignItems: "center",
		justifyContent: "center",
		width: 56,
		height: 48,
		borderRadius: 10,
		borderWidth: 1.5,
	},
	paletteCost: { fontSize: 10, fontWeight: "700", marginTop: 1 },

	board: {
		borderRadius: 8,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
	},

	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(0,0,0,0.6)",
		borderRadius: 8,
	},
	overlayTitle: {
		fontSize: 22,
		fontWeight: "900",
		color: "#fff",
		marginBottom: 8,
	},
	waveStats: {
		flexDirection: "row",
		gap: 16,
		marginBottom: 4,
	},
	waveStatsText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#fff",
	},

	diffLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		marginBottom: 8,
	},
	diffRow: {
		flexDirection: "row",
		gap: 8,
		flexWrap: "wrap",
		justifyContent: "center",
	},
	diffBtn: {
		width: 78,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		gap: 2,
	},
	diffBtnLabel: { fontSize: 12, fontWeight: "800" },
	diffBtnDesc: { fontSize: 9 },
});
