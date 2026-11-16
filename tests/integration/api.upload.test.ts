import { work } from '../helpers/env.ts';
import '../helpers/smallLimits.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { exists, read, write } from '../helpers/fs.ts';
import { PNG } from '../helpers/images.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const octet = { 'content-type': 'application/octet-stream' };

await write(path.join(sd, 'GBA', 'filelist.csv'), 'Existing.gba,Existing,existing\n');
assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'GBA' } })).status, 200);
assert.equal((await api('PUT', '/api/settings', { body: { extensions: ['gba', 'zip'] } })).status, 200);

test('a dropped game and cover are uploaded as raw streams, then added to the library', async () => {
  const game = await api('PUT', '/api/upload?kind=game', {
    raw: Buffer.from('rom-bytes'),
    headers: { ...octet, 'x-file-name': encodeURIComponent('Моя игра.gba') },
  });
  assert.equal(game.status, 200, game.text);
  assert.equal(game.body?.name, 'Моя игра.gba');
  assert.equal(game.body?.size, 9);
  const cover = await api('PUT', '/api/upload?kind=image', { raw: PNG, headers: { ...octet, 'x-file-name': 'cover.png' } });
  assert.equal(cover.status, 200, cover.text);

  const added = await api('POST', '/api/games/add', {
    body: { game: { type: 'upload', id: game.body?.id }, title: 'Dropped Game', image: { type: 'upload', id: cover.body?.id } },
  });
  assert.equal(added.status, 200, added.text);
  assert.equal(await read(path.join(sd, 'GBA', 'Dropped Game.gba')), 'rom-bytes');
  assert.ok(await exists(path.join(sd, 'GBA', 'images', 'Dropped Game.png')));
  // The staged files are not reusable ids from outside: the temporary copies are gone after the game was added.
  const staging = path.join(work, 'data', 'staging');
  assert.deepEqual(await fs.readdir(staging).catch(() => []), []);
});

test('the upload size limits answer 413', async () => {
  const image = await api('PUT', '/api/upload?kind=image', { raw: Buffer.alloc(3000, 1), headers: { ...octet, 'x-file-name': 'big.png' } });
  assert.equal(image.status, 413);
  assert.equal(image.body?.code, 'PAYLOAD_TOO_LARGE');
  const game = await api('PUT', '/api/upload?kind=game', { raw: Buffer.alloc(5000, 1), headers: { ...octet, 'x-file-name': 'big.gba' } });
  assert.equal(game.status, 413);
});

test('upload types: the extension must be allowed and an image must really be an image', async () => {
  const exe = await api('PUT', '/api/upload?kind=game', { raw: Buffer.from('MZ'), headers: { ...octet, 'x-file-name': 'virus.exe' } });
  assert.equal(exe.status, 400);
  const fake = await api('PUT', '/api/upload?kind=image', {
    raw: Buffer.from('<html>'),
    headers: { ...octet, 'x-file-name': 'cover.png' },
  });
  assert.equal(fake.status, 400);
  const svg = await api('PUT', '/api/upload?kind=image', { raw: Buffer.from('<svg/>'), headers: { ...octet, 'x-file-name': 'cover.svg' } });
  assert.equal(svg.status, 400);
});

test('upload request validation: kind, file name header, content type', async () => {
  assert.equal((await api('PUT', '/api/upload?kind=other', { raw: PNG, headers: { ...octet, 'x-file-name': 'a.png' } })).status, 400);
  assert.equal((await api('PUT', '/api/upload?kind=image', { raw: PNG, headers: octet })).status, 400);
  assert.equal((await api('PUT', '/api/upload?kind=image', { raw: PNG, headers: { ...octet, 'x-file-name': '%E0%A4%A' } })).status, 400);
  assert.equal(
    (await api('PUT', '/api/upload?kind=image', { raw: PNG, headers: { 'content-type': 'text/plain', 'x-file-name': 'a.png' } })).status,
    415,
  );
});

test('a path in the file name is reduced to its last segment (no writing outside the staging folder)', async () => {
  const res = await api('PUT', '/api/upload?kind=game', {
    raw: Buffer.from('x'),
    headers: { ...octet, 'x-file-name': encodeURIComponent('../../../etc/evil.gba') },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body?.name, 'evil.gba');
  assert.equal((await api('DELETE', `/api/upload/${String(res.body?.id)}`)).status, 200);
  assert.equal((await api('DELETE', '/api/upload/..%2F..%2Fetc')).status, 200); // unknown ids are ignored
});

test('adding a game with an unknown or expired upload id is a 404', async () => {
  const res = await api('POST', '/api/games/add', { body: { game: { type: 'upload', id: 'does-not-exist' }, title: 'X', image: null } });
  assert.equal(res.status, 404);
});
