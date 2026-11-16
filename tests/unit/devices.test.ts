import '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canCompressToZip, platformInfo, platformName, platformOrder } from '../../shared/devices.ts';
import {
  DEFAULT_DEVICE_ID,
  allDevices,
  cardMarkerNames,
  detectDevice,
  deviceById,
  isDeviceId,
  listDevices,
  mergeProfile,
  resolveProfiles,
  systemFolderNames,
} from '../../src/services/devices/registry.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the models: five consoles sharing the base layout; the abstract base is not offered', () => {
  assert.deepEqual(listDevices(), [
    { id: 'sf3000', name: 'SF3000' },
    { id: 'sf3000-hd', name: 'SF3000 HD' },
    { id: 'sf3000-hd-no-hdmi', name: 'SF3000 HD (no HDMI)' },
    { id: 'sf3100', name: 'SF3100' },
    { id: 'sf3500', name: 'SF3500' },
  ]);
  assert.equal(DEFAULT_DEVICE_ID, 'sf3000');
  assert.ok(!isDeviceId('sf3000-family'), 'the base is only inherited');
  const base = allDevices()[0]!;
  for (const device of allDevices()) {
    const { id: _id, name: _name, order: _order, tips, ...layout } = device;
    const { id: _bid, name: _bname, order: _border, tips: baseTips, ...baseLayout } = base;
    assert.deepEqual(layout, baseLayout, `${device.id} inherits the whole card layout`);
    assert.deepEqual(
      [tips.cpu, tips.incompatibleFirmware],
      [baseTips.cpu, baseTips.incompatibleFirmware],
      `${device.id}: firmware warning`,
    );
    // The stock firmware page is the SF3000's (shared by the HD models); the community page comes from the base profile.
    const firmware = ['sf3000', 'sf3000-hd', 'sf3000-hd-no-hdmi'].includes(device.id) ? 'https://handhelds.wiki/SF3000' : '';
    assert.deepEqual(
      [tips.firmwareLink, tips.communityLink],
      [firmware, 'https://r36sx-hub.neocities.org/'],
      `${device.id}: firmware and community links`,
    );
  }
});

test('the base profile describes the card as before: platforms, system folders, list format, saves, covers, formats', () => {
  const device = deviceById('sf3000');
  assert.deepEqual(
    device.platforms.map((platform) => platform.folder),
    ['FC', 'SFC', 'GBA', 'GB', 'GBC', 'MD', 'PS', 'PCE', 'SMS', 'GG', 'NGPC', 'WSC', 'ATARI', 'MAME'],
  );
  assert.equal(platformName(device, 'SFC'), 'Super Nintendo (SNES)');
  assert.equal(platformName(device, 'MAME'), 'Arcade (MAME)');
  assert.equal(platformInfo(device, 'FC')?.system, 'FC', 'the emulator system defaults to the folder');
  assert.deepEqual(device.folders, { system: ['rootfs', 'cubegm'], saves: 'cubegm', media: ['ebook', 'photo', 'bgm', 'music', 'movie'] });
  assert.deepEqual(device.saves, {
    saves: 'saves',
    states: 'states',
    lists: ['allfiles.lst', 'favorites.lst', 'recent.lst'],
    mainList: 'allfiles.lst',
    listFormat: { separator: '|', fields: ['path', 'title', 'titleUpper', 'short', 'shortUpper'] },
    cores: 'cores/filelist.xml',
  });
  assert.deepEqual(device.csv, {
    fileName: 'filelist.csv',
    delimiter: ',',
    encoding: 'utf8',
    header: false,
    bom: true,
    lineEnding: 'crlf',
  });
  assert.deepEqual(device.covers, { folder: 'images', width: 640, height: 480 });
  assert.ok(device.extensions.includes('gba') && device.extensions.includes('img'));
  assert.equal(device.tips.cpu, 'MIPS');
  assert.ok([...systemFolderNames].includes('cubegm') && [...systemFolderNames].includes('rootfs'));
  assert.deepEqual([...cardMarkerNames].sort(), ['cubegm', 'rootfs']);
});

