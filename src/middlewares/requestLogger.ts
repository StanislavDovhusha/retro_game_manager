import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.ts';

/** Logs every finished request: method, URL, status and duration (`error` for 5xx, `warn` for 4xx, `info` otherwise). */
export const requestLogger: RequestHandler = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const entry = { method: req.method, url: req.originalUrl, status: res.statusCode, durationMs };
    if (res.statusCode >= 500) logger.error(entry, 'Request finished');
    else if (res.statusCode >= 400) logger.warn(entry, 'Request finished');
    else logger.info(entry, 'Request finished');
  });
  next();
};
