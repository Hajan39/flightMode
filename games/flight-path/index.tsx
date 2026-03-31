import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type LayoutChangeEvent,
	PanResponder,
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

/* ================================================================
   TYPES
   ================================================================ */

type Pt = { x: number; y: number };

type RwySize = "long" | "medium" | "short";

type PlaneType = {
	key: string;
	label: string;
	/** base speed (px per tick) */
	baseSpeed: number;
	/** drawn body half-length (nose to center) */
	bodyH: number;
	/** drawn wing half-span (center to wingtip) */
	wingW: number;
	/** collision radius */
	collisionR: number;
	/** score multiplier */
	scoreMul: number;
	/** body colour */
	bodyColor: string;
	/** wing colour */
	wingColor: string;
	/** has tail fin? */
	hasTail: boolean;
	/** minimum runway size this plane needs */
	minRunway: RwySize;
};

const PLANE_TYPES: PlaneType[] = [
	{
		key: "prop",
		label: "PROP",
		baseSpeed: 0.45,
		bodyH: 8,
		wingW: 6,
		collisionR: 18,
		scoreMul: 1,
		bodyColor: "#90CAF9",
		wingColor: "#64B5F6",
		hasTail: false,
		minRunway: "short",
	},
	{
		key: "jet",
		label: "JET",
		baseSpeed: 0.75,
		bodyH: 11,
		wingW: 8,
		collisionR: 22,
		scoreMul: 1.5,
		bodyColor: "#A5D6A7",
		wingColor: "#81C784",
		hasTail: true,
		minRunway: "medium",
	},
	{
		key: "jumbo",
		label: "JUMBO",
		baseSpeed: 0.55,
		bodyH: 14,
		wingW: 14,
		collisionR: 30,
		scoreMul: 2,
		bodyColor: "#FFE082",
		wingColor: "#FFD54F",
		hasTail: true,
		minRunway: "long",
	},
	{
		key: "cargo",
		label: "CARGO",
		baseSpeed: 0.38,
		bodyH: 13,
		wingW: 11,
		collisionR: 28,
		scoreMul: 2.5,
		bodyColor: "#FFAB91",
		wingColor: "#FF8A65",
		hasTail: true,
		minRunway: "long",
	},
	{
		key: "fighter",
		label: "FAST",
		baseSpeed: 1.05,
		bodyH: 10,
		wingW: 5,
		collisionR: 16,
		scoreMul: 3,
		bodyColor: "#CE93D8",
		wingColor: "#BA68C8",
		hasTail: false,
		minRunway: "long",
	},
];

type Plane = {
	id: number;
	x: number;
	y: number;
	angle: number;
	targetAngle: number;
	speed: number;
	path: Pt[] | null;
	pathIdx: number;
	color: string;
	type: PlaneType;
	/** when set, the plane is sliding down the runway */
	landing: {
		/** 0→1 progress along the runway */
		t: number;
		/** entry point (where the plane touched down) */
		from: Pt;
		/** exit point (far end of runway) */
		to: Pt;
		/** locked angle along the runway */
		runwayAngle: number;
	} | null;
};

type Runway = {
	/** center x */
	cx: number;
	/** center y */
	cy: number;
	/** rotation radians */
	rotation: number;
	/** half-length of the strip */
	halfLen: number;
	label: string;
	/** size category */
	size: RwySize;
	/** which endpoint index (0=A, 1=B) is the landing threshold */
	landingEnd: 0 | 1;
};

/** Check if a runway is big enough for the given plane type */
const RWY_SIZE_ORDER: Record<RwySize, number> = {
	short: 0,
	medium: 1,
	long: 2,
};
function canLandOn(plane: PlaneType, rwy: Runway): boolean {
	return RWY_SIZE_ORDER[rwy.size] >= RWY_SIZE_ORDER[plane.minRunway];
}

/* ================================================================
   CONSTANTS & HELPERS
   ================================================================ */

const LAND_DIST = 22;
const PATH_MIN_DIST = 6;
const TICK = 33;
const MAX_PLANES = 10;
const TURN_RATE = 0.065;
const BASE_PTS = 40;
/** how much of the runway (from each end) counts as entry zone (0–1, 0.25 = first quarter) */
const RWY_ENTRY_ZONE = 0.25;
/** how fast the landing animation progresses per tick (0→1) */
const LANDING_SPEED = 0.012;

