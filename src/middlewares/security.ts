import compression from 'compression';
import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * Security headers (helmet). The Content-Security-Policy is spelled out because the application is a same-origin
 * single-page app served over plain HTTP on localhost:
 * - `upgrade-insecure-requests` is switched off (it would break plain-HTTP localhost);
 * - `script-src-attr 'unsafe-inline'` is needed by the `onload` attribute Angular puts on its stylesheet links
 *   (inline critical CSS); scripts themselves are still limited to `'self'`;
 * - `blob:` images are used for the preview of a file chosen in the browser.
 */
export const securityHeaders = (): RequestHandler =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
  });

/** CORS only for the web client's origin(s): other sites get no CORS headers and the browser blocks them. */
export const corsForClient = (clientOrigins: readonly string[]): RequestHandler =>
  cors({
    origin: [...clientOrigins],
    methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Lang', 'X-File-Name'],
    maxAge: 600,
  });

/** Compresses text responses (JSON, HTML, CSS, JS). Images and other already-compressed files are skipped. */
export const compressResponses = (): RequestHandler => compression();
