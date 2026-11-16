import type { ErrorRequestHandler, RequestHandler } from 'express';
import { config } from '../config/index.ts';
import { langOf, runWithLang, t } from '../i18n/index.ts';
import type { ErrorResponse } from '../models/index.ts';
import { journal } from '../services/journalService.ts';
import {
  AppError,
  ForbiddenError,
  InsufficientStorageError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
} from '../utils/errors.ts';
import { errorCode, errorMessage, isErrnoException, isRecord } from '../utils/guards.ts';
import { logger } from '../utils/logger.ts';

/** Unknown `/api/*` route: forwarded to the error handler so it gets the same response format. */
export const apiNotFound: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError(t('API method not found')));
};

/** Converts anything that was thrown into an `AppError`. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  // Errors of the JSON body parser.
  if (isRecord(err) && err.type === 'entity.parse.failed') return new ValidationError(t('Invalid JSON'), { cause: err });
  if (isRecord(err) && err.type === 'entity.too.large') return new PayloadTooLargeError(t('The request body is too large'), { cause: err });
  // File system errors that can be explained to the user.
  const code = errorCode(err);
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    const target = isErrnoException(err) ? (err.path ?? '') : '';
    return new ForbiddenError(t('No access to the file or folder: {v0}', { v0: target }), { cause: err });
  }
  if (code === 'ENOSPC') return new InsufficientStorageError(t('Not enough disk space'), { cause: err });
  return new InternalError(errorMessage(err) || t('Internal server error'), { cause: err });
}

/**
 * The single place that turns errors into HTTP responses: `{ error, code, details? }`.
 * - Client errors (4xx) carry their own message.
 * - In production an internal error (5xx) is reported with a generic message only: no stack, no file paths.
 * - Everything is logged on the server with the full stack.
 *
 * The handler may be reached from stream events (body parsing), outside the language context of the request,
 * so the language is taken from the header explicitly.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) =>
  runWithLang(langOf(req), () => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const appError = toAppError(err);
    const isServerError = appError.status >= 500;

    if (isServerError) {
      logger.error({ err, method: req.method, url: req.originalUrl }, 'Request failed');
      journal('error', appError.message);
    }

    const visible = appError.expose || !config.isProduction;
    const body: ErrorResponse = {
      error: visible ? appError.message : t('Internal server error'),
      code: appError.code,
    };
    if (visible && appError.details !== undefined) body.details = appError.details;
    if (!config.isProduction && isServerError && err instanceof Error && err.stack) body.stack = err.stack;

    res.status(appError.status).json(body);
  });
