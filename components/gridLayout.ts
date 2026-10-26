/** Column count + item width for a wrap grid that exactly fills `width`. */
export interface GridLayout {
  columns: number;
  itemWidth: number;
}

export interface GridLayoutOptions {
  /** Space between items, horizontally (and used vertically by callers). */
  gap: number;
  /** Upper bound on columns so cards don't get tiny-and-many on big tablets. */
  maxColumns: number;
  /** Lower bound on columns (phones never drop to a single column). */
  minColumns: number;
  /** Narrowest an item may get before a column is dropped. */
  minItemWidth: number;
}

/**
 * Derives a responsive grid from the container width: as many columns as fit
 * `minItemWidth` (clamped to min/max), and an item width that fills the row
 * exactly with consistent gutters. The width is floored to whole dp minus a
 * hair so rounding never pushes the last card onto the next row.
 */
export function getGridLayout(
  width: number,
  { gap, maxColumns, minColumns, minItemWidth }: GridLayoutOptions
): GridLayout {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const fit = Math.floor((safeWidth + gap) / (minItemWidth + gap));
  const columns = Math.max(minColumns, Math.min(maxColumns, fit));
  const raw = (safeWidth - gap * (columns - 1)) / columns;
  const itemWidth = Math.max(0, Math.floor(raw * 100) / 100 - 0.01);
  return { columns, itemWidth };
}

/** Profile achievement grid: 2 columns on phones, up to 5 on tablets. */
export const ACHIEVEMENT_GRID: GridLayoutOptions = {
  gap: 10,
  maxColumns: 5,
  minColumns: 2,
  minItemWidth: 140,
};
