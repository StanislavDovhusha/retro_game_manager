import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SdAccessReason } from '../models/index.ts';
import { errorCode } from '../utils/guards.ts';

/**
 * Whether the saved SD card folder can still be used: it exists, its contents can be read and it can be written to.
 * Only reads: nothing is created on the card. An unplugged network or removable drive can make a call hang, so the
 * check gives up after a timeout and the card is then treated as unavailable.
 */

/** How long the start-up check waits for the card. */
export const SD_ACCESS_TIMEOUT_MS = 3000;

export type SdAccess =
  | { ok: true }
  | {
      ok: false;
      reason: SdAccessReason;
      /** The error code of the failed call (`ENOENT`, `EACCES`, `EPERM`, …); empty for a timeout. */
      code: string;
      /** macOS refused the access itself (no permission for removable volumes): the user can allow it in the settings. */
      systemDenied: boolean;
    };

/** The calls the check makes (replaced in tests). */
export interface SdAccessFs {
  stat: (path: string) => Promise<{ isDirectory(): boolean }>;
  readdir: (path: string) => Promise<unknown[]>;
  access: (path: string, mode: number) => Promise<void>;
}

const realFs: SdAccessFs = {
  stat: (p) => fs.stat(p),
  readdir: (p) => fs.readdir(p),
  access: (p, mode) => fs.access(p, mode),
};

const DENIED = new Set(['EACCES', 'EPERM']);

/**
 * The reason for a failed call. A path that is missing or cannot be reached (another drive letter, an unplugged
 * card, an I/O error) is "not found"; a refusal is "no read" or "no write" depending on the step.
 */
export function accessProblem(
  step: 'stat' | 'read' | 'write',
  code: string,
  platform: NodeJS.Platform = process.platform,
): Exclude<SdAccess, { ok: true }> {
  const denied = DENIED.has(code);
  let reason: SdAccessReason = 'missing';
  if (step === 'write' && (denied || code === 'EROFS')) reason = 'noWrite';
  else if (denied) reason = 'noRead';
  // macOS answers EPERM ("Operation not permitted") when its privacy settings deny the app a removable or network
  // volume; plain file permissions give EACCES.
  return { ok: false, reason, code, systemDenied: platform === 'darwin' && code === 'EPERM' };
}

async function probe(root: string, api: SdAccessFs, platform: NodeJS.Platform): Promise<SdAccess> {
  try {
    if (!(await api.stat(root)).isDirectory()) return { ok: false, reason: 'missing', code: 'ENOTDIR', systemDenied: false };
  } catch (err) {
    return accessProblem('stat', errorCode(err) ?? '', platform);
  }
  try {
    await api.readdir(root);
  } catch (err) {
    return accessProblem('read', errorCode(err) ?? '', platform);
  }
  try {
    await api.access(root, constants.W_OK);
  } catch (err) {
    return accessProblem('write', errorCode(err) ?? '', platform);
  }
  return { ok: true };
}

/** Checks the card folder; resolves within `timeoutMs` in any case (a call still hanging is left behind). */
export async function checkSdAccess(
  root: string,
  options: { timeoutMs?: number; fs?: SdAccessFs; platform?: NodeJS.Platform } = {},
): Promise<SdAccess> {
  const { timeoutMs = SD_ACCESS_TIMEOUT_MS, fs: api = realFs, platform = process.platform } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SdAccess>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout', code: '', systemDenied: false }), timeoutMs);
  });
  try {
    return await Promise.race([probe(root, api, platform), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
