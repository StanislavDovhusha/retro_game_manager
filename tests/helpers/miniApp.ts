import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Server } from 'node:http';
import { after } from 'node:test';
import { errorHandler } from '../../src/middlewares/errorHandler.ts';

/** An Express app with the real central error handler and routes that fail in different ways. */
export async function startFailingApp(
  fail: Record<string, () => never>,
): Promise<(url: string, headers?: Record<string, string>) => Promise<{ status: number; body: Record<string, unknown> }>> {
  const app = express();
  for (const [name, action] of Object.entries(fail)) {
    app.get(`/${name}`, () => {
      action();
    });
    app.get(`/async-${name}`, (_req, _res, next) => {
      Promise.resolve().then(action).catch(next);
    });
  }
  app.use(errorHandler);
  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return async (url, headers = {}) => {
    const response = await fetch(`${base}${url}`, { headers });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
}