test('lookups: folders without regard to case; unknown folders; .zip everywhere except PlayStation', () => {
  const device = deviceById('sf3100');
  assert.equal(platformInfo(device, 'Gba')?.folder, 'GBA');
  assert.equal(platformName(device, 'roms'), null);
  assert.equal(platformOrder(device, 'roms'), -1);
  assert.ok(platformOrder(device, 'FC') < platformOrder(device, 'MAME'));
  assert.equal(canCompressToZip(device, 'ps'), false);
  assert.equal(canCompressToZip(device, 'GBA'), true);
  assert.equal(canCompressToZip(device, ''), true, 'no platform: a games folder chosen by hand');
  assert.equal(platformName(null, 'SFC'), null, 'no profile loaded');
  assert.equal(deviceById('removed-model').id, 'sf3000', 'an unknown id falls back to the default model');
});

test('detection: a card of the family is recognized; same layout → the chosen model stays; no markers → null', () => {
  const card = new Set(['cubegm', 'rootfs', 'gba', 'sfc']);
  assert.deepEqual(detectDevice(card, 'sf3100'), { id: 'sf3100', ambiguous: true }, 'the setting is kept among equals');
  assert.deepEqual(detectDevice(card, 'unknown'), { id: 'sf3000', ambiguous: true }, 'otherwise the first model');
  assert.deepEqual(detectDevice(new Set(['rootfs']), 'sf3500')?.id, 'sf3500');
  assert.equal(detectDevice(new Set(['roms', 'gba']), 'sf3000'), null);
});

test('detection picks the model whose markers match best', () => {
  const base = deviceById('sf3000');
  const special = { ...base, id: 'special', name: 'Special', detect: { anyOf: ['cubegm'], allOf: ['special.cfg'] } };
  const card = new Set(['cubegm', 'special.cfg']);
  assert.deepEqual(detectDevice(card, 'sf3000', [base, special]), { id: 'special', ambiguous: false });
  assert.deepEqual(detectDevice(new Set(['cubegm']), 'special', [base, special]), { id: 'sf3000', ambiguous: false });
});

test('inheritance: objects merge key by key, lists replace; broken profiles are reported, not loaded', () => {
  assert.deepEqual(mergeProfile({ a: { x: 1, y: 2 }, list: [1, 2] }, { a: { y: 3 }, list: [9] }), { a: { x: 1, y: 3 }, list: [9] });
  const family = JSON.parse(fs.readFileSync(path.join(root, 'devices/sf3000-family.json'), 'utf8')) as Record<string, unknown>;
  const raw = new Map<string, Record<string, unknown>>([
    ['sf3000-family', family],
    ['tiny', { id: 'tiny', extends: 'sf3000-family', name: 'Tiny', covers: { width: 320 } }],
    ['orphan', { id: 'orphan', extends: 'nothing', name: 'Orphan' }],
    ['loop-a', { id: 'loop-a', extends: 'loop-b', name: 'A' }],
    ['loop-b', { id: 'loop-b', extends: 'loop-a', name: 'B' }],
    ['wrong-id', { id: 'other', extends: 'sf3000-family', name: 'Wrong' }],
    [
      'bad-color',
      {
        id: 'bad-color',
        extends: 'sf3000-family',
        name: 'Bad',
        platforms: [{ folder: 'X', name: 'X', cover: { from: 'red', to: '#000000', accent: '#000000' } }],
      },
    ],
  ]);
  const { devices, problems } = resolveProfiles(raw);
  assert.deepEqual(
    devices.map((device) => device.id),
    ['tiny'],
  );
  assert.deepEqual(devices[0]?.covers, { folder: 'images', width: 320, height: 480 }, 'one value overridden, the rest inherited');
  for (const id of ['orphan', 'loop-a', 'wrong-id', 'bad-color'])
    assert.ok(
      problems.some((problem) => problem.startsWith(id)),
      id,
    );
});

test('every profile file is valid JSON whose id is its file name', () => {
  for (const name of fs.readdirSync(path.join(root, 'devices')).filter((file) => file.endsWith('.json'))) {
    const profile = JSON.parse(fs.readFileSync(path.join(root, 'devices', name), 'utf8')) as { id?: string };
    assert.equal(profile.id, name.replace(/\.json$/, ''), name);
  }
});
