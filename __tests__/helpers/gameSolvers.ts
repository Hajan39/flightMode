/**
 * Small, game-agnostic solvers used by the smoke-test drivers to finish
 * puzzle games through the UI. They only see what the screen shows (read via
 * accessibility labels / text), never the game's internal state.
 */

/** Lights Out (cross toggle) over GF(2): which cells to tap to switch all off. */
export function solveLightsOut(on: boolean[], size: number): number[] {
  const n = size * size;
  const rows: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row = new Array(n + 1).fill(0);
    const r = Math.floor(i / size);
    const c = i % size;
    for (const [dr, dc] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
        row[rr * size + cc] = 1;
      }
    }
    row[n] = on[i] ? 1 : 0;
    rows.push(row);
  }
  const pivots: number[] = [];
  let pr = 0;
  for (let col = 0; col < n && pr < n; col += 1) {
    const sel = rows.findIndex((row, idx) => idx >= pr && row[col] === 1);
    if (sel < 0) {
      continue;
    }
    [rows[pr], rows[sel]] = [rows[sel], rows[pr]];
    for (let i = 0; i < n; i += 1) {
      if (i !== pr && rows[i][col] === 1) {
        for (let k = col; k <= n; k += 1) {
          rows[i][k] ^= rows[pr][k];
        }
      }
    }
    pivots.push(col);
    pr += 1;
  }
  const taps: number[] = [];
  pivots.forEach((col, i) => {
    if (rows[i][n] === 1) {
      taps.push(col);
    }
  });
  return taps;
}

/**
 * Stack-sort: columns (bottom → top) + goal length. Moves: top → goal when it
 * is the next number; top → another column when that is empty or has a
 * bigger top and room. Returns [from, to] moves, `to = -1` = goal.
 */
export function solveStackSort(
  columns: number[][],
  goalLen: number,
  total: number,
  maxStack: number
): [number, number][] | null {
  const key = (cols: number[][], g: number) =>
    `${g}|${cols.map((c) => c.join(",")).join("/")}`;
  const start = { cols: columns, g: goalLen, path: [] as [number, number][] };
  const queue = [start];
  const seen = new Set([key(columns, goalLen)]);
  while (queue.length > 0) {
    const cur = queue.shift() as typeof start;
    if (cur.g === total) {
      return cur.path;
    }
    cur.cols.forEach((src, i) => {
      const top = src.at(-1);
      if (top === undefined) {
        return;
      }
      const targets: number[] = top === cur.g + 1 ? [-1] : [];
      cur.cols.forEach((dst, j) => {
        const dTop = dst.at(-1);
        if (
          j !== i &&
          dst.length < maxStack &&
          (dTop === undefined || dTop > top)
        ) {
          targets.push(j);
        }
      });
      for (const j of targets) {
        const cols = cur.cols.map((c) => [...c]);
        cols[i].pop();
        if (j >= 0) {
          cols[j].push(top);
        }
        const g = j === -1 ? cur.g + 1 : cur.g;
        const k = key(cols, g);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ cols, g, path: [...cur.path, [i, j]] });
        }
      }
    });
  }
  return null;
}

/** Plain backtracking Sudoku solver (0 = empty). */
export function solveSudoku(board: number[]): number[] | null {
  const b = [...board];
  const ok = (i: number, v: number) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (let k = 0; k < 9; k += 1) {
      if (b[r * 9 + k] === v || b[k * 9 + c] === v) {
        return false;
      }
    }
    const br = r - (r % 3);
    const bc = c - (c % 3);
    for (let dr = 0; dr < 3; dr += 1) {
      for (let dc = 0; dc < 3; dc += 1) {
        if (b[(br + dr) * 9 + bc + dc] === v) {
          return false;
        }
      }
    }
    return true;
  };
  const go = (): boolean => {
    const i = b.indexOf(0);
    if (i < 0) {
      return true;
    }
    for (let v = 1; v <= 9; v += 1) {
      if (ok(i, v)) {
        b[i] = v;
        if (go()) {
          return true;
        }
      }
    }
    b[i] = 0;
    return false;
  };
  return go() ? b : null;
}

/**
 * 15-puzzle (0 = blank): weighted A* on Manhattan distance. Not optimal, but
 * fast; returns the tile indices to tap (each tap slides that tile into the
 * blank).
 */
