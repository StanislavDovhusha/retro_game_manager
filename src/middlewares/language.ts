import type { NextFunction, Request, Response } from 'express';
import { langOf, runWithLang } from '../i18n/index.ts';

/**
 * Makes the request language (X-Lang header) visible in all async calls made by the handlers.
 * Mount it after `express.json()`: the body is parsed in stream events, which would lose a context set earlier.
 */
export function languageMiddleware(req: Request, _res: Response, next: NextFunction): void {
  runWithLang(langOf(req), next);
}
