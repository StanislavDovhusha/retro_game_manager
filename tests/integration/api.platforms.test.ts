import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
// SFC: counted by its CSV (two entries, three files); GBA: no CSV, counted by the files; MD: empty.
await write(path.join(sd, 'SFC', 'Mario.sfc'), 'rom');
await write(path.join(sd, 'SFC', 'Zelda.sfc'), 'rom');
await write(path.join(sd, 'SFC', 'Extra.sfc'), 'rom');
await write(path.join(sd, 'SFC', 'filelist.csv'), 'Mario.sfc,Mario,mario,\nZelda.sfc,Zelda,zelda,\n');
await write(path.join(sd, 'GBA', 'Metroid.gba'), 'rom');
await write(path.join(sd, 'GBA', 'images', 'Metroid.png'), 'png');
await write(path.join(sd, 'MD', '.keep'), '');
await write(path.join(sd, 'roms', 'x.zip'), 'zip');
for (const skipped of ['cubegm/allfiles.lst', 'rootfs/a', 'Ebook/b.txt', 'Photo/c.jpg', 'Movie/d.mp4']) {
  await write(path.join(sd, ...skipped.split('/')), 'x');
}

interface Summary {
  name: string;
  label: string | null;
  games: number;
  counted: string;
}

test('no card: no platforms', async () => {
  const res = await api('GET', '/api/sd/platforms');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { root: '', platforms: [] });
});

test('the platform list: counts, sorted by the full name, without system and media folders', async () => {
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
  const res = await api('GET', '/api/sd/platforms');
  assert.equal(res.status, 200);
  const platforms = res.body?.platforms as Summary[];
  // Game Boy Advance, Sega Mega Drive / Genesis, Super Nintendo (SNES), then "roms" (no full name).
  assert.deepEqual(
    platforms.map((p) => p.name),
    ['GBA', 'roms', 'MD', 'SFC'],
  );
  const byName = Object.fromEntries(platforms.map((p) => [p.name, p]));
  assert.deepEqual(byName.SFC && { games: byName.SFC.games, counted: byName.SFC.counted }, { games: 2, counted: 'csv' });
  assert.deepEqual(byName.GBA && { games: byName.GBA.games, counted: byName.GBA.counted }, { games: 1, counted: 'files' });
  assert.equal(byName.MD?.games, 0);
  assert.equal(byName.roms?.label, null);
  assert.ok(byName.SFC?.label?.includes('Super Nintendo'));
  for (const hidden of ['cubegm', 'rootfs', 'Ebook', 'Photo', 'Movie']) assert.ok(!byName[hidden], hidden);
});

test('choosing a platform and going back to all platforms', async () => {
  let res = await api('PUT', '/api/sd/platform', { body: { name: 'SFC' } });
  assert.equal(res.status, 200);
  assert.equal((res.body?.settings as { platform: string }).platform, 'SFC');

  res = await api('DELETE', '/api/sd/platform');
  assert.equal(res.status, 200);
  const settings = res.body?.settings as { sdRoot: string; platform: string; gamesDir: string; csvPath: string; imagesDir: string };
  assert.equal(settings.sdRoot, sd, 'the card stays');
  assert.deepEqual([settings.platform, settings.gamesDir, settings.imagesDir, settings.csvPath], ['', '', '', '']);

  // Twice is fine.
  assert.equal((await api('DELETE', '/api/sd/platform')).status, 200);
});

test('the count follows the CSV after a game is added to it', async () => {
  await write(path.join(sd, 'SFC', 'filelist.csv'), 'Mario.sfc,Mario,mario,\nZelda.sfc,Zelda,zelda,\nExtra.sfc,Extra,extra,\n');
  const platforms = (await api('GET', '/api/sd/platforms')).body?.platforms as Summary[];
  assert.equal(platforms.find((p) => p.name === 'SFC')?.games, 3);
});

test('another card: the platform of the previous card is forgotten', async () => {
  await api('PUT', '/api/sd/platform', { body: { name: 'GBA' } });
  const other = path.join(work, 'SD2');
  await write(path.join(other, 'GBA', 'Pokemon.gba'), 'rom');
  const res = await api('PUT', '/api/sd/root', { body: { root: other } });
  assert.equal(res.status, 200);
  const settings = res.body?.settings as { sdRoot: string; platform: string; gamesDir: string };
  assert.deepEqual([settings.sdRoot, settings.platform, settings.gamesDir], [other, '', '']);

  // The same card chosen again keeps its platform.
  await api('PUT', '/api/sd/platform', { body: { name: 'GBA' } });
  const again = (await api('PUT', '/api/sd/root', { body: { root: other } })).body?.settings as { platform: string };
  assert.equal(again.platform, 'GBA');
});

test('Music is a media folder in any letter case: not a platform, not searched, no games or filelist.csv go there', async () => {
  const card = path.join(work, 'SD-music');
  await write(path.join(card, 'GBA', 'Metroid.gba'), 'rom');
  await write(path.join(card, 'MUSIC', 'song.gba'), 'not a game, even with a game extension');
  await write(path.join(card, 'music2', 'x.gba'), 'a folder that only starts with "music" is a platform folder');
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: card } })).status, 200);

  const names = ((await api('GET', '/api/sd/platforms')).body?.platforms as Summary[]).map((p) => p.name);
  assert.deepEqual(names.sort(), ['GBA', 'music2']);
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'MUSIC' } })).status, 404, 'cannot be chosen as a platform');

  const index = (await api('GET', '/api/search/index')).body?.games as { folder: string }[];
  assert.ok(!index.some((game) => game.folder === 'MUSIC'), 'not searched');

  // Chosen by hand as the games folder: the sync and adding a game refuse it, and nothing is created there.
  const settings = await api('PUT', '/api/settings', {
    body: {
      gamesDir: path.join(card, 'MUSIC'),
      csvPath: path.join(card, 'MUSIC', 'filelist.csv'),
      imagesDir: path.join(card, 'MUSIC', 'images'),
    },
  });
  assert.equal(settings.status, 200, settings.text);
  const preview = await api('POST', '/api/sync/preview');
  assert.equal(preview.status, 400);
  assert.match(String(preview.body?.error), /MUSIC is a media folder/);
  assert.equal((await api('POST', '/api/sync/apply', { body: { confirmed: true } })).status, 400);
  await write(path.join(work, 'src', 'Song Game.gba'), 'rom');
  const added = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: path.join(work, 'src', 'Song Game.gba') }, title: 'Song Game', image: null },
  });
  assert.equal(added.status, 400);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(path.join(card, 'MUSIC', 'filelist.csv')), false, 'no filelist.csv in the media folder');
  assert.equal(existsSync(path.join(card, 'MUSIC', 'Song Game.gba')), false);
});