export function solveSlidingPuzzle(
  tiles: number[],
  size: number
): number[] | null {
  const goal = (v: number) => (v === 0 ? size * size - 1 : v - 1);
  const h = (s: number[]) => {
    let d = 0;
    s.forEach((v, i) => {
      if (v !== 0) {
        const g = goal(v);
        d +=
          Math.abs(Math.floor(g / size) - Math.floor(i / size)) +
          Math.abs((g % size) - (i % size));
      }
    });
    return d;
  };
  interface State {
    blank: number;
    cost: number;
    g: number;
    path: number[];
    s: number[];
  }
  const open: State[] = [];
  const push = (st: State) => {
    // binary heap on cost
    open.push(st);
    let i = open.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (open[p].cost <= open[i].cost) {
        break;
      }
      [open[p], open[i]] = [open[i], open[p]];
      i = p;
    }
  };
  const pop = () => {
    const [top] = open;
    const last = open.pop() as State;
    if (open.length > 0) {
      open[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < open.length && open[l].cost < open[m].cost) {
          m = l;
        }
        if (r < open.length && open[r].cost < open[m].cost) {
          m = r;
        }
        if (m === i) {
          break;
        }
        [open[m], open[i]] = [open[i], open[m]];
        i = m;
      }
    }
    return top;
  };
  const seen = new Set<string>();
  push({ blank: tiles.indexOf(0), cost: 0, g: 0, path: [], s: tiles });
  let expanded = 0;
  while (open.length > 0 && expanded < 200_000) {
    const cur = pop();
    const k = cur.s.join(",");
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    expanded += 1;
    if (h(cur.s) === 0) {
      return cur.path;
    }
    const r = Math.floor(cur.blank / size);
    const c = cur.blank % size;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) {
        continue;
      }
      const t = rr * size + cc;
      const s = [...cur.s];
      s[cur.blank] = s[t];
      s[t] = 0;
      push({
        blank: t,
        cost: cur.g + 1 + 3 * h(s),
        g: cur.g + 1,
        path: [...cur.path, t],
        s,
      });
    }
  }
  return null;
}

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

/** Start/end cell of `word` in a square letter grid, any of 8 directions. */
export function findWord(
  grid: string[],
  size: number,
  word: string
): [number, number] | null {
  for (let i = 0; i < grid.length; i += 1) {
    for (const [dr, dc] of DIRECTIONS) {
      const r0 = Math.floor(i / size);
      const c0 = i % size;
      let ok = true;
      for (let k = 0; k < word.length && ok; k += 1) {
        const r = r0 + dr * k;
        const c = c0 + dc * k;
        ok =
          r >= 0 &&
          r < size &&
          c >= 0 &&
          c < size &&
          grid[r * size + c] === word[k];
      }
      if (ok) {
        const last = word.length - 1;
        return [i, (r0 + dr * last) * size + c0 + dc * last];
      }
    }
  }
  return null;
}

/**
 * Match-3: an adjacent swap that lines up 3+ equal kinds (null = wildcard
 * tiles are skipped). Returns the two cell indices or null.
 */
export function findMatchSwap(
  kinds: (string | null)[],
  size: number
): [number, number] | null {
  const at = (b: (string | null)[], r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size ? b[r * size + c] : null;
  const lines = (b: (string | null)[], i: number) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const k = b[i];
    if (k === null) {
      return false;
    }
    let h = 1;
    for (let x = c - 1; at(b, r, x) === k; x -= 1) {
      h += 1;
    }
    for (let x = c + 1; at(b, r, x) === k; x += 1) {
      h += 1;
    }
    let v = 1;
    for (let y = r - 1; at(b, y, c) === k; y -= 1) {
      v += 1;
    }
    for (let y = r + 1; at(b, y, c) === k; y += 1) {
      v += 1;
    }
    return h >= 3 || v >= 3;
  };
  for (let i = 0; i < kinds.length; i += 1) {
    for (const j of [i + 1, i + size]) {
      if (j >= kinds.length || (j === i + 1 && j % size === 0)) {
        continue;
      }
      const b = [...kinds];
      [b[i], b[j]] = [b[j], b[i]];
      if (lines(b, i) || lines(b, j)) {
        return [i, j];
      }
    }
  }
  return null;
}
