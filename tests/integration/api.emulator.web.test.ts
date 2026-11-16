import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

// No desktop flag: the server runs as the web version.
const api = await startApi();

test('web version: the emulator is not offered and nothing can be started', async () => {
  await write(path.join(work, 'Games', 'Mario.gba'), 'rom');
  assert.equal((await api('PUT', '/api/settings', { body: { gamesDir: path.join(work, 'Games') } })).status, 200);
  const res = await api('GET', '/api/emulator?rel=Mario.gba');
  assert.equal(res.status, 200);
  assert.equal(res.body?.enabled, false);
  assert.equal(res.body?.path, null);
  const launch = await api('POST', '/api/emulator/launch', { body: { rel: 'Mario.gba' } });
  assert.equal(launch.status, 403);
});