const TRAIL_COLORS = [
	"#4FC3F7",
	"#81C784",
	"#FFB74D",
	"#E57373",
	"#BA68C8",
	"#4DD0E1",
	"#AED581",
	"#FF8A65",
	"#F06292",
	"#9575CD",
];

function dist(a: Pt, b: Pt) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(a: Pt, b: Pt) {
	return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDiff(from: number, to: number) {
	let d = to - from;
	while (d > Math.PI) d -= 2 * Math.PI;
	while (d < -Math.PI) d += 2 * Math.PI;
	return d;
}

function lerpAngle(current: number, target: number, rate: number) {
	const diff = angleDiff(current, target);
	if (Math.abs(diff) <= rate) return target;
	return current + Math.sign(diff) * rate;
}

/** Get the two endpoints of a runway */
function rwyEndpoints(rwy: Runway): [Pt, Pt] {
	const dx = Math.cos(rwy.rotation) * rwy.halfLen;
	const dy = Math.sin(rwy.rotation) * rwy.halfLen;
	return [
		{ x: rwy.cx - dx, y: rwy.cy - dy },
		{ x: rwy.cx + dx, y: rwy.cy + dy },
	];
}

function pickType(landed: number): PlaneType {
	if (landed < 4) return PLANE_TYPES[Math.random() < 0.5 ? 0 : 1];
	if (landed < 10) {
		const r = Math.random();
		return r < 0.3
			? PLANE_TYPES[0]
			: r < 0.65
				? PLANE_TYPES[1]
				: PLANE_TYPES[2];
	}
	const r = Math.random();
	if (r < 0.15) return PLANE_TYPES[0];
	if (r < 0.4) return PLANE_TYPES[1];
	if (r < 0.6) return PLANE_TYPES[2];
	if (r < 0.8) return PLANE_TYPES[3];
	return PLANE_TYPES[4];
}

/* ================================================================
   DRAWN PLANE COMPONENT  (pure RNView, rotates correctly)
   ================================================================ */

function DrawnPlane({
	type,
	angleDeg,
	selected,
	trailColor,
	hasPath,
}: {
	type: PlaneType;
	angleDeg: number;
	selected: boolean;
	trailColor: string;
	hasPath: boolean;
}) {
	const { bodyH, wingW, bodyColor, wingColor, hasTail } = type;
	const outerSize = (Math.max(bodyH, wingW) + 4) * 2;

	return (
		<RNView
			style={{
				width: outerSize,
				height: outerSize,
				justifyContent: "center",
				alignItems: "center",
				transform: [{ rotate: `${angleDeg}deg` }],
			}}
		>
			{/* fuselage (tall narrow rect → points "up") */}
			<RNView
				style={{
					position: "absolute",
					width: 4 + (type.key === "jumbo" || type.key === "cargo" ? 2 : 0),
					height: bodyH * 2,
					borderRadius: 2,
					backgroundColor: bodyColor,
				}}
			/>
			{/* nose triangle */}
			<RNView
				style={{
					position: "absolute",
					top: outerSize / 2 - bodyH - 5,
					borderLeftWidth: 4,
					borderRightWidth: 4,
					borderBottomWidth: 7,
					borderLeftColor: "transparent",
					borderRightColor: "transparent",
					borderBottomColor: bodyColor,
				}}
			/>
			{/* swept wings */}
			<RNView
				style={{
					position: "absolute",
					top: outerSize / 2 + bodyH * 0.15,
					width: wingW * 2,
					height: 0,
					borderTopWidth: 3,
					borderTopColor: wingColor,
					borderLeftWidth: wingW * 0.6,
					borderLeftColor: "transparent",
					borderRightWidth: wingW * 0.6,
					borderRightColor: "transparent",
				}}
			/>
			{/* tail fin (optional) */}
			{hasTail && (
				<RNView
					style={{
						position: "absolute",
						top: outerSize / 2 + bodyH - 3,
						width: wingW * 0.9,
						height: 0,
						borderTopWidth: 2,
						borderTopColor: wingColor,
						borderLeftWidth: wingW * 0.3,
						borderLeftColor: "transparent",
						borderRightWidth: wingW * 0.3,
						borderRightColor: "transparent",
						opacity: 0.7,
					}}
				/>
			)}
			{/* selection ring */}
			{selected && (
				<RNView
					style={{
						position: "absolute",
						width: outerSize - 4,
						height: outerSize - 4,
						borderRadius: outerSize / 2,
						borderWidth: 2,
						borderColor: "#fff",
					}}
				/>
			)}
			{/* guide ring when unselected */}
			{!selected && (
				<RNView
					style={{
						position: "absolute",
						width: outerSize - 6,
						height: outerSize - 6,
						borderRadius: outerSize / 2,
						borderWidth: 1.2,
						borderColor: trailColor,
						opacity: hasPath ? 0.35 : 0.6,
					}}
				/>
			)}
		</RNView>
	);
}

/* ================================================================
   RUNWAY STRIP COMPONENT  (drawn as dashed line)
   ================================================================ */

function RunwayStrip({ rwy }: { rwy: Runway }) {
	const deg = (rwy.rotation * 180) / Math.PI;
	const len = rwy.halfLen * 2;
	const DASHES = Math.max(3, Math.round(len / 14));
	const sizeTag = rwy.size === "long" ? "L" : rwy.size === "medium" ? "M" : "S";

	return (
		<RNView
			pointerEvents="none"
			style={{
				position: "absolute",
				left: rwy.cx - rwy.halfLen,
				top: rwy.cy - 8,
				width: len,
				height: 16,
				transform: [{ rotate: `${deg}deg` }],
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{/* outer strip */}
			<RNView
				style={{
					width: len,
					height: 12,
					borderRadius: 2,
					backgroundColor: "rgba(255,255,255,0.06)",
					borderWidth: 1,
					borderColor: "rgba(255,255,255,0.15)",
					flexDirection: "row",
					justifyContent: "space-evenly",
					alignItems: "center",
				}}
			>
				{Array.from({ length: DASHES }).map((_, i) => (
					<RNView
						key={i}
						style={{
							width: len / DASHES - 6,
							height: 2,
							borderRadius: 1,
							backgroundColor: "rgba(255,255,255,0.45)",
						}}
					/>
				))}
			</RNView>
			{/* landing threshold — green marker on the landing end */}
			<RNView
				style={{
					position: "absolute",
					...(rwy.landingEnd === 0 ? { left: 0 } : { right: 0 }),
					width: 6,
					height: 14,
					borderRadius: 1,
					backgroundColor: "rgba(100,255,120,0.6)",
				}}
			/>
			{/* far end — dim marker */}
			<RNView
				style={{
					position: "absolute",
					...(rwy.landingEnd === 0 ? { right: 0 } : { left: 0 }),
					width: 3,
					height: 10,
					borderRadius: 1,
					backgroundColor: "rgba(255,200,50,0.3)",
				}}
			/>
			{/* label */}
			<Text
				style={{
					position: "absolute",
					top: -10,
					fontSize: 7,
					fontWeight: "800",
					color: "rgba(255,255,255,0.4)",
					// counter-rotate the label so it stays readable
					transform: [{ rotate: `${-deg}deg` }],
				}}
			>
				{rwy.label} {sizeTag}
			</Text>
		</RNView>
	);
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function FlightPathGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const updateProgress = useGameStore((s) => s.updateProgress);

	const [boardSize, setBoardSize] = useState({ w: 300, h: 500 });
	const boardRef = useRef({ w: 300, h: 500 });

	const [planes, setPlanes] = useState<Plane[]>([]);
	const [drawPath, setDrawPath] = useState<Pt[]>([]);
	const [score, setScore] = useState(0);
	const [landed, setLanded] = useState(0);
	const [gameOver, setGameOver] = useState(false);
	const [started, setStarted] = useState(false);

	const planesRef = useRef<Plane[]>([]);
	const selectedRef = useRef<number | null>(null);
	const drawRef = useRef<Pt[]>([]);
	const scoreRef = useRef(0);
	const landedRef = useRef(0);
	const gameOverRef = useRef(false);
	const nextIdRef = useRef(1);

	useEffect(() => {
		planesRef.current = planes;
	}, [planes]);
	useEffect(() => {
		scoreRef.current = score;
	}, [score]);
	useEffect(() => {
		landedRef.current = landed;
	}, [landed]);
	useEffect(() => {
		gameOverRef.current = gameOver;
	}, [gameOver]);

	const onBoardLayout = (e: LayoutChangeEvent) => {
		const { width, height } = e.nativeEvent.layout;
		setBoardSize({ w: width, h: height });
		boardRef.current = { w: width, h: height };
	};

	/* ---- RUNWAYS — centered, crossing, different lengths ---- */
	const runways = useMemo<Runway[]>(() => {
		const { w, h } = boardSize;
		const cx = w / 2;
		const cy = h * 0.52;
		const base = Math.min(w, h) * 0.32;
		return [
			// LONG — horizontal, for jumbo/cargo/fighter
			{
				cx,
				cy,
				rotation: 0,
				halfLen: base * 1.15,
				label: "09L",
				size: "long" as RwySize,
				landingEnd: 0 as const,
			},
			// MEDIUM — ~55° diagonal, for jet+
			{
				cx,
				cy,
				rotation: 0.96,
				halfLen: base * 0.8,
				label: "27R",
				size: "medium" as RwySize,
				landingEnd: 0 as const,
			},
			// SHORT — ~-40° diagonal, for prop (any can use)
			{
				cx,
				cy,
				rotation: -0.7,
				halfLen: base * 0.6,
				label: "14C",
				size: "short" as RwySize,
				landingEnd: 1 as const,
			},
		];
	}, [boardSize]);
	const runwaysRef = useRef(runways);
	useEffect(() => {
		runwaysRef.current = runways;
	}, [runways]);

	/* spawn from edges */
	const spawn = useCallback(() => {
		if (gameOverRef.current) return;
		if (planesRef.current.length >= MAX_PLANES) return;

		const { w, h } = boardRef.current;
		const id = nextIdRef.current++;
		const side = Math.floor(Math.random() * 5);
		let x: number, y: number, a: number;

		if (side === 0) {
			x = 40 + Math.random() * (w - 80);
			y = -20;
			a = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
		} else if (side === 1) {
			x = -20;
			y = 20 + Math.random() * (h * 0.5);
			a = (Math.random() - 0.2) * 0.6;
		} else if (side === 2) {
			x = w + 20;
			y = 20 + Math.random() * (h * 0.5);
			a = Math.PI + (Math.random() - 0.5) * 0.6;
		} else if (side === 3) {
			x = -20;
			y = -20;
			a = Math.PI / 4 + (Math.random() - 0.5) * 0.3;
		} else {
			x = w + 20;
			y = -20;
			a = (3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.3;
		}

		const type = pickType(landedRef.current);
		const sv = 0.85 + Math.random() * 0.3;

		setPlanes((prev) => [
			...prev,
			{
				id,
				x,
				y,
				angle: a,
				targetAngle: a,
				speed: type.baseSpeed * sv,
				path: null,
				pathIdx: 0,
				color: TRAIL_COLORS[id % TRAIL_COLORS.length],
				type,
				landing: null,
			},
		]);
	}, []);

	const spawnMs = useMemo(() => Math.max(1400, 3500 - landed * 80), [landed]);

	useEffect(() => {
		if (!started || gameOver) return;
		spawn();
		const t = setInterval(spawn, spawnMs);
		return () => clearInterval(t);
	}, [started, gameOver, spawnMs, spawn]);

	/* ---- GAME LOOP ---- */
	useEffect(() => {
		if (!started || gameOver) return;

		const tick = setInterval(() => {
			const current = planesRef.current;
			const rwys = runwaysRef.current;
			const { w, h } = boardRef.current;
			const next: Plane[] = [];
			let landedThisTick = 0;
			let landedPts = 0;

			for (const p of current) {
				/* --- plane is already sliding on runway --- */
				if (p.landing) {
					const nt = p.landing.t + LANDING_SPEED;
					if (nt >= 1) {
						// finished sliding → fully landed, remove
						continue;
					}
					const { from, to, runwayAngle } = p.landing;
					next.push({
						...p,
						x: from.x + (to.x - from.x) * nt,
						y: from.y + (to.y - from.y) * nt,
						angle: runwayAngle,
						targetAngle: runwayAngle,
						landing: { ...p.landing, t: nt },
					});
					continue;
				}

				/* --- normal flight movement --- */
				let nx: number;
				let ny: number;
				let nTarget = p.targetAngle;
				let nIdx = p.pathIdx;

				if (p.path && p.pathIdx < p.path.length) {
					const target = p.path[p.pathIdx];
					const dd = dist(p, target);
					if (dd < p.speed * 2.5) {
						nx = target.x;
						ny = target.y;
						nIdx = p.pathIdx + 1;
						if (nIdx < p.path.length) {
							nTarget = angleTo(target, p.path[nIdx]);
						}
					} else {
						nTarget = angleTo(p, target);
						nx = p.x + Math.cos(nTarget) * p.speed;
						ny = p.y + Math.sin(nTarget) * p.speed;
					}
				} else {
					nTarget = p.targetAngle;
					nx = p.x + Math.cos(p.angle) * p.speed;
					ny = p.y + Math.sin(p.angle) * p.speed;
				}

				const na = lerpAngle(p.angle, nTarget, TURN_RATE);

				/* landing check — entry zone = first 25% from each end of each runway */
				let startedLanding = false;
				if (p.path) {
					for (const rwy of rwys) {
						// only land on runways big enough for this plane type
						if (!canLandOn(p.type, rwy)) continue;

						const [endA, endB] = rwyEndpoints(rwy);
						const pos: Pt = { x: nx, y: ny };
						// only accept landing from the designated threshold end
						const from = rwy.landingEnd === 0 ? endA : endB;
						const to = rwy.landingEnd === 0 ? endB : endA;
						const dFrom = dist(pos, from);
						const entryDist = rwy.halfLen * 2 * RWY_ENTRY_ZONE;
						if (dFrom < entryDist + LAND_DIST) {
							const runwayAngle = angleTo(from, to);
							landedThisTick++;
							landedPts += Math.round(BASE_PTS * p.type.scoreMul);
							next.push({
								...p,
								x: from.x,
								y: from.y,
								angle: runwayAngle,
								targetAngle: runwayAngle,
								path: null,
								landing: { t: 0, from, to, runwayAngle },
							});
							startedLanding = true;
							break;
						}
					}
				}
				if (startedLanding) continue;

				/* off-screen → wrap to opposite edge, clear path so player must redraw */
				const OOB = 60;
				if (nx < -OOB || nx > w + OOB || ny < -OOB || ny > h + OOB) {
					let wx = nx;
					let wy = ny;
					let wa = na;
					if (nx < -OOB) {
						wx = w + OOB - 10;
						wa = Math.PI + (Math.random() - 0.5) * 0.4;
					} else if (nx > w + OOB) {
						wx = -OOB + 10;
						wa = (Math.random() - 0.5) * 0.4;
					}
					if (ny < -OOB) {
						wy = h + OOB - 10;
						wa = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
					} else if (ny > h + OOB) {
						wy = -OOB + 10;
						wa = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
					}
					next.push({
						...p,
						x: wx,
						y: wy,
						angle: wa,
						targetAngle: wa,
						path: null,
						pathIdx: 0,
					});
					continue;
				}

				next.push({
					...p,
					x: nx,
					y: ny,
					angle: na,
					targetAngle: nTarget,
					pathIdx: nIdx,
				});
			}

			/* collision check — only flying planes (not landing) */
			const flying = next.filter((p) => !p.landing);
			for (let i = 0; i < flying.length; i++) {
				for (let j = i + 1; j < flying.length; j++) {
					const minD =
						(flying[i].type.collisionR + flying[j].type.collisionR) / 2;
					if (dist(flying[i], flying[j]) < minD) {
						gameOverRef.current = true;
						haptic.error();
						setGameOver(true);
						updateProgress("flight-path", scoreRef.current);
						setPlanes(next);
						return;
					}
				}
			}

			if (landedThisTick > 0) {
				setScore((s) => s + landedPts);
				setLanded((l) => l + landedThisTick);
			}

			setPlanes(next);
		}, TICK);

		return () => clearInterval(tick);
	}, [started, gameOver, updateProgress]);

	/* PAN RESPONDER */
	const panResponder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				onMoveShouldSetPanResponder: () => selectedRef.current !== null,
				onPanResponderGrant: (e) => {
					if (gameOverRef.current) return;
					const { locationX: lx, locationY: ly } = e.nativeEvent;
					const touch: Pt = { x: lx, y: ly };
					let best: Plane | null = null;
					let bestD = Infinity;
					for (const p of planesRef.current) {
						const d = dist(p, touch);
						if (d < (p.type.bodyH + p.type.wingW) * 1.8 && d < bestD) {
							best = p;
							bestD = d;
						}
					}
					if (best) {
						selectedRef.current = best.id;
						drawRef.current = [{ x: best.x, y: best.y }];
						setDrawPath([{ x: best.x, y: best.y }]);
					}
				},
				onPanResponderMove: (e) => {
					if (selectedRef.current === null) return;
					const { locationX: lx, locationY: ly } = e.nativeEvent;
					const pt: Pt = { x: lx, y: ly };
					const prev = drawRef.current;
					if (prev.length && dist(prev[prev.length - 1], pt) < PATH_MIN_DIST)
						return;
					drawRef.current = [...prev, pt];
					setDrawPath([...drawRef.current]);
				},
				onPanResponderRelease: () => {
					const id = selectedRef.current;
					const path = [...drawRef.current];
					if (id !== null && path.length > 2) {
						setPlanes((prev) =>
							prev.map((p) => (p.id === id ? { ...p, path, pathIdx: 0 } : p)),
						);
					}
					selectedRef.current = null;
					drawRef.current = [];
					setDrawPath([]);
				},
			}),
		[],
	);

	const restart = () => {
		nextIdRef.current = 1;
		selectedRef.current = null;
		drawRef.current = [];
		gameOverRef.current = false;
		setPlanes([]);
		setDrawPath([]);
		setScore(0);
		setLanded(0);
		setGameOver(false);
		setStarted(true);
	};

	/* ================================================================
	   RENDER
	   ================================================================ */

	if (!started) {
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("flightPathTitle")}</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("flightPathIntro")}
				</Text>
				<View
					style={s.typeList}
					lightColor="transparent"
					darkColor="transparent"
				>
					{PLANE_TYPES.map((pt) => {
						const rwyTag =
							pt.minRunway === "long"
								? "L"
								: pt.minRunway === "medium"
									? "M"
									: "S";
						const speedKey =
							pt.baseSpeed < 0.45
								? "flightPathSpeedSlow"
								: pt.baseSpeed < 0.8
									? "flightPathSpeedMedium"
									: "flightPathSpeedFast";
						return (
							<RNView key={pt.key} style={s.typeRowWrap}>
								<RNView
									style={[s.typeSwatch, { backgroundColor: pt.bodyColor }]}
								/>
								<Text style={[s.typeRow, { color: theme.text }]}>
									{pt.label} — {t(speedKey as never)} · x{pt.scoreMul} ·{" "}
									{t("flightPathRunwayReq", { tag: rwyTag })}
								</Text>
							</RNView>
						);
					})}
				</View>
				<Pressable
					style={[s.mainBtn, { backgroundColor: theme.tint }]}
					onPress={() => setStarted(true)}
				>
					<Text style={s.mainBtnText}>{t("start")}</Text>
				</Pressable>
			</View>
		);
	}

	if (gameOver) {
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("flightPathGameOverTitle")}</Text>
				<Text style={[s.finalScore, { color: theme.tint }]}>
					{t("flightPathPts", { score })}
				</Text>
				<Text style={[s.finalLanded, { color: theme.mutedText }]}>
					{t("flightPathLandedSafe", { landed })}
				</Text>
				<Pressable
					style={[s.mainBtn, { backgroundColor: theme.tint }]}
					onPress={restart}
				>
					<Text style={s.mainBtnText}>{t("flightPathTryAgain")}</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={s.root}>
			{/* stats */}
			<View style={s.statsRow}>
				<Text style={[s.stat, { color: theme.tint }]}>
					{t("flightPathLanded", { landed })}
				</Text>
				<Text style={[s.stat, { color: theme.text }]}>
					{t("flightPathScore", { score })}
				</Text>
				<Text style={[s.stat, { color: theme.mutedText }]}>
					{planes.length}/{MAX_PLANES}
				</Text>
			</View>

			{/* board */}
			<RNView
				style={[s.board, { borderColor: theme.border }]}
				onLayout={onBoardLayout}
				{...panResponder.panHandlers}
			>
				{/* radar rings */}
				{[0.25, 0.5, 0.75].map((r) => (
					<RNView
						key={r}
						pointerEvents="none"
						style={[
							s.radarRing,
							{
								width: boardSize.w * r,
								height: boardSize.w * r,
								borderRadius: (boardSize.w * r) / 2,
								left: (boardSize.w - boardSize.w * r) / 2,
								top: (boardSize.h - boardSize.w * r) / 2,
							},
						]}
					/>
				))}
				{/* radar cross */}
				<RNView
					pointerEvents="none"
					style={[s.radarH, { top: boardSize.h / 2, width: boardSize.w }]}
				/>
				<RNView
					pointerEvents="none"
					style={[s.radarV, { left: boardSize.w / 2, height: boardSize.h }]}
				/>

				{/* runways (centre, crossing) */}
				{runways.map((rwy) => (
					<RunwayStrip key={rwy.label} rwy={rwy} />
				))}

				{/* assigned path trails */}
				{planes.map((p) => {
					if (!p.path) return null;
					return p.path
						.slice(p.pathIdx)
						.filter((_, i) => i % 3 === 0)
						.map((pt, i) => (
							<RNView
								key={`t${p.id}-${i}`}
								pointerEvents="none"
								style={[
									s.dot,
									{
										left: pt.x - 2,
										top: pt.y - 2,
										backgroundColor: p.color,
										opacity: 0.35,
									},
								]}
							/>
						));
				})}

				{/* drawing trail */}
				{drawPath
					.filter((_, i) => i % 2 === 0)
					.map((pt, i) => (
						<RNView
							key={`d-${i}`}
							pointerEvents="none"
							style={[
								s.dot,
								{
									left: pt.x - 2.5,
									top: pt.y - 2.5,
									width: 5,
									height: 5,
									borderRadius: 2.5,
									backgroundColor: "#fff",
									opacity: 0.65,
								},
							]}
						/>
					))}

				{/* PLANES — drawn shapes */}
				{planes.map((p) => {
					const deg = (p.angle * 180) / Math.PI + 90;
					const sel = selectedRef.current === p.id;
					const outer = (Math.max(p.type.bodyH, p.type.wingW) + 4) * 2;
					// landing animation: shrink from 1→0.3 and fade out
					const lt = p.landing?.t ?? 0;
					const isLanding = p.landing !== null;
					const landScale = isLanding ? 1 - lt * 0.7 : 1;
					const landOpacity = isLanding ? 1 - lt * 0.6 : 1;
					return (
						<RNView
							key={p.id}
							pointerEvents="none"
							style={{
								position: "absolute",
								left: p.x - outer / 2,
								top: p.y - outer / 2,
								transform: [{ scale: landScale }],
								opacity: landOpacity,
							}}
						>
							<DrawnPlane
								type={p.type}
								angleDeg={deg}
								selected={sel}
								trailColor={p.color}
								hasPath={p.path !== null || isLanding}
							/>
							{!isLanding && <Text style={s.planeLabel}>{p.type.label}</Text>}
						</RNView>
					);
				})}
			</RNView>

			<Text style={[s.hint, { color: theme.mutedText }]}>
				{t("flightPathHint")}
			</Text>
		</View>
	);
}

