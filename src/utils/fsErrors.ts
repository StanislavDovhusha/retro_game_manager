import { t } from '../i18n/index.ts';
import { AppError, ForbiddenError, InsufficientStorageError, InternalError } from './errors.ts';
import { errorCode, errorMessage } from './guards.ts';

/**
 * Turns a file system error into an application error with a friendly message.
 * `what` names the thing being accessed ("games folder"); it must not contain internal details.
 */
export function fsError(err: unknown, what: string): AppError {
  if (err instanceof AppError) return err;
  const code = errorCode(err);
  if (code === 'ENOSPC') return new InsufficientStorageError(t('Not enough disk space'));
  if (code === 'EACCES' || code === 'EPERM') return new ForbiddenError(t('No access: {what}', { what }));
  if (code === 'EROFS') return new ForbiddenError(t('The folder is read-only: {what}', { what }));
  return new InternalError(`${what}: ${errorMessage(err)}`, { cause: err });
}
