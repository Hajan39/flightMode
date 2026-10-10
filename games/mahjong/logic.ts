// ─── Mahjong solitaire — pure logic ─────────────────────────────────────────
//
// No React / React Native imports: everything here is unit-tested. Randomness
// comes only from an injected `rng`, so tests can replay a deal exactly.
//
// Coordinates are in half-tile units: a tile at (x, y) covers x..x+2 and
// y..y+2, so a layer can sit half a tile off the one below it.

export type Rng = () => number;

export interface Slot {
  x: number;
  y: number;
  z: number;
}

export interface Tile extends Slot {
  face: number;
  /** Stable index of the slot in its layout. */
  id: number;
}

/** Remaining tiles; removed tiles are simply gone from the array. */
export type Board = Tile[];

export type LayoutId = "easy" | "turtle" | "jet";

/** Travel-themed faces with their tile colours. */
export const FACES: readonly { color: string; emoji: string }[] = [
  { color: "#3B82F6", emoji: "✈️" },
  { color: "#EF4444", emoji: "🧳" },
  { color: "#10B981", emoji: "🗺️" },
  { color: "#F59E0B", emoji: "🏝️" },
  { color: "#8B5CF6", emoji: "🗼" },
  { color: "#14B8A6", emoji: "🗽" },
  { color: "#64748B", emoji: "🏔️" },
  { color: "#DC2626", emoji: "🌋" },
  { color: "#D97706", emoji: "🐫" },
  { color: "#374151", emoji: "🐼" },
  { color: "#F43F5E", emoji: "🍣" },
  { color: "#EA580C", emoji: "🍕" },
  { color: "#CA8A04", emoji: "🥐" },
  { color: "#65A30D", emoji: "🌮" },
  { color: "#7C3AED", emoji: "🎫" },
  { color: "#0891B2", emoji: "🧭" },
  { color: "#2563EB", emoji: "🌍" },
  { color: "#4F46E5", emoji: "🌙" },
  { color: "#EAB308", emoji: "☀️" },
  { color: "#0EA5E9", emoji: "⛅" },
  { color: "#059669", emoji: "🌴" },
  { color: "#B45309", emoji: "🏰" },
  { color: "#DB2777", emoji: "🎡" },
  { color: "#0F766E", emoji: "🚆" },
];

interface LayerSpec {
  /** Half-tile offsets of the whole layer. */
  dx?: number;
  dy?: number;
  /** `#` = tile, anything else = empty; one char per whole tile. */
  rows: string[];
}

function parseLayers(layers: LayerSpec[]): Slot[] {
  const slots: Slot[] = [];
  layers.forEach((layer, z) => {
    layer.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c += 1) {
        if (row[c] === "#") {
          slots.push({
            x: c * 2 + (layer.dx ?? 0),
            y: r * 2 + (layer.dy ?? 0),
            z,
          });
        }
      }
    });
  });
  return slots;
}

export const LAYOUT_IDS: LayoutId[] = ["easy", "turtle", "jet"];

export const LAYOUTS: Record<LayoutId, Slot[]> = {
  // 48 tiles: a low island with a raised centre.
  easy: parseLayers([
    { rows: ["########", ".######.", "########", ".######.", "########"] },
    { rows: ["........", "..####..", "..####..", "..####..", "........"] },
  ]),
  // 78 tiles: an airliner seen from above.
  jet: parseLayers([
    {
      rows: [
        "....##....",
        "....##....",
        "...####...",
        ".########.",
        "##########",
        "....##....",
        "....##....",
        "..######..",
        "....##....",
      ],
    },
    {
      rows: [
        "..........",
        "....##....",
        "....##....",
        "..######..",
        "..######..",
        "....##....",
        "....##....",
        "...####...",
      ],
    },
    {
      dy: 4,
      rows: [
        "....##....",
        "....##....",
        "....##....",
        "....##....",
        "....##....",
      ],
    },
    { dy: 6, rows: ["....##....", "....##....", "....##...."] },
  ]),
  // 84 tiles: a phone-sized turtle — 4 layers and a single cap tile.
  turtle: parseLayers([
    {
      rows: [
        ".########.",
        "..######..",
        ".########.",
        "##########",
        ".########.",
        "..######..",
        ".########.",
      ],
    },
    {
      dy: 2,
      rows: [
        "...####...",
        "...####...",
        "...####...",
        "...####...",
        "...####...",
      ],
    },
    { dx: 1, dy: 4, rows: ["...###....", "...###....", "...###...."] },
    { dx: 9, dy: 6, rows: ["#"] },
  ]),
};

