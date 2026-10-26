// Pure, React-free 2048 grid logic — extracted from the component so a move
// can be computed from current state outside any setState updater (and
// unit-tested).

export const GRID_SIZE = 4;

export type Grid = number[][];

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(0));
}

export function getEmptyCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (grid[r][c] === 0) {
        cells.push([r, c]);
      }
    }
  }
  return cells;
}

export function addRandomTile(
  grid: Grid,
  rng: () => number = Math.random
): Grid {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) {
    return grid;
  }
  const [r, c] = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  const next = grid.map((row) => [...row]);
  next[r][c] = value;
  return next;
}

export function createInitialGrid(): Grid {
  let grid = createEmptyGrid();
  grid = addRandomTile(grid);
  grid = addRandomTile(grid);
  return grid;
}

/**
 * Slide a single row/line toward the left (index 0).
 * Returns { line, score, moved }.
 */
export function slideLine(line: number[]): {
  line: number[];
  score: number;
  moved: boolean;
} {
  const filtered = line.filter((v) => v !== 0);
  let score = 0;
  let moved = false;
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i += 1;
    }
  }
  // Pad with zeros
  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }
  // Check if anything changed
  for (let j = 0; j < GRID_SIZE; j += 1) {
    if (merged[j] !== line[j]) {
      moved = true;
      break;
    }
  }
  return { line: merged, moved, score };
}

export type Direction = "left" | "right" | "up" | "down";

export function applyMove(
  grid: Grid,
  direction: Direction
): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let anyMoved = false;
  const next = createEmptyGrid();

  if (direction === "left") {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const { line, score, moved } = slideLine(grid[r]);
      next[r] = line;
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  } else if (direction === "right") {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const reversed = [...grid[r]].reverse();
      const { line, score, moved } = slideLine(reversed);
      next[r] = line.reverse();
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  } else if (direction === "up") {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const col = grid.map((row) => row[c]);
      const { line, score, moved } = slideLine(col);
      for (let r = 0; r < GRID_SIZE; r += 1) {
        next[r][c] = line[r];
      }
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  } else {
    // down
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const col = grid.map((row) => row[c]).reverse();
      const { line, score, moved } = slideLine(col);
      const reversed = line.reverse();
      for (let r = 0; r < GRID_SIZE; r += 1) {
        next[r][c] = reversed[r];
      }
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  }

  return { grid: next, moved: anyMoved, score: totalScore };
}

export function hasWon(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (grid[r][c] >= 2048) {
        return true;
      }
    }
  }
  return false;
}

export function isGameOver(grid: Grid): boolean {
  // Any empty cell?
  if (getEmptyCells(grid).length > 0) {
    return false;
  }
  // Any adjacent equal tiles?
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const v = grid[r][c];
      if (c + 1 < GRID_SIZE && grid[r][c + 1] === v) {
        return false;
      }
      if (r + 1 < GRID_SIZE && grid[r + 1][c] === v) {
        return false;
      }
    }
  }
  return true;
}

export interface MoveOutcome {
  /** Points scored by merges this move. */
  gained: number;
  /** Grid after the slide plus the new random tile (unchanged if !moved). */
  grid: Grid;
  moved: boolean;
  /** No legal move left after this one. */
  over: boolean;
  /** A 2048 tile exists after this move. */
  reached2048: boolean;
}

/** One full turn: slide, then spawn a tile if anything moved. */
export function playMove(
  grid: Grid,
  direction: Direction,
  rng: () => number = Math.random
): MoveOutcome {
  const slid = applyMove(grid, direction);
  if (!slid.moved) {
    return { gained: 0, grid, moved: false, over: false, reached2048: false };
  }
  const withNew = addRandomTile(slid.grid, rng);
  return {
    gained: slid.score,
    grid: withNew,
    moved: true,
    over: isGameOver(withNew),
    reached2048: hasWon(withNew),
  };
}
