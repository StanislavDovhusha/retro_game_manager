/**
 * Layout, keyboard and placement of the language menu. Pure: unit-tested from the root tests.
 *
 * The menu is a grid of columns. Each column holds whole groups of items, one row per item, with nothing between the
 * groups. Items are numbered in reading order (column by column, top to bottom), which is also their order in the DOM.
 */

/** A group of items: kept whole in one column. */
export type MenuGroup<T> = readonly T[];

/** A column of the menu: per row, the reading-order number of its item. */
export type MenuGridColumn = readonly number[];

const columnHeight = (column: readonly MenuGroup<unknown>[]): number => column.reduce((sum, group) => sum + group.length, 0);

/**
 * Splits the groups into at most `count` columns in their order, keeping each group whole, so that the tallest column
 * is as short as possible (on a tie, the earlier columns are the taller ones). Never gives an empty column.
 */
export function splitIntoColumns<T>(groups: readonly MenuGroup<T>[], count: number): MenuGroup<T>[][] {
  const columns = Math.max(1, Math.min(Math.floor(count), groups.length));
  if (groups.length === 0) return [];
  let best: MenuGroup<T>[][] = [];
  let bestHeight = Infinity;
  (function place(from: number, left: number, done: MenuGroup<T>[][]): void {
    if (left === 1) {
      const split = [...done, groups.slice(from)];
      const height = Math.max(...split.map(columnHeight));
      if (height < bestHeight) [best, bestHeight] = [split, height];
      return;
    }
    // Later split points first: on equal heights the first found (taller earlier columns) is kept.
    for (let end = groups.length - left + 1; end > from; end -= 1) place(end, left - 1, [...done, groups.slice(from, end)]);
  })(0, columns, []);
  return best;
}

/** The grid of the columns: the reading-order number of the item in every row of each column. */
export function menuGrid(columns: readonly (readonly MenuGroup<unknown>[])[]): MenuGridColumn[] {
  let next = 0;
  return columns.map((column) => column.flatMap((group) => group.map(() => next++)));
}

function positionOf(index: number, grid: readonly MenuGridColumn[]): { column: number; row: number } | null {
  for (let column = 0; column < grid.length; column += 1) {
    const row = grid[column]!.indexOf(index);
    if (row >= 0) return { column, row };
  }
  return null;
}

const itemsOf = (column: MenuGridColumn): { row: number; index: number }[] => column.map((index, row) => ({ row, index }));

/** The item of a column nearest to a row (on a tie, the upper one). */
function nearestItem(column: MenuGridColumn, row: number): number | null {
  let best: { row: number; index: number } | null = null;
  for (const item of itemsOf(column)) if (!best || Math.abs(item.row - row) < Math.abs(best.row - row)) best = item;
  return best?.index ?? null;
}

/**
 * The item to focus after a key (WAI-ARIA menu pattern, in a grid), or null when the key does not move the focus.
 * `index` is the focused item (-1: none yet). ↑/↓ move within the column and wrap around;
 * ←/→ go to the nearest item of the neighbouring column (wrapping around; nothing with one column); Home/End (and
 * PageUp/PageDown) go to the first and the last item of the column.
 */
export function menuGridTarget(key: string, index: number, grid: readonly MenuGridColumn[]): number | null {
  const all = grid.flatMap(itemsOf);
  if (all.length === 0) return null;
  const at = positionOf(index, grid);
  if (!at) {
    if (key === 'ArrowDown' || key === 'ArrowRight' || key === 'Home' || key === 'PageUp') return all[0]!.index;
    if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'End' || key === 'PageDown') return all[all.length - 1]!.index;
    return null;
  }
  const items = itemsOf(grid[at.column]!);
  const here = items.findIndex((item) => item.index === index);
  switch (key) {
    case 'ArrowDown':
      return items[(here + 1) % items.length]!.index;
    case 'ArrowUp':
      return items[(here - 1 + items.length) % items.length]!.index;
    case 'Home':
    case 'PageUp':
      return items[0]!.index;
    case 'End':
    case 'PageDown':
      return items[items.length - 1]!.index;
    case 'ArrowRight':
    case 'ArrowLeft': {
      if (grid.length < 2) return null;
      const step = key === 'ArrowRight' ? 1 : -1;
      // A column without items (not produced by splitIntoColumns) is stepped over.
      for (let shift = 1; shift < grid.length; shift += 1) {
        const target = nearestItem(grid[(at.column + step * shift + grid.length * shift) % grid.length]!, at.row);
        if (target !== null) return target;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Typing the first letter jumps to the next language whose name starts with it (after the focused one, wrapping). */
export function menuTypeAhead(key: string, index: number, names: readonly string[]): number | null {
  if (key.length !== 1 || !key.trim()) return null;
  const letter = key.toLocaleLowerCase();
  for (let step = 1; step <= names.length; step += 1) {
    const candidate = (index + step + names.length) % names.length;
    if (names[candidate]?.toLocaleLowerCase().startsWith(letter)) return candidate;
  }
  return null;
}

/** Columns for the window width: the configured number, one in a narrow window. */
export const menuColumnCount = (viewportWidth: number, columns: number, minWidth: number): number =>
  viewportWidth >= minWidth ? columns : 1;

export interface MenuPlacement {
  /** Position of the menu's top left corner in the window. */
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
}

/**
 * Where the menu goes so that it stays inside the window: under the button, its right edge on the button's right
 * edge, moved left or right to keep `margin` pixels from the window edges. A menu wider or taller than the window gets
 * a smaller maximum size (and scrolls).
 */
export function placeMenu(
  anchor: { readonly left: number; readonly right: number; readonly bottom: number },
  menu: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  gap = 4,
  margin = 8,
): MenuPlacement {
  const maxWidth = Math.max(0, viewport.width - 2 * margin);
  const width = Math.min(menu.width, maxWidth);
  const left = Math.max(margin, Math.min(anchor.right - width, viewport.width - margin - width));
  const top = anchor.bottom + gap;
  return { left, top, maxWidth, maxHeight: Math.max(0, viewport.height - margin - top) };
}
