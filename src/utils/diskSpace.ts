import fs from 'node:fs/promises';
import { t } from '../i18n/index.ts';
import { InsufficientStorageError } from './errors.ts';

/** Free space available to the user on the disk of `dir`, in bytes; `null` when the system cannot tell. */
export async function freeBytes(dir: string): Promise<number | null> {
  try {
    const st = await fs.statfs(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return null;
  }
}

const mb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

/** Refuses to start writing `needed` bytes into `dir` when the disk (the memory card) has less free space. */
export async function assertFreeSpace(dir: string, needed: number): Promise<void> {
  const free = await freeBytes(dir);
  if (free !== null && free < needed) {
    throw new InsufficientStorageError(
      t('Not enough free space: {need} MB is needed, {free} MB is available', { need: mb(needed), free: mb(free) }),
    );
  }
}
