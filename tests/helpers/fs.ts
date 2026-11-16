import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../src/utils/errors.ts';

/** Writes a file, creating its folders. */
export async function write(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

export const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    () => true,
    () => false,
  );

export const read = (file: string): Promise<string> => fs.readFile(file, 'utf8');

/** For `assert.rejects` / `assert.throws`: the error is an `AppError` with the given HTTP status (and code). */
export const isAppError =
  (status: number, code?: string) =>
  (err: unknown): boolean =>
    err instanceof AppError && err.status === status && (code === undefined || err.code === code);
