import { work } from '../helpers/env.ts';
import '../helpers/desktop.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { coreDirFromConfig, setEmulatorHost, setEmulatorSpawner } from '../../src/services/emulatorService.ts';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const home = path.join(work, 'home');
const bin = path.join(work, 'bin');
const p = (...parts: string[]): string => path.join(sd, ...parts);

await write(p('GBA', 'Mario.gba'), 'rom');
await write(p('SFC', 'Zelda.sfc'), 'rom');
await write(p('PS', 'Disc.img'), 'img');
await write(p('PS', 'Other.cue'), 'cue');
await write(p('MAME', 'pacman.zip'), 'zip');
assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);

interface Status {
  enabled: boolean;
  emulator: string;
  path: string | null;
  source: string | null;
  downloadUrl: string;
  settingsError: string | null;
  game: { launchable: boolean; reason: string | null; note: string | null; core: string | null } | null;
}
const status = async (rel?: string): Promise<Status> => {
  const res = await api('GET', `/api/emulator${rel ? `?rel=${encodeURIComponent(rel)}` : ''}`);
  assert.equal(res.status, 200, res.text);
  return res.body as unknown as Status;
};
const platform = async (name: string): Promise<void> => {
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name } })).status, 200);
};

const launched: string[][] = [];
setEmulatorSpawner(async (command, args) => {
  launched.push([command, ...args]);
});
const linux = (): void => setEmulatorHost({ os: 'linux', home, env: { PATH: bin }, findApp: async () => null });

test('Linux without RetroArch: not installed, the download page is RetroArch’s', async () => {
  linux();
  await platform('GBA');
  const result = await status('Mario.gba');
  assert.equal(result.enabled, true);
  assert.equal(result.emulator, 'RetroArch');
  assert.equal(result.path, null);
  assert.equal(result.downloadUrl, 'https://www.retroarch.com');
  assert.equal(result.game?.launchable, false);
  assert.equal((await api('POST', '/api/emulator/launch', { body: { rel: 'Mario.gba' } })).status, 400);
});

test('RetroArch in PATH with an installed core: the game starts with -L <core> "<game>"', async () => {
  await write(path.join(bin, 'retroarch'), '#!/bin/sh\n');
  await write(path.join(home, '.config', 'retroarch', 'cores', 'mgba_libretro.so'), 'core');
  linux();
  await platform('GBA');
  const result = await status('Mario.gba');
  assert.equal(result.path, path.join(bin, 'retroarch'));
  assert.equal(result.source, 'auto');
  assert.deepEqual(result.game, { launchable: true, reason: null, note: null, core: 'mgba' });

  launched.length = 0;
  const res = await api('POST', '/api/emulator/launch', { body: { rel: 'Mario.gba' } });
  assert.equal(res.status, 200, res.text);
  assert.deepEqual(res.body, { emulator: 'RetroArch', core: 'mgba' });
  assert.deepEqual(launched, [
    [path.join(bin, 'retroarch'), '-L', path.join(home, '.config', 'retroarch', 'cores', 'mgba_libretro.so'), p('GBA', 'Mario.gba')],
  ]);
});

test('no core for the platform: the button explains which cores to install', async () => {
  linux();
  await platform('SFC');
  const result = await status('Zelda.sfc');
  assert.equal(result.game?.launchable, false);
  assert.match(result.game?.reason ?? '', /SFC \(Super Nintendo \(SNES\)\).*snes9x, bsnes/);
  const res = await api('POST', '/api/emulator/launch', { body: { rel: 'Zelda.sfc' } });
  assert.equal(res.status, 400);
});

