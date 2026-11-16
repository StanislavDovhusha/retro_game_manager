import { create } from 'qrcode';

/**
 * Pure logic of the crypto slider (no Angular here: tested from the root `tests/`).
 */

/** The coins that have an address, in the order of the config. */
export const withAddress = <T extends { address: string }>(coins: readonly T[]): T[] =>
  coins.filter((coin) => coin.address.trim() !== '');

/** Index `index` moved by `step` slides, wrapping around at both ends. */
export const wrapIndex = (index: number, step: number, count: number): number =>
  count <= 0 ? 0 : (((index + step) % count) + count) % count;

/** Movement in pixels before a press becomes a swipe (a smaller one is a click). */
export const DRAG_START_PX = 8;

/**
 * Where a swipe ends: −1 back, +1 forward, 0 stay. Dragging left (negative `dx`) shows the next slide. A swipe counts
 * when it is longer than 15 % of the slide (at least 40 px) or fast (a flick).
 */
export function swipeStep(dx: number, width: number, durationMs: number): -1 | 0 | 1 {
  const distance = Math.abs(dx);
  const flick = durationMs > 0 && durationMs < 250 && distance > 20;
  if (distance < Math.max(40, width * 0.15) && !flick) return 0;
  return dx < 0 ? 1 : -1;
}

export interface QrShape {
  /** Modules per side (without the quiet zone). */
  size: number;
  /** SVG path of the dark modules, one 1×1 square each, in module coordinates shifted by the quiet zone. */
  path: string;
  /** Side of the whole picture in modules, with the quiet zone. */
  viewBox: number;
}

/** The quiet zone around the code, in modules (scanners need a light margin). */
const QUIET = 2;

/** The QR code of a text as an SVG path (error correction M: an address stays readable from a slightly blurry photo). */
export function qrShape(text: string): QrShape {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  return { size, path, viewBox: size + QUIET * 2 };
}
