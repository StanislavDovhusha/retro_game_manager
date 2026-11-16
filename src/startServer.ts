import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';
import { config } from './config/index.ts';
import { t } from './i18n/index.ts';
import { migrateBackupsInBackground } from './services/backupService.ts';
import { journal, moveOldJournal } from './services/journalService.ts';
import { initTemp } from './services/tempService.ts';
import { initStaging } from './services/uploadService.ts';
import { errorMessage } from './utils/guards.ts';
import { waitForIdle } from './utils/lock.ts';
import { logger } from './utils/logger.ts';
import { hasIndexHtml } from './utils/projectRoot.ts';
import { LEGACY_DATA_DIRS, moveLegacyData, type FolderMove } from './utils/legacyData.ts';

export interface StartServerOptions {
  /** Folder with the built web client. Without it (or without an index.html there) only the API is served. */
  distDir?: string | null;
  /** Port to listen on; 0 lets the operating system pick a free one. Default: PORT from the configuration. */
  port?: number;
  /** Interface to listen on. Default: HOST from the configuration. */
  host?: string;
}

export interface CloseOptions {
  /** How long running requests may take to finish before their connections are cut. */
  graceMs?: number;
  /** How long to wait for a running file operation (rename, sync, …) to finish before giving up. */
  operationMs?: number;
}

export interface RunningServer {
  readonly host: string;
  readonly port: number;
  /** `http://host:port` — the address the web client is served from. */
  readonly origin: string;
  /** Stops accepting connections, lets running requests and file operations finish, then resolves. Idempotent. */
  close(options?: CloseOptions): Promise<void>;
}

const ANY_ADDRESS = new Set(['0.0.0.0', '::']);

function listen(server: http.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error): void => reject(err);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

/**
 * Starts the application server: the API and, when `distDir` holds a built client, the web interface.
 * It is used both by the command line (`server.ts`) and by the desktop app, which asks for a free port (`port: 0`)
 * and needs a clean shutdown when its window closes.
 *
 * The socket is opened first, so the real port is known when the application (and its Origin guard) is built.
 */
export async function startServer({
  distDir = null,
  port = config.port,
  host = config.host,
}: StartServerOptions = {}): Promise<RunningServer> {
  // The data of older versions (~/.game-manager, ~/.sf3000-manager) moves to the default data folder once.
  if (config.dataDirIsDefault) logDataMoves(await moveLegacyData(LEGACY_DATA_DIRS, config.dataDir), config.dataDir);
  // The data folder: temp/ (and the uploads in it) starts empty, the journal lives in logs/.
  await initTemp().catch((err: unknown) => logger.warn({ err }, 'Temp: the folder could not be emptied'));
  await initStaging().catch((err: unknown) => logger.warn({ err }, `${t('Could not prepare the uploads folder:')} ${errorMessage(err)}`));
  await moveOldJournal().catch((err: unknown) => logger.warn({ err }, 'Logs: the old operations.log could not be moved'));

  const server = http.createServer();
  await listen(server, port, host);
  const actualPort = (server.address() as AddressInfo).port;

  try {
    server.on('request', await createApp({ distDir, port: actualPort }));
  } catch (err) {
    server.close();
    throw err;
  }

  const origin = `http://${ANY_ADDRESS.has(host) ? '127.0.0.1' : host}:${actualPort}`;
  const uiBuilt = distDir !== null && (await hasIndexHtml(distDir));
  logger.info(
    { host, port: actualPort, env: config.nodeEnv, ui: uiBuilt ? 'built' : 'none' },
    t('Retro Game Manager: API at http://{HOST}:{PORT}', { HOST: host, PORT: actualPort }) +
      (uiBuilt ? t(' (the UI is built — open this address)') : t(' (development mode: the UI is at http://localhost:5173)')),
  );
  journal('info', t('Server started'));
  // Backups that older versions left on the card are moved to the data folder (in the background: a big card takes a while).
  void migrateBackupsInBackground();

  let closing: Promise<void> | null = null;
  const close = ({ graceMs = 5_000, operationMs = 30_000 }: CloseOptions = {}): Promise<void> => {
    closing ??= (async () => {
      logger.info('Shutting down');
      const stopped = new Promise<void>((resolve) => server.close(() => resolve())); // also resolves if it was not running
      server.closeIdleConnections();
      const cutter = setTimeout(() => server.closeAllConnections(), graceMs);
      await stopped;
      clearTimeout(cutter);
      if (!(await waitForIdle(operationMs))) logger.warn('A file operation was still running when the server stopped');
    })();
    return closing;
  };

  return { host, port: actualPort, origin, close };
}

/** Writes what happened to the data folders of earlier versions (also used by the desktop shell for its own folders). */
export function logDataMoves(moves: readonly FolderMove[], to: string): void {
  for (const { from, result, error } of moves) {
    if (error) logger.error({ from, to, err: error }, 'Data folder: the old one could not be moved, it was kept');
    else if (result?.moved)
      logger.info({ from, to, entries: result.entries, skipped: result.skipped }, 'Data folder moved, the old one removed');
  }
}
