import path from 'node:path';
import express from 'express';
import type { Express, Request, Response } from 'express';
import { config } from './config/index.ts';
import { apiNotFound, errorHandler } from './middlewares/errorHandler.ts';
import { buildAllowedOrigins, createApiGuard } from './middlewares/apiGuard.ts';
import { languageMiddleware } from './middlewares/language.ts';
import { requestLogger } from './middlewares/requestLogger.ts';
import { compressResponses, corsForClient, securityHeaders } from './middlewares/security.ts';
import apiRoutes from './routes/index.ts';
import { hasIndexHtml } from './utils/projectRoot.ts';

export interface AppOptions {
  /** Folder with the built web client; when it has an index.html it is served (with SPA fallback). */
  distDir?: string | null;
  /** The port the server really listens on (it may differ from `config.port`, e.g. a free port chosen by the OS). */
  port?: number;
}

/**
 * Builds the Express application: middleware order, routes and the error handler. It does not start listening,
 * so the tests can mount it on any port.
 */
export async function createApp({ distDir = null, port = config.port }: AppOptions = {}): Promise<Express> {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(securityHeaders());
  app.use(compressResponses());
  app.use('/api', corsForClient(config.clientOrigins));
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(languageMiddleware); // after the body is parsed, see the middleware

  app.use('/api', createApiGuard(buildAllowedOrigins(config.clientOrigins, port, config.host)));
  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);

  if (distDir && (await hasIndexHtml(distDir))) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
