import type { AddPhase, AddProgressResponse } from '../models/index.ts';

/**
 * Progress of the game being added. Only one game is added at a time (the operation lock), so one slot is enough;
 * the client polls it while its "add" request is running.
 */
let current: AddProgressResponse['progress'] = null;

export const getAddProgress = (): AddProgressResponse => ({ progress: current });

export function setAddProgress(phase: AddPhase, ratio: number): void {
  current = { phase, ratio: Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0)) };
}

export function clearAddProgress(): void {
  current = null;
}
