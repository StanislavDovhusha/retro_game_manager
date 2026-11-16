import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { CsvTable } from '../../src/models/index.ts';
import { detectPlatformPaths, findPlatform, listChildren, listPlatforms } from '../../src/services/sdCardService.ts';
import { getSettings, updateSettings } from '../../src/services/settingsService.ts';
import { copyAtomic } from '../../src/services/fs/copy.ts';
import { scanGames } from '../../src/services/fs/scanner.ts';
import { writeCsv } from '../../src/services/csv/store.ts';
import { exists, isAppError, write } from '../helpers/fs.ts';
import { deviceById } from '../../src/services/devices/registry.ts';

const sd = path.join(work, 'SD');
const mk = (...parts: string[]): Promise<string | undefined> => fs.mkdir(path.join(sd, ...parts), { recursive: true });

for (const dir of [
  'GBA',
  'GBC',
  'GB',
  'SFC',
  'FC',
  'MD',
  'PS',
  'ATARI',
  'roms',
  'Ebook',
  'Photo',
  'Movie',
  'MUSIC',
  'rootfs',
  'cubegm',
  '.hidden',
  'System Volume Information',
])
  await mk(dir);
await mk('PS', 'images');
await mk('Movie', 'Season 1');
await mk('rootfs', 'etc');
await write(path.join(sd, 'PS', 'filelist.csv'), '');
await write(path.join(sd, 'GBA', 'Mario.gba'), 'x');
await write(path.join(sd, 'GBA', 'list.csv'), '');
await write(path.join(sd, 'rootfs', 'etc', 'a.gba'), 'x');

test('only game folders are listed, in the order of the card', async () => {
  const platforms = await listPlatforms(sd);
  const names = platforms.map((platform) => platform.name);
  assert.deepEqual(names, ['FC', 'SFC', 'GBA', 'GB', 'GBC', 'MD', 'PS', 'ATARI', 'roms']);
  for (const hidden of ['Ebook', 'Photo', 'BGM', 'Movie', 'MUSIC', 'rootfs', 'cubegm', '.hidden', 'System Volume Information'])
    assert.ok(!names.includes(hidden), hidden);
  assert.equal(platforms.find((platform) => platform.name === 'PS')?.label, 'PlayStation');
  assert.equal(platforms.find((platform) => platform.name === 'SFC')?.label, 'Super Nintendo (SNES)');
  assert.equal(platforms.find((platform) => platform.name === 'roms')?.label, null, 'a folder outside the directory has no full name');
});

test('platform paths: the found images folder and CSV, otherwise the standard names', async () => {
  const psx = await detectPlatformPaths(path.join(sd, 'PS'), deviceById('sf3000'));
  assert.equal(psx.imagesDir, path.join(sd, 'PS', 'images'));
  assert.ok(psx.imagesExist);
  assert.equal(psx.csvPath, path.join(sd, 'PS', 'filelist.csv'));
  assert.ok(psx.csvExists);
  const gba = await detectPlatformPaths(path.join(sd, 'GBA'), deviceById('sf3000')); // a single foreign .csv is taken
  assert.equal(gba.csvPath, path.join(sd, 'GBA', 'list.csv'));
  assert.ok(!gba.imagesExist);
  const gbc = await detectPlatformPaths(path.join(sd, 'GBC'), deviceById('sf3000')); // nothing there: standard names
  assert.equal(gbc.csvPath, path.join(sd, 'GBC', 'filelist.csv'));
  assert.equal(gbc.imagesDir, path.join(sd, 'GBC', 'images'));
  assert.ok(!gbc.csvExists);
});

test('tree: the root, nested folders, system folders are not expanded', async () => {
  const root = await listChildren(sd, '');
  const kind = Object.fromEntries(root.nodes.map((node) => [node.name, node.kind]));
  assert.equal(kind.PS, 'platform');
  assert.equal(kind.rootfs, 'system');
  assert.equal(kind.cubegm, 'system');
  assert.equal(kind.Movie, 'media');
  assert.equal(kind.MUSIC, 'media', 'Music is a media folder in any letter case');
  assert.equal(root.nodes.find((node) => node.name === 'MUSIC')?.label, null, 'shown as a plain folder, without a platform name');
  assert.ok(!('.hidden' in kind));
  assert.equal(root.nodes.find((node) => node.name === 'Movie')?.hasChildren, true);
  assert.equal(root.nodes.find((node) => node.name === 'rootfs')?.hasChildren, false);
  const movie = await listChildren(sd, 'Movie');
  assert.deepEqual(
    movie.nodes.map((node) => [node.name, node.rel, node.kind]),
    [['Season 1', 'Movie/Season 1', 'folder']],
  );
  assert.deepEqual((await listChildren(sd, 'rootfs')).nodes, []);
  assert.deepEqual((await listChildren(sd, 'rootfs/etc')).nodes, []);
});

