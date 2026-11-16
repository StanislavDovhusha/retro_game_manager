import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after } from 'node:test';
import { createApp } from '../../src/app.ts';

export interface ApiResponse {
  status: number;
  headers: Headers;
  /** Parsed JSON body (or null when the response has none). */
  body: Record<string, unknown> | null;
  text: string;
}

export interface ApiOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /** Raw body (for uploads); takes precedence over `body`. */
  raw?: Uint8Array;
}

/** Starts the real application on a random local port. The server is closed when the test file ends. */
export async function startApi(): Promise<(method: string, url: string, options?: ApiOptions) => Promise<ApiResponse>> {
  const app = await createApp();
  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return async (method, url, { body, headers = {}, raw }: ApiOptions = {}) => {
    const init: RequestInit = { method, headers: { ...headers } };
    const sendsBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (raw) {
      init.body = raw;
    } else if (body !== undefined || sendsBody) {
      body ??= {}; // like the web client: a request that changes data always carries a JSON body
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      (init.headers as Record<string, string>)['content-type'] ??= 'application/json';
    }
    const response = await fetch(`${base}${url}`, init);
    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      const value: unknown = JSON.parse(text);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) parsed = value as Record<string, unknown>;
    } catch {
      /* not JSON */
    }
    return { status: response.status, headers: response.headers, body: parsed, text };
  };
}