/* ================================================================
   STYLES
   ================================================================ */

const s = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 16,
	},
	title: { fontSize: 28, fontWeight: "800", marginBottom: 12 },
	desc: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 14 },
	typeList: { marginBottom: 18, gap: 5 },
	typeRowWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
	typeSwatch: { width: 10, height: 10, borderRadius: 2 },
	typeRow: { fontSize: 13 },
	finalScore: { fontSize: 36, fontWeight: "800", marginBottom: 4 },
	finalLanded: { fontSize: 15, marginBottom: 24 },
	mainBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12 },
	mainBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

	statsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		width: "100%",
		paddingHorizontal: 8,
		paddingVertical: 8,
	},
	stat: { fontSize: 15, fontWeight: "700" },

	board: {
		flex: 1,
		width: "100%",
		backgroundColor: "#0a1628",
		borderRadius: 12,
		borderWidth: 1,
		overflow: "hidden",
		marginBottom: 4,
	},

	radarRing: {
		position: "absolute",
		borderWidth: 1,
		borderColor: "rgba(100,180,255,0.05)",
	},
	radarH: {
		position: "absolute",
		left: 0,
		height: 1,
		backgroundColor: "rgba(100,180,255,0.05)",
	},
	radarV: {
		position: "absolute",
		top: 0,
		width: 1,
		backgroundColor: "rgba(100,180,255,0.05)",
	},

	dot: { position: "absolute", width: 4, height: 4, borderRadius: 2 },

	planeLabel: {
		textAlign: "center",
		fontSize: 6,
		fontWeight: "700",
		color: "rgba(255,255,255,0.35)",
		letterSpacing: 0.5,
		marginTop: -2,
	},

	hint: { fontSize: 12, textAlign: "center", paddingVertical: 6 },
});
