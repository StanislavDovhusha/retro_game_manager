/**
 * The "Folders" / "All games" split of the left column. The saved value is a share: the part of the free height
 * that the Folders block takes. The minimum heights are px, so neither block can be squeezed to nothing.
 */
export const MIN_FOLDERS_HEIGHT = 128;
export const MIN_GAMES_HEIGHT = 128;
export const MIN_SHARE = 0.1;
export const MAX_SHARE = 0.9;
export const DEFAULT_SHARE = 0.5;
/** One press of an arrow key moves the splitter this far. */
export const KEY_STEP = 24;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** A saved or computed share, brought into the allowed range (anything that is not a number gives the default). */
export const clampShare = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, MIN_SHARE, MAX_SHARE) : DEFAULT_SHARE;

/**
 * The share of the Folders block after the splitter was moved by `delta` px (positive — down).
 * `startFolders` is the height of the Folders block when the move started, `total` — the height of both blocks together.
 * Neither block gets smaller than its minimum (in a window too small for both minimums they share the height equally).
 */
export function shareAfterMove(startFolders: number, delta: number, total: number): number {
  if (!(total > 0)) return DEFAULT_SHARE;
  const minFolders = Math.min(MIN_FOLDERS_HEIGHT, total / 2);
  const minGames = Math.min(MIN_GAMES_HEIGHT, total / 2);
  const folders = clamp(startFolders + delta, minFolders, total - minGames);
  return clampShare(folders / total);
}
