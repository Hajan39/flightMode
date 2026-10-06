import { useCallback, useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  View as RNView,
  StyleSheet,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

/* ================================================================
   TYPES
   ================================================================ */

interface Pt {
  x: number;
  y: number;
}

type RwySize = "long" | "medium" | "short";

interface PlaneType {
  /** base speed (px per tick) */
  baseSpeed: number;
  /** body colour */
  bodyColor: string;
  /** drawn body half-length (nose to center) */
  bodyH: number;
  /** collision radius */
  collisionR: number;
  /** has tail fin? */
  hasTail: boolean;
  key: string;
  label: string;
  /** minimum runway size this plane needs */
  minRunway: RwySize;
  /** score multiplier */
  scoreMul: number;
  /** wing colour */
  wingColor: string;
  /** drawn wing half-span (center to wingtip) */
  wingW: number;
}

const PLANE_TYPES: PlaneType[] = [
  {
    baseSpeed: 0.45,
    bodyColor: "#90CAF9",
    bodyH: 8,
    collisionR: 18,
    hasTail: false,
    key: "prop",
    label: "PROP",
    minRunway: "short",
    scoreMul: 1,
    wingColor: "#64B5F6",
    wingW: 6,
  },
  {
    baseSpeed: 0.75,
    bodyColor: "#A5D6A7",
    bodyH: 11,
    collisionR: 22,
    hasTail: true,
    key: "jet",
    label: "JET",
    minRunway: "medium",
    scoreMul: 1.5,
    wingColor: "#81C784",
    wingW: 8,
  },
  {
    baseSpeed: 0.55,
    bodyColor: "#FFE082",
    bodyH: 14,
    collisionR: 30,
    hasTail: true,
    key: "jumbo",
    label: "JUMBO",
    minRunway: "long",
    scoreMul: 2,
    wingColor: "#FFD54F",
    wingW: 14,
  },
  {
    baseSpeed: 0.38,
    bodyColor: "#FFAB91",
    bodyH: 13,
    collisionR: 28,
    hasTail: true,
    key: "cargo",
    label: "CARGO",
    minRunway: "long",
    scoreMul: 2.5,
    wingColor: "#FF8A65",
    wingW: 11,
  },
  {
    baseSpeed: 1.05,
    bodyColor: "#CE93D8",
    bodyH: 10,
    collisionR: 16,
    hasTail: false,
    key: "fighter",
    label: "FAST",
    minRunway: "long",
    scoreMul: 3,
    wingColor: "#BA68C8",
    wingW: 5,
  },
];

interface Plane {
  angle: number;
  color: string;
  id: number;
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
  path: Pt[] | null;
  pathIdx: number;
  speed: number;
  targetAngle: number;
  type: PlaneType;
  x: number;
  y: number;
}

interface IncomingWarning {
  angle: number;
  color: string;
  id: number;
  inMs: number;
  type: PlaneType;
  x: number;
  y: number;
}

interface Runway {
  /** accent color for runway acceptance family */
  accentColor: string;
  /** short readable accepted type label */
  acceptsLabel: string;
  /** center x */
  cx: number;
  /** center y */
  cy: number;
  /** half-length of the strip */
  halfLen: number;
  label: string;
  /** which endpoint index (0=A, 1=B) is the landing threshold */
  landingEnd: 0 | 1;
  /** rotation radians */
  rotation: number;
  /** size category */
  size: RwySize;
}

/** Check if a runway matches the plane type family exactly */
function canLandOn(plane: PlaneType, rwy: Runway): boolean {
  return rwy.size === plane.minRunway;
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
const SPAWN_WARNING_MS = 2000;
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
  while (d > Math.PI) {
    d -= 2 * Math.PI;
  }
  while (d < -Math.PI) {
    d += 2 * Math.PI;
  }
  return d;
}

function lerpAngle(current: number, target: number, rate: number) {
  const diff = angleDiff(current, target);
  if (Math.abs(diff) <= rate) {
    return target;
  }
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
  if (landed < 4) {
    return PLANE_TYPES[Math.random() < 0.5 ? 0 : 1];
  }
  if (landed < 10) {
    const r = Math.random();
    if (r < 0.3) {
      return PLANE_TYPES[0];
    }
    if (r < 0.65) {
      return PLANE_TYPES[1];
    }
    return PLANE_TYPES[2];
  }
  const r = Math.random();
  if (r < 0.15) {
    return PLANE_TYPES[0];
  }
  if (r < 0.4) {
    return PLANE_TYPES[1];
  }
  if (r < 0.6) {
    return PLANE_TYPES[2];
  }
  if (r < 0.8) {
    return PLANE_TYPES[3];
  }
  return PLANE_TYPES[4];
}

function buildSpawnPlan(
  board: { w: number; h: number },
  id: number,
  landed: number
) {
  const { w, h } = board;
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

  const type = pickType(landed);
  const sv = 0.85 + Math.random() * 0.3;

  return {
    a,
    color: TRAIL_COLORS[id % TRAIL_COLORS.length],
    id,
    speed: type.baseSpeed * sv,
    type,
    x,
    y,
  };
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
        alignItems: "center",
        height: outerSize,
        justifyContent: "center",
        transform: [{ rotate: `${angleDeg}deg` }],
        width: outerSize,
      }}
    >
      {/* fuselage (tall narrow rect → points "up") */}
      <RNView
        style={{
          backgroundColor: bodyColor,
          borderRadius: 2,
          height: bodyH * 2,
          position: "absolute",
          width: 4 + (type.key === "jumbo" || type.key === "cargo" ? 2 : 0),
        }}
      />
      {/* nose triangle */}
      <RNView
        style={{
          borderBottomColor: bodyColor,
          borderBottomWidth: 7,
          borderLeftColor: "transparent",
          borderLeftWidth: 4,
          borderRightColor: "transparent",
          borderRightWidth: 4,
          position: "absolute",
          top: outerSize / 2 - bodyH - 5,
        }}
      />
      {/* swept wings */}
      <RNView
        style={{
          borderLeftColor: "transparent",
          borderLeftWidth: wingW * 0.6,
          borderRightColor: "transparent",
          borderRightWidth: wingW * 0.6,
          borderTopColor: wingColor,
          borderTopWidth: 3,
          height: 0,
          position: "absolute",
          top: outerSize / 2 + bodyH * 0.15,
          width: wingW * 2,
        }}
      />
      {/* tail fin (optional) */}
      {hasTail ? (
        <RNView
          style={{
            borderLeftColor: "transparent",
            borderLeftWidth: wingW * 0.3,
            borderRightColor: "transparent",
            borderRightWidth: wingW * 0.3,
            borderTopColor: wingColor,
            borderTopWidth: 2,
            height: 0,
            opacity: 0.7,
            position: "absolute",
            top: outerSize / 2 + bodyH - 3,
            width: wingW * 0.9,
          }}
        />
      ) : null}
      {/* selection ring */}
      {selected ? (
        <RNView
          style={{
            borderColor: "#fff",
            borderRadius: outerSize / 2,
            borderWidth: 2,
            height: outerSize - 4,
            position: "absolute",
            width: outerSize - 4,
          }}
        />
      ) : null}
      {/* guide ring when unselected */}
      {!selected && (
        <RNView
          style={{
            borderColor: trailColor,
            borderRadius: outerSize / 2,
            borderWidth: 1.2,
            height: outerSize - 6,
            opacity: hasPath ? 0.35 : 0.6,
            position: "absolute",
            width: outerSize - 6,
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
  let sizeTag = "S";
  if (rwy.size === "long") {
    sizeTag = "L";
  } else if (rwy.size === "medium") {
    sizeTag = "M";
  }

  return (
    <RNView
      pointerEvents="none"
      style={{
        alignItems: "center",
        height: 16,
        justifyContent: "center",
        left: rwy.cx - rwy.halfLen,
        position: "absolute",
        top: rwy.cy - 8,
        transform: [{ rotate: `${deg}deg` }],
        width: len,
      }}
    >
      {/* outer strip */}
      <RNView
        style={{
          alignItems: "center",
          backgroundColor: `${rwy.accentColor}20`,
          borderColor: `${rwy.accentColor}88`,
          borderRadius: 2,
          borderWidth: 1,
          flexDirection: "row",
          height: 12,
          justifyContent: "space-evenly",
          width: len,
        }}
      >
        {Array.from({ length: DASHES }).map((_, i) => (
          <RNView
            key={`${rwy.label}-dash-${i}`}
            style={{
              backgroundColor: `${rwy.accentColor}CC`,
              borderRadius: 1,
              height: 2,
              width: len / DASHES - 6,
            }}
          />
        ))}
      </RNView>
      {/* landing threshold — green marker on the landing end */}
      <RNView
        style={{
          position: "absolute",
          ...(rwy.landingEnd === 0 ? { left: 0 } : { right: 0 }),
          backgroundColor: `${rwy.accentColor}`,
          borderRadius: 1,
          height: 14,
          width: 6,
        }}
      />
      {/* far end — dim marker */}
      <RNView
        style={{
          position: "absolute",
          ...(rwy.landingEnd === 0 ? { right: 0 } : { left: 0 }),
          backgroundColor: `${rwy.accentColor}66`,
          borderRadius: 1,
          height: 10,
          width: 3,
        }}
      />
      {/* label */}
      <Text
        style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 7,
          fontWeight: "800",
          position: "absolute",
          top: -10,
          // counter-rotate the label so it stays readable
          transform: [{ rotate: `${-deg}deg` }],
        }}
      >
        {rwy.label} {sizeTag} · {rwy.acceptsLabel}
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
  const updateProgress = useGameStore((state) => state.updateProgress);
  const storedBest = useGameStore(
    (state) => state.progress["flight-path"]?.highScore ?? 0
  );

  const [boardSize, setBoardSize] = useState({ h: 500, w: 300 });
  const boardRef = useRef({ h: 500, w: 300 });

  const [planes, setPlanes] = useState<Plane[]>([]);
  const [incoming, setIncoming] = useState<IncomingWarning[]>([]);
  const [drawPath, setDrawPath] = useState<Pt[]>([]);
  const [score, setScore] = useState(0);
  const [landed, setLanded] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progressInfo, setProgressInfo] = useState<
    import("@/types/game").GameProgressUpdate | null
  >(null);

  const planesRef = useRef<Plane[]>([]);
  const incomingRef = useRef<IncomingWarning[]>([]);
  const selectedRef = useRef<number | null>(null);
  const drawRef = useRef<Pt[]>([]);
  const scoreRef = useRef(0);
  const landedRef = useRef(0);
  const gameOverRef = useRef<boolean>(false);
  const nextIdRef = useRef(1);
  const hapticErrorRef = useRef(haptic.error);
  hapticErrorRef.current = haptic.error;

  useEffect(() => {
    planesRef.current = planes;
  }, [planes]);
  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    landedRef.current = landed;
  }, [landed]);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  /* landed-counter pop — fires only on the discrete landing event */
  const landedScale = useSharedValue(1);
  useEffect(() => {
    if (landed === 0) {
      return;
    }
    landedScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withTiming(1, { duration: 140 })
    );
  }, [landed, landedScale]);
  const landedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: landedScale.value }],
  }));

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoardSize({ h: height, w: width });
    boardRef.current = { h: height, w: width };
  };

  /* ---- RUNWAYS — centered, crossing, different lengths ---- */
  const runways: Runway[] = (() => {
    const { w, h } = boardSize;
    const cx = w / 2;
    const cy = h * 0.52;
    const base = Math.min(w, h) * 0.32;
    return [
      // LONG — horizontal, for jumbo/cargo/fighter
      {
        accentColor: "#FFD54F",
        acceptsLabel: "JUMBO/CARGO/FAST",
        cx,
        cy,
        halfLen: base * 1.15,
        label: "09L",
        landingEnd: 0 as const,
        rotation: 0,
        size: "long" as RwySize,
      },
      // MEDIUM — ~55° diagonal, for jet+
      {
        accentColor: "#81C784",
        acceptsLabel: "JET",
        cx,
        cy,
        halfLen: base * 0.8,
        label: "27R",
        landingEnd: 0 as const,
        rotation: 0.96,
        size: "medium" as RwySize,
      },
      // SHORT — ~-40° diagonal, for prop (any can use)
      {
        accentColor: "#64B5F6",
        acceptsLabel: "PROP",
        cx,
        cy,
        halfLen: base * 0.6,
        label: "14C",
        landingEnd: 1 as const,
        rotation: -0.7,
        size: "short" as RwySize,
      },
    ];
  })();
  const runwaysRef = useRef(runways);
  runwaysRef.current = runways;

  /* schedule incoming telegraph from edges */
  const scheduleIncoming = useCallback(() => {
    if (gameOverRef.current) {
      return;
    }
    if (planesRef.current.length + incomingRef.current.length >= MAX_PLANES) {
      return;
    }
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    const plan = buildSpawnPlan(boardRef.current, id, landedRef.current);

    setIncoming((prev) => [
      ...prev,
      {
        angle: plan.a,
        color: plan.color,
        id: plan.id,
        inMs: SPAWN_WARNING_MS,
        type: plan.type,
        x: plan.x,
        y: plan.y,
      },
    ]);
  }, []);

  const spawnMs = Math.max(
    900,
    3500 - landed * 100 - Math.floor(landed / 5) * 80
  );

  useEffect(() => {
    if (!started || gameOver || paused) {
      return;
    }
    scheduleIncoming();
    const intervalId = setInterval(scheduleIncoming, spawnMs);
    return () => clearInterval(intervalId);
  }, [started, gameOver, spawnMs, paused, scheduleIncoming]);

  useEffect(() => {
    if (!started || gameOver || paused) {
      return;
    }

    const telegraphId = setInterval(() => {
      const toSpawn: IncomingWarning[] = [];
      setIncoming((prev) => {
        const keep: IncomingWarning[] = [];
        for (const item of prev) {
          const nextMs = item.inMs - TICK;
          if (nextMs <= 0) {
            toSpawn.push(item);
          } else {
            keep.push({ ...item, inMs: nextMs });
          }
        }
        return keep;
      });

      if (toSpawn.length === 0) {
        return;
      }
      setPlanes((prev) => {
        const next = [...prev];
        for (const incomingPlane of toSpawn) {
          if (next.length >= MAX_PLANES) {
            break;
          }
          next.push({
            angle: incomingPlane.angle,
            color: incomingPlane.color,
            id: incomingPlane.id,
            landing: null,
            path: null,
            pathIdx: 0,
            speed: incomingPlane.type.baseSpeed * (0.85 + Math.random() * 0.3),
            targetAngle: incomingPlane.angle,
            type: incomingPlane.type,
            x: incomingPlane.x,
            y: incomingPlane.y,
          });
        }
        return next;
      });
    }, TICK);

    return () => clearInterval(telegraphId);
  }, [started, gameOver, paused]);

  /* ---- GAME LOOP ---- */
  useEffect(() => {
    if (!started || gameOver || paused) {
      return;
    }

    const tick = setInterval(() => {
      // Synchronous game-over guard: the interval keeps firing until the
      // effect cleanup clears it after `gameOver` state flushes; without
      // this a second tick would re-detect the collision and fire
      // updateProgress twice.
      if (gameOverRef.current) {
        return;
      }
      const { current } = planesRef;
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
            angle: runwayAngle,
            landing: { ...p.landing, t: nt },
            targetAngle: runwayAngle,
            x: from.x + (to.x - from.x) * nt,
            y: from.y + (to.y - from.y) * nt,
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
            if (!canLandOn(p.type, rwy)) {
              continue;
            }

            const [endA, endB] = rwyEndpoints(rwy);
            const pos: Pt = { x: nx, y: ny };
            // only accept landing from the designated threshold end
            const from = rwy.landingEnd === 0 ? endA : endB;
            const to = rwy.landingEnd === 0 ? endB : endA;
            const dFrom = dist(pos, from);
            const entryDist = rwy.halfLen * 2 * RWY_ENTRY_ZONE;
            if (dFrom < entryDist + LAND_DIST) {
              const runwayAngle = angleTo(from, to);
              landedThisTick += 1;
              landedPts += Math.round(BASE_PTS * p.type.scoreMul);
              next.push({
                ...p,
                angle: runwayAngle,
                landing: { from, runwayAngle, t: 0, to },
                path: null,
                targetAngle: runwayAngle,
                x: from.x,
                y: from.y,
              });
              startedLanding = true;
              break;
            }
          }
        }
        if (startedLanding) {
          continue;
        }

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
            angle: wa,
            path: null,
            pathIdx: 0,
            targetAngle: wa,
            x: wx,
            y: wy,
          });
          continue;
        }

        next.push({
          ...p,
          angle: na,
          pathIdx: nIdx,
          targetAngle: nTarget,
          x: nx,
          y: ny,
        });
      }

      /* collision check — only flying planes (not landing) */
      const flying = next.filter((p) => !p.landing);
      for (let i = 0; i < flying.length; i += 1) {
        for (let j = i + 1; j < flying.length; j += 1) {
          const minD =
            (flying[i].type.collisionR + flying[j].type.collisionR) / 2;
          if (dist(flying[i], flying[j]) < minD) {
            gameOverRef.current = true;
            hapticErrorRef.current();
            setGameOver(true);
            setProgressInfo(updateProgress("flight-path", scoreRef.current));
            setPlanes(next);
            return;
          }
        }
      }

      if (landedThisTick > 0) {
        setScore((cur) => cur + landedPts);
        setLanded((l) => l + landedThisTick);
      }

      setPlanes(next);
    }, TICK);

    return () => clearInterval(tick);
  }, [started, gameOver, updateProgress, paused]);

  /* PAN RESPONDER */
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => selectedRef.current !== null,
    onPanResponderGrant: (e) => {
      if (gameOverRef.current) {
        return;
      }
      const { locationX: lx, locationY: ly } = e.nativeEvent;
      const touch: Pt = { x: lx, y: ly };
      let best: Plane | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      for (const p of planesRef.current) {
        const d = dist(p, touch);
        if (d < (p.type.bodyH + p.type.wingW) * 1.8 && d < bestD) {
          best = p;
          bestD = d;
        }
      }
      if (best) {
        selectedRef.current = best.id;
        const start: Pt = { x: best.x, y: best.y };
        const selectedId = best.id;
        drawRef.current = [start];
        setDrawPath([start]);
        // Immediately assign the path so the plane starts following right away
        setPlanes((prev) =>
          prev.map((p) =>
            p.id === selectedId ? { ...p, path: [start], pathIdx: 0 } : p
          )
        );
      }
    },
    onPanResponderMove: (e) => {
      if (selectedRef.current === null) {
        return;
      }
      const { locationX: lx, locationY: ly } = e.nativeEvent;
      const pt: Pt = { x: lx, y: ly };
      const prev = drawRef.current;
      const lastPt = prev.at(-1);
      if (lastPt && dist(lastPt, pt) < PATH_MIN_DIST) {
        return;
      }
      const updated = [...prev, pt];
      drawRef.current = updated;
      setDrawPath([...updated]);
      // Update the plane's path in real-time so it follows while drawing
      const id = selectedRef.current;
      setPlanes((planesPrev) =>
        planesPrev.map((p) => (p.id === id ? { ...p, path: [...updated] } : p))
      );
    },
    onPanResponderRelease: () => {
      selectedRef.current = null;
      drawRef.current = [];
      setDrawPath([]);
    },
    onStartShouldSetPanResponder: () => true,
  });

  const restart = () => {
    nextIdRef.current = 1;
    selectedRef.current = null;
    drawRef.current = [];
    gameOverRef.current = false;
    setPlanes([]);
    setIncoming([]);
    setDrawPath([]);
    setScore(0);
    setLanded(0);
    setGameOver(false);
    setStarted(true);
    setPaused(false);
    setProgressInfo(null);
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
          darkColor="transparent"
          lightColor="transparent"
          style={s.typeList}
        >
          {PLANE_TYPES.map((pt, i) => {
            let rwyTag = "S";
            if (pt.minRunway === "long") {
              rwyTag = "L";
            } else if (pt.minRunway === "medium") {
              rwyTag = "M";
            }
            let speedKey = "flightPathSpeedFast";
            if (pt.baseSpeed < 0.45) {
              speedKey = "flightPathSpeedSlow";
            } else if (pt.baseSpeed < 0.8) {
              speedKey = "flightPathSpeedMedium";
            }
            return (
              <Animated.View
                entering={FadeInDown.delay(i * 40).duration(200)}
                key={pt.key}
                style={s.typeRowWrap}
              >
                <RNView
                  style={[s.typeSwatch, { backgroundColor: pt.bodyColor }]}
                />
                <Text style={[s.typeRow, { color: theme.text }]}>
                  {pt.label} — {t(speedKey as never)} · x{pt.scoreMul} ·{" "}
                  {t("flightPathRunwayReq", { tag: rwyTag })}
                </Text>
              </Animated.View>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel={t("start")}
          accessibilityRole="button"
          onPress={() => setStarted(true)}
          style={[s.mainBtn, { backgroundColor: theme.tint }]}
        >
          <Text style={[s.mainBtnText, { color: theme.onTint }]}>
            {t("start")}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (gameOver) {
    return (
      <View style={s.root}>
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={score}
          streak={progressInfo?.currentStreak}
          subtitle={t("flightPathLandedSafe", { landed })}
          title={t("flightPathGameOverTitle")}
        />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* header: best + controls */}
      <RNView style={s.headerRow}>
        <RNView style={[s.bestPill, { backgroundColor: theme.card }]}>
          <Text style={[s.bestLabel, { color: theme.mutedText }]}>
            {t("gameBest")}
          </Text>
          <Text style={[s.bestValue, { color: theme.tint }]}>{storedBest}</Text>
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={gameOver ? undefined : () => setPaused(true)}
          onReset={restart}
        />
      </RNView>

      {/* stats */}
      <View style={s.statsRow}>
        <Animated.View style={landedStyle}>
          <Text style={[s.stat, { color: theme.tint }]}>
            {t("flightPathLanded", { landed })}
          </Text>
        </Animated.View>
        <Text style={[s.stat, { color: theme.text }]}>
          {t("flightPathScore", { score })}
        </Text>
        <Text style={[s.stat, { color: theme.mutedText }]}>
          {planes.length}/{MAX_PLANES}
        </Text>
      </View>

      <RNView style={s.runwayLegendRow}>
        {runways.map((rwy) => (
          <RNView key={`legend-${rwy.label}`} style={s.runwayLegendItem}>
            <RNView
              style={[
                s.runwayLegendSwatch,
                { backgroundColor: rwy.accentColor },
              ]}
            />
            <Text style={[s.runwayLegendText, { color: theme.mutedText }]}>
              {rwy.label}: {rwy.acceptsLabel}
            </Text>
          </RNView>
        ))}
      </RNView>

      {/* board */}
      <RNView
        onLayout={onBoardLayout}
        style={[s.board, { borderColor: theme.border }]}
        {...panResponder.panHandlers}
      >
        {/* radar rings */}
        {[0.25, 0.5, 0.75].map((r) => (
          <RNView
            key={`ring-${r}`}
            pointerEvents="none"
            style={[
              s.radarRing,
              {
                borderRadius: (boardSize.w * r) / 2,
                height: boardSize.w * r,
                left: (boardSize.w - boardSize.w * r) / 2,
                top: (boardSize.h - boardSize.w * r) / 2,
                width: boardSize.w * r,
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
          style={[s.radarV, { height: boardSize.h, left: boardSize.w / 2 }]}
        />

        {/* runways (centre, crossing) */}
        {runways.map((rwy) => (
          <RunwayStrip key={rwy.label} rwy={rwy} />
        ))}

        {/* incoming telegraph markers (spawn in ~2s) */}
        {incoming.map((inc) => {
          const sec = Math.max(1, Math.ceil(inc.inMs / 1000));
          return (
            <RNView
              key={`inc-${inc.id}`}
              pointerEvents="none"
              style={{
                alignItems: "center",
                backgroundColor: `${inc.type.bodyColor}22`,
                borderColor: inc.type.bodyColor,
                borderRadius: 16,
                borderWidth: 2,
                height: 32,
                justifyContent: "center",
                left: inc.x - 16,
                position: "absolute",
                top: inc.y - 16,
                width: 32,
              }}
            >
              <Text style={s.incomingText}>{sec}s</Text>
            </RNView>
          );
        })}

        {/* assigned path trails */}
        {planes.map((p) => {
          if (!p.path) {
            return null;
          }
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
                    backgroundColor: p.color,
                    left: pt.x - 2,
                    opacity: 0.35,
                    top: pt.y - 2,
                  },
                ]}
              />
            ));
        })}

        {/* drawing trail */}
        {drawPath
          .filter((_, i) => i % 2 === 0)
          .map((pt) => (
            <RNView
              key={`d-${pt.x.toFixed(1)}-${pt.y.toFixed(1)}`}
              pointerEvents="none"
              style={[
                s.dot,
                {
                  backgroundColor: "#fff",
                  borderRadius: 2.5,
                  height: 5,
                  left: pt.x - 2.5,
                  opacity: 0.65,
                  top: pt.y - 2.5,
                  width: 5,
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
                left: p.x - outer / 2,
                opacity: landOpacity,
                position: "absolute",
                top: p.y - outer / 2,
                transform: [{ scale: landScale }],
              }}
            >
              <DrawnPlane
                angleDeg={deg}
                hasPath={p.path !== null || isLanding}
                selected={sel}
                trailColor={p.color}
                type={p.type}
              />
              {!isLanding && <Text style={s.planeLabel}>{p.type.label}</Text>}
            </RNView>
          );
        })}
      </RNView>

      <Text style={[s.hint, { color: theme.mutedText }]}>
        {t("flightPathHint")}
      </Text>

      <GamePauseOverlay
        onRestart={restart}
        onResume={() => setPaused(false)}
        visible={paused}
      />
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
    backgroundColor: "#0a1628",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    marginBottom: 4,
    overflow: "hidden",
    width: "100%",
  },
  desc: { fontSize: 15, lineHeight: 22, marginBottom: 14, textAlign: "center" },

  dot: { borderRadius: 2, height: 4, position: "absolute", width: 4 },
  finalLanded: { fontSize: 15, marginBottom: 24 },
  finalScore: { fontSize: 36, fontWeight: "800", marginBottom: 4 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    width: "100%",
  },

  hint: { fontSize: 12, paddingVertical: 6, textAlign: "center" },
  incomingText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },
  mainBtn: { borderRadius: 12, paddingHorizontal: 40, paddingVertical: 14 },
  mainBtnText: { fontSize: 16, fontWeight: "700" },

  planeLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 6,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: -2,
    textAlign: "center",
  },
  radarH: {
    backgroundColor: "rgba(100,180,255,0.05)",
    height: 1,
    left: 0,
    position: "absolute",
  },

  radarRing: {
    borderColor: "rgba(100,180,255,0.05)",
    borderWidth: 1,
    position: "absolute",
  },
  radarV: {
    backgroundColor: "rgba(100,180,255,0.05)",
    position: "absolute",
    top: 0,
    width: 1,
  },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  runwayLegendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  runwayLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 6,
    paddingHorizontal: 8,
    width: "100%",
  },
  runwayLegendSwatch: {
    borderRadius: 2,
    height: 8,
    width: 8,
  },
  runwayLegendText: {
    fontSize: 9,
    fontWeight: "700",
  },
  stat: { fontSize: 15, fontWeight: "700" },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: "100%",
  },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 12 },
  typeList: { gap: 5, marginBottom: 18 },
  typeRow: { fontSize: 13 },
  typeRowWrap: { alignItems: "center", flexDirection: "row", gap: 8 },
  typeSwatch: { borderRadius: 2, height: 10, width: 10 },
});
