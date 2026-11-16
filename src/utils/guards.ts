/** Narrowing helpers for unknown values (errors, JSON). They replace `any`. */

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A Node.js error with a `code` (ENOENT, EACCES, ...). */
export const isErrnoException = (value: unknown): value is NodeJS.ErrnoException => value instanceof Error && 'code' in value;

export const errorCode = (value: unknown): string | undefined =>
  isErrnoException(value) && typeof value.code === 'string' ? value.code : undefined;

export const errorMessage = (value: unknown): string => (value instanceof Error ? value.message : String(value));