test('tree: leaving the card is forbidden', async () => {
  await assert.rejects(listChildren(sd, '../'), isAppError(400, 'PATH_OUTSIDE_ROOT'));
  await assert.rejects(listChildren(sd, 'Movie/../../'), isAppError(400, 'PATH_OUTSIDE_ROOT'));
  await assert.rejects(listChildren(sd, '/etc'), isAppError(400, 'PATH_OUTSIDE_ROOT'));
  await assert.rejects(listChildren(sd, 'NoSuch'), isAppError(404));
});

test('a platform is looked up by name among the real folders; system and missing folders are refused', async () => {
  await assert.rejects(findPlatform(sd, 'rootfs'), isAppError(403, 'FORBIDDEN'));
  await assert.rejects(findPlatform(sd, 'cubegm'), isAppError(403, 'FORBIDDEN'));
  await assert.rejects(findPlatform(sd, 'Ebook'), isAppError(404));
  await assert.rejects(findPlatform(sd, '../etc'), isAppError(404));
  assert.equal((await findPlatform(sd, 'PS')).name, 'PS');
});

test('settings: the platform is valid only while the games folder is <root>/<platform>', async () => {
  const psx = await findPlatform(sd, 'PS');
  let settings = await updateSettings({ sdRoot: sd });
  assert.equal(settings.platform, '');
  settings = await updateSettings({ gamesDir: psx.path, imagesDir: psx.imagesDir, csvPath: psx.csvPath, platform: 'PS' });
  assert.equal(settings.platform, 'PS');
  assert.equal(settings.csvPath, path.join(sd, 'PS', 'filelist.csv'));
  settings = await updateSettings({ gamesDir: path.join(sd, 'GBA') }); // changing the folder by hand resets the platform
  assert.equal(settings.platform, '');
  assert.equal((await getSettings()).sdRoot, sd);
});

test('settings: paths must stay inside the SD root once a card is selected', async () => {
  await updateSettings({ sdRoot: sd });
  await fs.mkdir(path.join(work, 'elsewhere'), { recursive: true });
  await assert.rejects(updateSettings({ gamesDir: path.join(work, 'elsewhere') }), isAppError(403, 'PATH_OUTSIDE_ROOT'));
  await assert.rejects(updateSettings({ csvPath: path.join(work, 'elsewhere', 'f.csv') }), isAppError(403, 'PATH_OUTSIDE_ROOT'));
  await assert.rejects(updateSettings({ gamesDir: 'GBA' }), isAppError(400, 'VALIDATION_ERROR'));
  await assert.rejects(updateSettings({ gamesDir: path.join(sd, 'NoSuchFolder') }), isAppError(400));
});

const EMPTY_CSV: CsvTable = {
  headers: [],
  rows: [],
  hasHeader: false,
  hadBom: false,
  eol: '\n',
  delimiter: ',',
  encoding: 'utf8',
  exists: false,
};

test('rootfs and cubegm cannot be selected, written or deleted; the scanner skips them', async () => {
  await updateSettings({ sdRoot: sd });
  for (const key of ['gamesDir', 'imagesDir'] as const) {
    await assert.rejects(updateSettings({ [key]: path.join(sd, 'rootfs', 'etc') }), isAppError(403, 'FORBIDDEN'));
  }
  await assert.rejects(updateSettings({ csvPath: path.join(sd, 'cubegm', 'filelist.csv') }), isAppError(403, 'FORBIDDEN'));
  await assert.rejects(writeCsv(path.join(sd, 'rootfs', 'filelist.csv'), EMPTY_CSV), isAppError(403, 'FORBIDDEN'));
  await assert.rejects(copyAtomic(path.join(sd, 'GBA', 'Mario.gba'), path.join(sd, 'rootfs', 'x.gba'), 1), isAppError(403, 'FORBIDDEN'));
  assert.ok(!(await exists(path.join(sd, 'rootfs', 'x.gba'))));
  const scan = await scanGames(sd, ['gba']); // games at the card level: rootfs/etc/a.gba is not listed
  assert.deepEqual(
    scan.files.map((file) => file.rel),
    ['GBA/Mario.gba'],
  );
  assert.ok(!scan.dirs.some((dir) => dir.startsWith('rootfs')));
});