/* ---------------------------------------------------------------- rules */

const touchesRow = (a: Slot, b: Slot) => Math.abs(a.y - b.y) < 2;

/** Free = nothing on top and the left or the right side open. */
export function isFree(tiles: readonly Slot[], t: Slot): boolean {
  let left = false;
  let right = false;
  for (const o of tiles) {
    if (o === t || !touchesRow(o, t)) {
      continue;
    }
    if (o.z > t.z && Math.abs(o.x - t.x) < 2) {
      return false;
    }
    if (o.z === t.z) {
      if (o.x === t.x - 2) {
        left = true;
      } else if (o.x === t.x + 2) {
        right = true;
      }
    }
  }
  return !(left && right);
}

export function canMatch(board: Board, a: Tile, b: Tile): boolean {
  return (
    a.id !== b.id && a.face === b.face && isFree(board, a) && isFree(board, b)
  );
}

/** Every pair of free tiles with the same face, as tile ids. */
export function findPairs(board: Board): [number, number][] {
  const free = board.filter((t) => isFree(board, t));
  const pairs: [number, number][] = [];
  for (let i = 0; i < free.length; i += 1) {
    for (let j = i + 1; j < free.length; j += 1) {
      if (free[i].face === free[j].face) {
        pairs.push([free[i].id, free[j].id]);
      }
    }
  }
  return pairs;
}

export function removePair(board: Board, a: number, b: number): Board {
  return board.filter((t) => t.id !== a && t.id !== b);
}

/* ------------------------------------------------------------ dealing */

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pick = <T>(items: readonly T[], rng: Rng): T =>
  items[Math.floor(rng() * items.length)];

/** Horizontal runs (same layer, same row band) — union-find over side neighbours. */
function segments(slots: readonly Slot[]): number[] {
  const parent = slots.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) {
      r = parent[r];
    }
    return r;
  };
  slots.forEach((a, i) => {
    slots.forEach((b, j) => {
      if (
        j > i &&
        a.z === b.z &&
        touchesRow(a, b) &&
        Math.abs(a.x - b.x) === 2
      ) {
        parent[root(j)] = root(i);
      }
    });
  });
  return slots.map((_, i) => root(i));
}

/**
 * Pairs the slots into a removal order that clears the board: builds the
 * board in reverse, adding two tiles at a time that would both be free.
 * Rows grow outward from their first tile (a gap could never be filled) and
 * a tile is only added once everything under it is in place. Returns slot
 * index pairs in removal order, or null if every attempt got stuck.
 */
