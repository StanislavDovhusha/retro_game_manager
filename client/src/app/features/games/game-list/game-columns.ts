import type { ColumnKey } from '@shared/models';

export const ROW_HEIGHT = 46;
export const HEADER_HEIGHT = 34;

export const COLUMNS: readonly ColumnKey[] = ['name', 'tags', 'path', 'size', 'csv'];
export const DEFAULT_WIDTHS: Record<ColumnKey, number> = { name: 280,  path: 300, size: 96, csv: 200, tags: 100 };
// Minimum widths keep the content readable (checkbox column, sort icon, "125.6 GB").
export const MIN_WIDTHS: Record<ColumnKey, number> = { name: 140, path: 100, size: 84, csv: 110, tags: 100 };
export const MAX_WIDTH = 1200;

const CHECK_COLUMN = 36;
const GAP = 8; // gap-x-2
const PADDING = 16; // px-2 on both sides

export const clampWidth = (key: ColumnKey, width: number): number =>
  Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTHS[key], width)));

/** Saved widths merged with the defaults (and clamped to the allowed range). */
export function initialWidths(saved: Partial<Record<ColumnKey, number>>): Record<ColumnKey, number> {
  const out = { ...DEFAULT_WIDTHS };
  for (const key of COLUMNS) {
    const value = saved[key];
    if (typeof value === 'number') out[key] = clampWidth(key, value);
  }
  return out;
}

/** Value of `grid-template-columns`. The empty last track takes the free space, so resizing one column does not move its neighbours. */
export const gridTemplate = (widths: Record<ColumnKey, number>): string =>
  `${CHECK_COLUMN}px ${COLUMNS.map((column) => `${widths[column]}px`).join(' ')} minmax(0, 1fr)`;

/** Minimum width of the whole table content. */
export const contentWidth = (widths: Record<ColumnKey, number>): number =>
  CHECK_COLUMN + COLUMNS.reduce((sum, column) => sum + widths[column], 0) + GAP * COLUMNS.length + PADDING;
