import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.ts';
import { dataPaths } from '../utils/dataPaths.ts';
import type { LogEntry, LogLevel } from '../models/index.ts';
import { logger } from '../utils/logger.ts';

const MAX_ENTRIES = 500;
const OPERATIONS_LOG = path.join(dataPaths.logs, 'operations.log');
const entries: LogEntry[] = [];
let seq = 0;

/**
 * The operations journal shown in the UI ("Log" panel): kept in memory (the last 500 entries) and appended to
 * `logs/operations.log` in the data folder. Messages are written in the language of the request that caused them.
 * Every entry is also sent to the application logger (`success` is logged as `info`).
 */
export function journal(level: LogLevel, message: string): LogEntry {
  const entry: LogEntry = { id: ++seq, time: new Date().toISOString(), level, message };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  logger[level === 'success' ? 'info' : level]({ journal: true }, message);

  fs.mkdir(dataPaths.logs, { recursive: true })
    .then(() => fs.appendFile(OPERATIONS_LOG, `${entry.time} [${level}] ${message}\n`))
    .catch((err: unknown) => logger.warn({ err }, 'Could not append to operations.log'));
  return entry;
}

/** Journal entries, newest first. */
export const getJournal = (): LogEntry[] => [...entries].reverse();

/** Older versions kept `operations.log` in the root of the data folder: it moves to `logs/` (once). */
export async function moveOldJournal(): Promise<void> {
  const old = path.join(config.dataDir, 'operations.log');
  try {
    await fs.access(old);
  } catch {
    return;
  }
  await fs.mkdir(dataPaths.logs, { recursive: true });
  const exists = await fs.access(OPERATIONS_LOG).then(
    () => true,
    () => false,
  );
  await fs.rename(old, exists ? path.join(dataPaths.logs, 'operations.previous.log') : OPERATIONS_LOG);
}
