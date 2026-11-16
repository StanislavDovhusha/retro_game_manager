import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import { t } from '../i18n/index.ts';
import { AppError } from '../utils/errors.ts';
import { assertSafeRelative } from '../utils/paths.ts';
import { normalizeTitle } from '../utils/text.ts';

/**
 * Compile-time check that a request type of the shared API contract is accepted by a schema.
 * Use: `type _Check = Assert<Accepts<typeof schema, SomeRequest>>` — it stops compiling when they drift apart.
 */
export type Accepts<Schema extends ZodTypeAny, Request> = [Request] extends [z.input<Schema>] ? true : false;
export type Assert<T extends true> = T;

const MAX_PATH_LENGTH = 4096;

/** Runs a check that throws `AppError` and reports its (translated) message as a zod issue. */
const issueFromError = (ctx: z.RefinementCtx, err: unknown): typeof z.NEVER => {
  ctx.addIssue(
    err instanceof AppError
      ? { code: 'custom', message: err.message, params: { appCode: err.code, status: err.status } }
      : { code: 'custom', message: t('Invalid request') },
  );
  return z.NEVER;
};

/** A path relative to the games folder or the SD card: no `..`, no absolute paths, no NUL bytes. */
export const relPath = z
  .string()
  .max(MAX_PATH_LENGTH)
  .superRefine((value, ctx) => {
    try {
      assertSafeRelative(value);
    } catch (err) {
      issueFromError(ctx, err);
    }
  });

/** Like `relPath`, but the empty string is allowed and means "the root itself" (the SD card tree is requested with `rel=`). */
export const relPathOrRoot = z
  .string()
  .max(MAX_PATH_LENGTH)
  .superRefine((value, ctx) => {
    if (value === '') return;
    try {
      assertSafeRelative(value);
    } catch (err) {
      issueFromError(ctx, err);
    }
  });

/** An absolute path chosen by the user (a folder or a file); whether it exists is checked by the services. */
export const diskPath = z
  .string()
  .max(MAX_PATH_LENGTH)
  .refine((value) => !value.includes('\0'), { error: () => t('Invalid file path') });

/** A game title: whitespace is collapsed and the title is validated (length, characters). */
export const gameTitle = z.string().transform((value, ctx) => {
  try {
    return normalizeTitle(value);
  } catch (err) {
    return issueFromError(ctx, err);
  }
});

/**
 * `confirmed: true` — the explicit confirmation of a destructive action. Anything else (a missing field, `false`,
 * a wrong type) fails with the same translated message.
 */
export const confirmed = (message: () => string) =>
  z.unknown().refine((value): value is true => value === true, { error: () => message() });

/** A reference to a source file: a path on disk or a file uploaded to the staging folder. */
export const sourceRef = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('path'),
    path: diskPath.refine((value) => value.length > 0, { error: () => t('No file selected') }),
  }),
  z.object({ type: z.literal('upload'), id: z.string().min(1).max(100) }),
]);
