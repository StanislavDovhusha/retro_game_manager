import pino from 'pino';
import { config } from '../config/index.ts';

/**
 * Application logger (pino, JSON lines). Levels: `info`, `warn`, `error` (plus `debug`, `trace`, `fatal`).
 * The level comes from LOG_LEVEL; `silent` turns logging off (used by the tests). The lines go to the standard
 * output, or to LOG_FILE when it is set (the desktop app has no console, so it logs to a file).
 */
export const logger = config.logFile
  ? pino({ level: config.logLevel }, pino.destination({ dest: config.logFile, mkdir: true, sync: false }))
  : pino({ level: config.logLevel });
