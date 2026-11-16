/** Pure geometry and keys of the start-up tour (no Angular, no DOM): unit-tested from the root tests. */

export type TourSide = 'top' | 'bottom' | 'left' | 'right';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TipPlacement {
  /** `center`: no target, or the tooltip fits on no side of it. */
  side: TourSide | 'center';
  x: number;
  y: number;
}

/** Space between the highlight and the tooltip, and between the tooltip and the window edge. */
export const TOUR_GAP = 12;
export const TOUR_MARGIN = 8;
/** The highlight is this much larger than the element. */
export const TOUR_PADDING = 6;

const OPPOSITE: Record<TourSide, TourSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/** The common part of two boxes, or null when they do not overlap. */
export function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** The highlighted area: the element plus padding, cut to the window. Null when the element is off screen. */
export function spotlight(target: Box, view: Size, padding = TOUR_PADDING): Box | null {
  const x1 = Math.max(0, target.x - padding);
  const y1 = Math.max(0, target.y - padding);
  const x2 = Math.min(view.width, target.x + target.width + padding);
  const y2 = Math.min(view.height, target.y + target.height + padding);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Where the tooltip goes: on the preferred side of the highlight when it fits there, otherwise on the opposite side,
 * then on the remaining two; centred along that side. It never leaves the window: the position is clamped to the
 * margins. Without a highlight, or when no side has room, it is centred in the window.
 */
export function placeTooltip(target: Box | null, tip: Size, view: Size, preferred: TourSide): TipPlacement {
  const center = (): TipPlacement => ({
    side: 'center',
    x: clamp((view.width - tip.width) / 2, TOUR_MARGIN, view.width - tip.width - TOUR_MARGIN),
    y: clamp((view.height - tip.height) / 2, TOUR_MARGIN, view.height - tip.height - TOUR_MARGIN),
  });
  if (!target) return center();

  const order: TourSide[] = [preferred, OPPOSITE[preferred], ...(['bottom', 'top', 'right', 'left'] as const)];
  for (const side of new Set(order)) {
    let x: number;
    let y: number;
    let fits: boolean;
    switch (side) {
      case 'bottom':
        y = target.y + target.height + TOUR_GAP;
        x = target.x + target.width / 2 - tip.width / 2;
        fits = y + tip.height <= view.height - TOUR_MARGIN;
        break;
      case 'top':
        y = target.y - TOUR_GAP - tip.height;
        x = target.x + target.width / 2 - tip.width / 2;
        fits = y >= TOUR_MARGIN;
        break;
      case 'right':
        x = target.x + target.width + TOUR_GAP;
        y = target.y + target.height / 2 - tip.height / 2;
        fits = x + tip.width <= view.width - TOUR_MARGIN;
        break;
      case 'left':
        x = target.x - TOUR_GAP - tip.width;
        y = target.y + target.height / 2 - tip.height / 2;
        fits = x >= TOUR_MARGIN;
        break;
    }
    // The tooltip must also fit across the side (a window narrower than the tooltip has no room on any side).
    const across = side === 'top' || side === 'bottom' ? tip.width <= view.width - 2 * TOUR_MARGIN : tip.height <= view.height - 2 * TOUR_MARGIN;
    if (fits && across) {
      return {
        side,
        x: clamp(x, TOUR_MARGIN, view.width - tip.width - TOUR_MARGIN),
        y: clamp(y, TOUR_MARGIN, view.height - tip.height - TOUR_MARGIN),
      };
    }
  }
  return center();
}

/** The dimmed area around the highlight as up to four rectangles (they also catch the clicks outside it). */
export function blockers(hole: Box | null, view: Size): Box[] {
  if (!hole) return [{ x: 0, y: 0, width: view.width, height: view.height }];
  const right = hole.x + hole.width;
  const bottom = hole.y + hole.height;
  return [
    { x: 0, y: 0, width: view.width, height: hole.y },
    { x: 0, y: bottom, width: view.width, height: view.height - bottom },
    { x: 0, y: hole.y, width: hole.x, height: hole.height },
    { x: right, y: hole.y, width: view.width - right, height: hole.height },
  ].filter((box) => box.width > 0 && box.height > 0);
}

/** Keys of the tour: ← and → move between the steps, Esc leaves it. */
export function tourKey(key: string): 'next' | 'back' | 'exit' | null {
  if (key === 'ArrowRight') return 'next';
  if (key === 'ArrowLeft') return 'back';
  if (key === 'Escape' || key === 'Esc') return 'exit';
  return null;
}