test('the cores folder of retroarch.cfg is used (":" — the program folder, "~" — home)', async () => {
  assert.equal(coreDirFromConfig('libretro_directory = "~/my cores"\n', '/opt/ra', '/home/me'), path.join('/home/me', 'my cores'));
  assert.equal(coreDirFromConfig('video_driver = "gl"\nlibretro_directory = ":\\cores"\n', 'C:\\RA', 'x'), path.join('C:\\RA', '\\cores'));
  assert.equal(coreDirFromConfig('libretro_directory = "default"', '/opt', '/home'), null);

  await write(path.join(home, '.config', 'retroarch', 'retroarch.cfg'), 'libretro_directory = "~/custom-cores"\n');
  await write(path.join(home, 'custom-cores', 'snes9x_libretro.so'), 'core');
  linux();
  await platform('SFC');
  assert.deepEqual((await status('Zelda.sfc')).game, { launchable: true, reason: null, note: null, core: 'snes9x' });
});

test('macOS: OpenEmu found by its bundle id starts with open -a; unsupported platforms and formats are explained', async () => {
  const app = path.join(work, 'Apps', 'OpenEmu.app');
  await write(path.join(app, 'Contents', 'Info.plist'), 'plist');
  setEmulatorHost({
    os: 'darwin',
    home,
    env: {},
    appDirs: [path.join(work, 'no-apps')],
    findApp: async (id) => (id === 'org.openemu.OpenEmu' ? app : null),
  });
  await platform('GBA');
  const result = await status('Mario.gba');
  assert.equal(result.emulator, 'OpenEmu');
  assert.equal(result.downloadUrl, 'https://openemu.org');
  assert.equal(result.path, app);
  assert.deepEqual(result.game, { launchable: true, reason: null, note: null, core: null });
  launched.length = 0;
  assert.equal((await api('POST', '/api/emulator/launch', { body: { rel: 'Mario.gba' } })).status, 200);
  assert.deepEqual(launched, [['open', '-a', app, p('GBA', 'Mario.gba')]]);

  await platform('PS');
  const img = await status('Disc.img');
  assert.equal(img.game?.launchable, false);
  assert.match(img.game?.reason ?? '', /\.img.*\.cue/);
  assert.equal(img.game?.note, 'Support for .img files is coming in a future release.', 'a second, separate line');
  assert.doesNotMatch(img.game?.reason ?? '', /future release/);
  assert.equal((await status('Other.cue')).game?.launchable, true);

  await platform('MAME');
  const mame = (await status('pacman.zip')).game;
  assert.match(mame?.reason ?? '', /OpenEmu does not support MAME/);
  assert.equal(mame?.note, null, 'only planned formats get the note');
});

test('the emulator chosen in the settings wins; a path that does not exist is refused', async () => {
  const custom = path.join(work, 'tools', 'retroarch-custom');
  await write(custom, '#!/bin/sh\n');
  linux();
  let res = await api('PUT', '/api/settings', { body: { emulatorPath: custom } });
  assert.equal(res.status, 200, res.text);
  const result = await status();
  assert.equal(result.path, custom);
  assert.equal(result.source, 'settings');
  assert.equal(result.game, null);

  res = await api('PUT', '/api/settings', { body: { emulatorPath: path.join(work, 'nowhere', 'retroarch') } });
  assert.equal(res.status, 400);
  res = await api('PUT', '/api/settings', { body: { emulatorPath: '' } });
  assert.equal(res.status, 200, res.text);
  assert.equal((await status()).source, 'auto');
});

test('a failed start is reported with the emulator’s message', async () => {
  linux();
  await platform('GBA');
  setEmulatorSpawner(async () => {
    throw new Error('error while loading shared libraries: libGL.so.1');
  });
  try {
    const res = await api('POST', '/api/emulator/launch', { body: { rel: 'Mario.gba' } });
    assert.equal(res.status, 500);
    assert.match(String(res.body?.error), /RetroArch could not be started: .*libGL/);
  } finally {
    setEmulatorSpawner(null);
  }
});

test('a path outside the games folder is refused', async () => {
  const res = await api('POST', '/api/emulator/launch', { body: { rel: '../SFC/Zelda.sfc' } });
  assert.equal(res.status, 400);
});