export function pairUp(
  slots: readonly Slot[],
  rng: Rng,
  attempts = 200
): [number, number][] | null {
  const seg = segments(slots);
  const below = slots.map((s) =>
    slots
      .map((_, i) => i)
      .filter(
        (i) =>
          slots[i].z < s.z &&
          touchesRow(slots[i], s) &&
          Math.abs(slots[i].x - s.x) < 2
      )
  );
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const placed = new Array<boolean>(slots.length).fill(false);
    const segUsed = new Set<number>();
    const board: Slot[] = [];
    const order: [number, number][] = [];

    const placeable = (i: number) => {
      if (placed[i] || !below[i].every((j) => placed[j])) {
        return false;
      }
      const s = slots[i];
      const grows =
        !segUsed.has(seg[i]) ||
        board.some(
          (o) => o.z === s.z && touchesRow(o, s) && Math.abs(o.x - s.x) === 2
        );
      return grows && isFree([...board, s], s);
    };
    const place = (i: number) => {
      placed[i] = true;
      segUsed.add(seg[i]);
      board.push(slots[i]);
    };

    let stuck = false;
    while (board.length < slots.length && !stuck) {
      const firsts = slots.map((_, i) => i).filter(placeable);
      if (firsts.length < 2) {
        stuck = true;
        break;
      }
      const a = pick(firsts, rng);
      place(a);
      const seconds = slots
        .map((_, i) => i)
        .filter((i) => placeable(i) && isFree([...board, slots[i]], slots[a]));
      if (seconds.length === 0) {
        stuck = true;
        break;
      }
      const b = pick(seconds, rng);
      place(b);
      order.push([a, b]);
    }
    if (!stuck) {
      return order.reverse();
    }
  }
  return null;
}

export interface Deal {
  board: Board;
  /** A removal order (tile ids) that clears the board. */
  solution: [number, number][];
}

/** A solvable deal: every face appears 4 times, a few "bonus" faces twice. */
export function deal(slots: readonly Slot[], rng: Rng): Deal {
  const solution = pairUp(slots, rng);
  if (!solution) {
    throw new Error("layout cannot be paired");
  }
  const faceOrder = shuffled(
    FACES.map((_, i) => i),
    rng
  );
  const pairFaces = shuffled(
    solution.map((_, k) => faceOrder[Math.floor(k / 2) % FACES.length]),
    rng
  );
  const board: Board = slots.map((s, id) => ({ ...s, face: -1, id }));
  solution.forEach(([a, b], k) => {
    board[a].face = pairFaces[k];
    board[b].face = pairFaces[k];
  });
  return { board, solution };
}

/**
 * Re-deals the faces still on the board onto the same tiles. Prefers a fully
 * solvable arrangement; if none is found it at least guarantees one move.
 */
export function shuffleBoard(board: Board, rng: Rng): Board {
  const faces = board.map((t) => t.face).sort((a, b) => a - b);
  const facePairs: number[] = [];
  for (let i = 0; i + 1 < faces.length; i += 2) {
    facePairs.push(faces[i]);
  }
  const order = pairUp(board, rng, 60);
  if (order) {
    const pairFaces = shuffled(facePairs, rng);
    const next = board.map((t) => ({ ...t }));
    order.forEach(([a, b], k) => {
      next[a].face = pairFaces[k];
      next[b].face = pairFaces[k];
    });
    return next;
  }
  // ponytail: fallback only ensures one move; the reverse builder above
  // handles every board reachable in these layouts in practice.
  const mixed = shuffled(faces, rng);
  const next = board.map((t, i) => ({ ...t, face: mixed[i] }));
  const free = next.filter((t) => isFree(next, t));
  if (free.length >= 2) {
    const [a, b] = free;
    const twin = next.find((t) => t.face === a.face && t.id !== a.id);
    if (twin && twin.id !== b.id) {
      [twin.face, b.face] = [b.face, twin.face];
    }
  }
  return next;
}

/* ------------------------------------------------------------ scoring */

export const HINT_COST = 50;
export const SHUFFLE_COST = 100;

export function finalScore(
  tiles: number,
  seconds: number,
  hints: number,
  shuffles: number
): number {
  const raw =
    tiles * 20 +
    Math.max(0, 1200 - seconds * 2) -
    hints * HINT_COST -
    shuffles * SHUFFLE_COST;
  return Math.max(tiles, raw);
}

/** Bounding box of a layout in half-tile units (for sizing the board). */
export function extent(slots: readonly Slot[]) {
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  for (const s of slots) {
    maxX = Math.max(maxX, s.x + 2);
    maxY = Math.max(maxY, s.y + 2);
    maxZ = Math.max(maxZ, s.z);
  }
  return { maxX, maxY, maxZ };
}
