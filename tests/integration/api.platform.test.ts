import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
await write(path.join(sd, 'GBA', 'Mario.gba'), 'rom');
await write(path.join(sd, 'GBA', 'Zelda.gba'), 'rom');
await write(path.join(sd, 'GBA', 'filelist.csv'), 'Mario.gba,Mario,mario\n');
await write(path.join(sd, 'rootfs', 'etc', 'a.gba'), 'x');
await write(path.join(sd, 'cubegm', 'allfiles.lst'), '');

const errorShape = (body: Record<string, unknown> | null): { error: unknown; code: unknown } => ({ error: body?.error, code: body?.code });

test('GET /api/settings returns the public settings', async () => {
  const res = await api('GET', '/api/settings');
  assert.equal(res.status, 200);
  const settings = res.body?.settings as Record<string, unknown> | undefined;
  assert.ok(settings && 'extensions' in settings && 'csv' in settings);
  assert.ok(!('imageOverrides' in settings), 'internal fields are not exposed');
  assert.ok(Array.isArray(res.body?.encodings));
});

test('SD card flow: choose the root, list the tree, choose a platform, scan the library', async () => {
  let res = await api('PUT', '/api/sd/root', { body: { root: sd } });
  assert.equal(res.status, 200);

  res = await api('GET', '/api/sd');
  assert.equal(res.status, 200);
  const platforms = res.body?.platforms as { name: string }[];
  assert.deepEqual(
    platforms.map((platform) => platform.name),
    ['GBA'],
  );

  res = await api('GET', '/api/sd/tree?rel=');
  assert.equal(res.status, 200);
  const nodes = res.body?.nodes as { name: string; kind: string }[];
  assert.equal(nodes.find((node) => node.name === 'rootfs')?.kind, 'system');

  res = await api('PUT', '/api/sd/platform', { body: { name: 'GBA' } });
  assert.equal(res.status, 200);
  assert.equal((res.body?.settings as { platform: string }).platform, 'GBA');

  res = await api('GET', '/api/library');
  assert.equal(res.status, 200);
  const files = res.body?.files as { rel: string; inCsv: boolean | null }[];
  assert.deepEqual(files.map((file) => file.rel).sort(), ['Mario.gba', 'Zelda.gba']);
  assert.equal(files.find((file) => file.rel === 'Mario.gba')?.inCsv, true);
  assert.equal(files.find((file) => file.rel === 'Zelda.gba')?.inCsv, false);
});

test('status and journal endpoints', async () => {
  const status = await api('GET', '/api/status');
  assert.equal(status.status, 200);
  assert.equal(status.body?.busy, null);
  const log = await api('GET', '/api/log');
  assert.equal(log.status, 200);
  assert.ok(Array.isArray(log.body?.entries));
});

test('errors have one format: { error, code } and no stack trace in a test/dev-free field set', async () => {
  const res = await api('GET', '/api/sd/tree?rel=../..');
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(errorShape(res.body)).sort(), ['code', 'error']);
  assert.equal(res.body?.code, 'PATH_OUTSIDE_ROOT');
  assert.equal(typeof res.body?.error, 'string');
});

test('path traversal through the API is refused (query, body and platform name)', async () => {
  assert.equal((await api('GET', '/api/sd/tree?rel=../')).status, 400);
  assert.equal((await api('GET', '/api/sd/tree?rel=%2Fetc')).status, 400);
  assert.equal((await api('GET', '/api/games/image?rel=../../etc/passwd')).status, 400);
  assert.equal((await api('POST', '/api/games/rename/preview', { body: { rel: '../x.gba', title: 'A' } })).status, 400);
  assert.equal((await api('DELETE', '/api/games', { body: { rel: '../x.gba', confirmed: true } })).status, 400);
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: '../etc' } })).status, 404);
});

test('system folders cannot be chosen', async () => {
  let res = await api('PUT', '/api/sd/platform', { body: { name: 'rootfs' } });
  assert.equal(res.status, 403);
  res = await api('PUT', '/api/settings', { body: { gamesDir: path.join(sd, 'cubegm') } });
  assert.equal(res.status, 403);
  assert.equal(res.body?.code, 'FORBIDDEN');
  res = await api('PUT', '/api/settings', { body: { gamesDir: path.join(work, 'elsewhere') } });
  assert.equal(res.status, 403);
  assert.equal(res.body?.code, 'PATH_OUTSIDE_ROOT');
});

test('request validation: wrong types and unknown shapes give a 400 with the field name', async () => {
  let res = await api('PUT', '/api/sd/root', { body: { root: 42 } });
  assert.equal(res.status, 400);
  assert.equal(res.body?.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body?.details));
  res = await api('PUT', '/api/sd/root', { body: {} });
  assert.equal(res.status, 400);
  res = await api('POST', '/api/games/rename', { body: { rel: 'Mario.gba', title: 'X' } }); // no confirmation
  assert.equal(res.status, 400);
  res = await api('PUT', '/api/settings', { body: { extensions: 'gba' } });
  assert.equal(res.status, 400);
});

test('malformed JSON and a wrong content type', async () => {
  let res = await api('PUT', '/api/sd/root', { body: '{not json', headers: { 'content-type': 'application/json' } });
  assert.equal(res.status, 400);
  assert.equal(res.body?.code, 'VALIDATION_ERROR');
  res = await api('PUT', '/api/sd/root', { body: 'root=x', headers: { 'content-type': 'text/plain' } });
  assert.equal(res.status, 415);
  assert.equal(res.body?.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('an unknown API route answers 404 in the same format', async () => {
  const res = await api('GET', '/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body?.code, 'NOT_FOUND');
  assert.equal(typeof res.body?.error, 'string');
});

test('the error message follows the X-Lang header', async () => {
  const en = await api('GET', '/api/nope');
  const uk = await api('GET', '/api/nope', { headers: { 'x-lang': 'uk' } });
  assert.notEqual(en.body?.error, uk.body?.error);
  assert.match(String(uk.body?.error), /[Ѐ-ӿ]/);
});

test('requests from other sites are refused; the web client origin gets CORS headers', async () => {
  const evil = await api('GET', '/api/settings', { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const client = await api('GET', '/api/settings', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(client.status, 200);
  assert.equal(client.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const preflight = await api('OPTIONS', '/api/settings', {
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'content-type,x-lang',
    },
  });
  assert.ok(preflight.status === 204 || preflight.status === 200);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('security headers are set and the server does not announce Express', async () => {
  const res = await api('GET', '/api/settings');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
});
