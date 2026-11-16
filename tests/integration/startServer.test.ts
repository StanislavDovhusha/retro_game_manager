import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { startServer } from '../../src/startServer.ts';
import { runExclusive } from '../../src/utils/lock.ts';
import { write } from '../helpers/fs.ts';

const dist = path.join(work, 'dist');
await write(path.join(dist, 'index.html'), '<!doctype html><title>Retro Game Manager</title>');

test('port 0 picks a free port; the UI and the API are served from it', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1', distDir: dist });
  try {
    assert.ok(server.port > 0);
    assert.equal(server.origin, `http://127.0.0.1:${server.port}`);
    const page = await fetch(`${server.origin}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Retro Game Manager<\/title>/);
    assert.equal((await fetch(`${server.origin}/some/spa/route`)).status, 200, 'SPA fallback');
    const status = await fetch(`${server.origin}/api/status`);
    assert.deepEqual(await status.json(), { busy: null });
  } finally {
    await server.close();
  }
});

test('the Origin guard knows the real port: the window of the app may call the API, other sites may not', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1', distDir: dist });
  try {
    const own = await fetch(`${server.origin}/api/settings`, { headers: { origin: server.origin } });
    assert.equal(own.status, 200);
    const evil = await fetch(`${server.origin}/api/settings`, { headers: { origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    // Without a built client only the API is served.
  } finally {
    await server.close();
  }
});

test('two servers get two different ports', async () => {
  const [a, b] = await Promise.all([startServer({ port: 0, host: '127.0.0.1' }), startServer({ port: 0, host: '127.0.0.1' })]);
  try {
    assert.notEqual(a.port, b.port);
    assert.equal((await fetch(`${a.origin}/`)).status, 404, 'no client folder: the root is not served');
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});

test('close() stops listening and is idempotent', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  await server.close();
  await server.close();
  await assert.rejects(fetch(`${server.origin}/api/status`), (err: unknown) => err instanceof TypeError);
});

test('close() cuts idle keep-alive connections instead of waiting for them', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  const agent = new http.Agent({ keepAlive: true });
  await new Promise<void>((resolve, reject) => {
    http.get(`${server.origin}/api/status`, { agent }, (res) => res.resume().on('end', resolve)).on('error', reject);
  });
  const started = Date.now();
  await server.close({ graceMs: 5_000 });
  assert.ok(Date.now() - started < 2_000, 'a kept-alive connection must not delay the shutdown');
  agent.destroy();
});

test('close() cuts a request that does not finish within the grace period', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  // An upload that never ends: headers are sent, the body is not.
  const socket = await new Promise<Socket>((resolve) => {
    const req = http.request(`${server.origin}/api/upload?kind=game`, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': 'a.gba' },
    });
    req.on('error', () => undefined);
    req.on('socket', (s) => resolve(s));
    req.flushHeaders();
  });
  const started = Date.now();
  await server.close({ graceMs: 100 });
  assert.ok(Date.now() - started < 3_000);
  socket.destroy();
});

test('close() waits for a running file operation', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  let finished = false;
  const operation = runExclusive('test operation', async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    finished = true;
  });
  await server.close({ operationMs: 2_000 });
  assert.equal(finished, true, 'the shutdown must not return while a file operation is running');
  await operation;
});

test('close() gives up on an operation that takes too long', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  let release: () => void = () => undefined;
  const operation = runExclusive('stuck operation', () => new Promise<void>((resolve) => (release = resolve)));
  const started = Date.now();
  await server.close({ operationMs: 100 });
  assert.ok(Date.now() - started < 2_000);
  release();
  await operation;
});

test('a port that is already taken is reported as EADDRINUSE', async () => {
  const first = await startServer({ port: 0, host: '127.0.0.1' });
  try {
    await assert.rejects(
      startServer({ port: first.port, host: '127.0.0.1' }),
      (err: unknown) => err instanceof Error && 'code' in err && err.code === 'EADDRINUSE',
    );
  } finally {
    await first.close();
  }
});

test('the data folder is prepared when the server starts: temp/ emptied, uploads folder ready, journal moved to logs/', async () => {
  const data = path.join(work, 'data');
  await fs.mkdir(path.join(data, 'temp', 'op-crashed'), { recursive: true });
  await fs.writeFile(path.join(data, 'temp', 'op-crashed', 'half.img'), 'left by a crash');
  await fs.writeFile(path.join(data, 'operations.log'), 'old journal\n');
  const server = await startServer({ port: 0, host: '127.0.0.1' });
  try {
    assert.deepEqual(await fs.readdir(path.join(data, 'temp')), ['uploads'], 'whatever a crash left in temp/ is gone');
    assert.ok((await fs.stat(path.join(data, 'temp', 'uploads'))).isDirectory());
    assert.ok(!(await fs.stat(path.join(data, 'operations.log')).catch(() => null)), 'the old journal left the root');
    // It becomes logs/operations.log, or operations.previous.log when the new journal has already been started.
    const logs = await fs.readdir(path.join(data, 'logs'));
    const texts = await Promise.all(logs.map((name) => fs.readFile(path.join(data, 'logs', name), 'utf8')));
    assert.ok(
      texts.some((text) => text.startsWith('old journal\n')),
      logs.join(', '),
    );
  } finally {
    await server.close();
  }
});
