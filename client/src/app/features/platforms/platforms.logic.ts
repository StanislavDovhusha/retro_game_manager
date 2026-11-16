import type { CoverPalette } from '@shared/devices';

/**
 * Pure logic of the platform list on the main screen (no Angular here: tested from the root `tests/`).
 */

/** What a platform card shows. */
export interface PlatformCardItem {
  /** The folder name on the card (SFC). */
  readonly name: string;
  /** The full name from the console's profile, or null for a folder the profile does not know. */
  readonly label: string | null;
  readonly games: number;
  /** The translated number of games ("12 games"). */
  readonly countText: string;
  /** The colors of the default covers of the platform. */
  readonly palette: CoverPalette;
}

export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
const GRID_KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
export const isGridKey = (key: string): key is GridKey => GRID_KEYS.includes(key);

/**
 * The card the focus moves to in a grid of `count` cards laid out in rows of `columns` (the last row may be shorter).
 * Left and right go along the reading order and stop at the ends; up and down keep the column, and down from the row
 * above a shorter last row lands on its last card.
 */
export function gridMove(index: number, key: GridKey, columns: number, count: number): number {
  if (count <= 0) return -1;
  const cols = Math.max(1, Math.floor(columns));
  const last = count - 1;
  const at = Math.min(Math.max(index, 0), last);
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, at - 1);
    case 'ArrowRight':
      return Math.min(last, at + 1);
    case 'ArrowUp':
      return at - cols >= 0 ? at - cols : at;
    case 'ArrowDown':
      if (at + cols <= last) return at + cols;
      // A shorter last row: go to its last card when there is a row below.
      return Math.floor(at / cols) < Math.floor(last / cols) ? last : at;
    case 'Home':
      return 0;
    case 'End':
      return last;
  }
}

/** The number of columns: the cards in the first row share the top edge of the first card. */
export function columnsOf(tops: readonly number[]): number {
  if (!tops.length) return 1;
  const first = tops[0]!;
  let columns = 0;
  for (const top of tops) {
    if (Math.abs(top - first) > 1) break;
    columns += 1;
  }
  return columns;
}

/** A key event target where Backspace and Esc belong to the field (text inputs, selects, editable text). */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
}

/** Backspace or Esc without modifiers: back to all platforms. */
export const isBackKey = (event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean =>
  (event.key === 'Backspace' || event.key === 'Escape') && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
