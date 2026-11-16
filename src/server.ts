import path from 'node:path';
import { config } from './config/index.ts';
import { startServer } from './startServer.ts';
import { logger } from './utils/logger.ts';
import { findProjectRoot } from './utils/projectRoot.ts';

/** Command-line entry: starts the HTTP server. The built web client (Angular) lives in <project root>/dist. */
async function main(): Promise<void> {
  const distDir = path.join(await findProjectRoot(import.meta.url), 'dist');
  let server: Awaited<ReturnType<typeof startServer>>;
  try {
    server = await startServer({ distDir });
  } catch (err) {
    const inUse = err instanceof Error && 'code' in err && err.code === 'EADDRINUSE';
    logger.error({ err }, inUse ? `Port ${config.port} is already in use` : 'Server error');
    process.exit(1);
  }

  // Graceful shutdown: stop accepting connections, let running requests and file operations finish.
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Received a stop signal');
    server
      .close()
      .catch((err: unknown) => logger.error({ err }, 'Error while stopping the server'))
      .finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 40_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
