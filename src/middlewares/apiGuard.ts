import type { RequestHandler } from 'express';
import { t } from '../i18n/index.ts';
import { ForbiddenError, UnsupportedMediaTypeError } from '../utils/errors.ts';

/** Origins from which the API may be called: the web client plus the server's own address. */
export function buildAllowedOrigins(clientOrigins: readonly string[], port: number, host: string): string[] {
  const own = [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];
  if (host && !['0.0.0.0', '::', '127.0.0.1', 'localhost'].includes(host)) own.push(`http://${host}:${port}`);
  return [...new Set([...clientOrigins, ...own])];
}

/**
 * Protects the local API from requests made by other sites (CSRF) and from wrong content types.
 * - A request that carries an `Origin` header must come from an allowed origin. Requests without the header
 *   (same-origin GET, curl, tests) are not browser cross-site requests and pass.
 * - Requests that change data must be JSON; the only exception is the raw file upload `PUT /upload`.
 */
export function createApiGuard(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) {
      next(new ForbiddenError(t('Request from a disallowed origin')));
      return;
    }
    const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const rawUpload = req.method === 'PUT' && req.path === '/upload' && req.is('application/octet-stream');
    if (!safeMethod && !req.is('application/json') && !rawUpload) {
      next(new UnsupportedMediaTypeError(t('application/json is expected')));
      return;
    }
    next();
  };
}
