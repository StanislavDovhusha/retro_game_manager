import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { getSettings, patchInternal } from '../../src/services/settingsService.ts';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();

interface Verify {
  settings: {
    sdRoot: string;
    platform: string;
    gamesDir: string;
    imagesDir: string;
    csvPath: string;
    device: string;
    ui: { language: string };
  };
  reset: { root: string; reason: string; systemDenied: boolean } | null;
}

async function chooseCard(sd: string): Promise<void> {
  await write(path.join(sd, 'GBA', 'Mario.gba'), 'rom');
  await write(path.join(sd, 'cubegm', 'allfiles.lst'), '');
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'GBA' } })).status, 200);
}

test('no saved card: nothing to check', async () => {
  const res = await api('POST', '/api/sd/verify');
  assert.equal(res.status, 200);
  assert.equal((res.body as unknown as Verify).reset, null);
});

test('an available card stays selected', async () => {
  const sd = path.join(work, 'SD-ok');
  await chooseCard(sd);
  const res = await api('POST', '/api/sd/verify');
  assert.equal(res.status, 200);
  const body = res.body as unknown as Verify;
  assert.equal(body.reset, null);
  assert.equal(body.settings.sdRoot, sd);
  assert.equal(body.settings.platform, 'GBA');
});

test('a card that is gone: the card, platform and paths are reset, the other settings stay', async () => {
  const sd = path.join(work, 'SD-gone');
  await chooseCard(sd);
  await api('PUT', '/api/settings', { body: { ui: { language: 'de' } } });
  await patchInternal((settings) => {
    settings.imageOverrides = { 'Mario.gba': path.join(sd, 'GBA', 'images', 'x.png') };
  });
  const device = (await getSettings()).device;
  await fs.rm(sd, { recursive: true, force: true });

  const res = await api('POST', '/api/sd/verify');
  assert.equal(res.status, 200);
  const body = res.body as unknown as Verify;
  assert.deepEqual(body.reset, { root: sd, reason: 'missing', systemDenied: false });
  const { sdRoot, platform, gamesDir, imagesDir, csvPath } = body.settings;
  assert.deepEqual(
    { sdRoot, platform, gamesDir, imagesDir, csvPath },
    { sdRoot: '', platform: '', gamesDir: '', imagesDir: '', csvPath: '' },
  );
  assert.equal(body.settings.ui.language, 'de', 'the language stays');
  assert.equal(body.settings.device, device, 'the console model stays');
  assert.deepEqual((await getSettings()).imageOverrides, {});

  const sdState = await api('GET', '/api/sd');
  assert.equal(sdState.body?.root, '');

  const log = await api('GET', '/api/log');
  const entries = log.body?.entries as { level: string; message: string }[];
  assert.ok(
    entries.some((entry) => entry.level === 'warn' && entry.message.includes(sd) && entry.message.includes('the path was not found')),
    JSON.stringify(entries.slice(-3)),
  );

  // The next start has nothing to reset.
  assert.equal(((await api('POST', '/api/sd/verify')).body as unknown as Verify).reset, null);
});

test('a folder chosen by hand outside the card is not touched by the reset', async () => {
  const own = path.join(work, 'own-games');
  await fs.mkdir(own, { recursive: true });
  await patchInternal((settings) => {
    settings.sdRoot = path.join(work, 'SD-missing');
    settings.gamesDir = own;
  });
  const body = (await api('POST', '/api/sd/verify')).body as unknown as Verify;
  assert.equal(body.reset?.reason, 'missing');
  assert.equal(body.settings.sdRoot, '');
  assert.equal(body.settings.gamesDir, own);
});
