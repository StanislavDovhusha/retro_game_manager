import { t } from '../i18n/index.ts';
import { ConflictError } from './errors.ts';

let busy: string | null = null;

/** Prevents two operations that change the CSV or the files from running at the same time. */
export async function runExclusive<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (busy) throw new ConflictError(t('The operation “{busy}” is in progress. Wait for it to finish.', { busy }));
  busy = name;
  try {
    return await fn();
  } finally {
    busy = null;
  }
}

export const currentOperation = (): string | null => busy;

/** Resolves when no exclusive operation is running; gives up (resolves `false`) after `timeoutMs`. */
export async function waitForIdle(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (busy !== null) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return true;
}
