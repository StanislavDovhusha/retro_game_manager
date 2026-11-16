import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);

interface Hit {
  platform: string;
  folder: string;
  rel: string;
  title: string;
  short: string;
  tags: string[];
}
const index = async (): Promise<{ root: string; games: Hit[]; errors: unknown[] }> => {
  const res = await api('GET', '/api/search/index');
  assert.equal(res.status, 200, res.text);
  return res.body as unknown as { root: string; games: Hit[]; errors: unknown[] };
};

test('without a card the index holds the games folder that is open', async () => {
  await write(path.join(work, 'manual', 'Games', 'Doom.zip'), 'rom');
  await write(path.join(work, 'manual', 'Games', 'filelist.csv'), 'Doom.zip,Doom II,doom2,fps\n');
  const res = await api('PUT', '/api/settings', {
    body: {
      extensions: ['gba', 'gb', 'zip', 'img', 'cue'],
      gamesDir: path.join(work, 'manual', 'Games'),
      csvPath: path.join(work, 'manual', 'Games', 'filelist.csv'),
    },
  });
  assert.equal(res.status, 200, res.text);
  const result = await index();
  assert.equal(result.root, '');
  assert.deepEqual(result.games, [
    {
      platform: '',
      folder: 'Games',
      platformName: null,
      rel: 'Doom.zip',
      fileName: 'Doom.zip',
      title: 'Doom II',
      short: 'doom2',
      tags: ['fps'],
    },
  ]);
});

test('the index covers every platform folder of the card, with CSV titles, short titles and tags', async () => {
  await fs.rm(sd, { recursive: true, force: true });
  await write(p('GBA', 'Mario.gba'), 'rom');
  await write(p('GBA', 'Hacks', 'Mario Red.gba'), 'rom');
  await write(p('GBA', 'images', 'Mario.png'), 'png');
  await write(p('GBA', 'filelist.csv'), 'Mario.gba,Super Mario Advance,marioAdv,platformer classic\n');
  await write(p('GB', 'Tetris.gb'), 'rom'); // no CSV: the title is the file name
  await write(p('GB', 'Disc.img'), 'img');
  await write(p('GB', 'Disc.cue'), 'side file'); // never a game, even though .cue is in the extension list
  // System and media folders are not searched.
  for (const folder of ['cubegm', 'rootfs', 'Ebook', 'Photo', 'Movie', 'BGM']) await write(p(folder, 'Mario.zip'), 'x');
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);

  const result = await index();
  assert.equal(result.root, sd);
  assert.deepEqual(result.errors, []);
  // Known platforms in the order of the directory (GBA before GB), games by name inside a folder.
  assert.deepEqual(
    result.games.map((game) => [game.platform, game.rel, game.title, game.short, game.tags.join(' ')]),
    [
      ['GBA', 'Hacks/Mario Red.gba', 'Mario Red', '', ''],
      ['GBA', 'Mario.gba', 'Super Mario Advance', 'marioAdv', 'platformer classic'],
      ['GB', 'Disc.img', 'Disc', '', ''],
      ['GB', 'Tetris.gb', 'Tetris', '', ''],
    ],
  );
  assert.ok(result.games.every((game) => game.folder === game.platform));
});

test('a CSV that cannot be read is reported; the games of that folder are still listed by file name', async () => {
  await fs.mkdir(p('GB', 'filelist.csv'), { recursive: true }); // a folder where the CSV should be: reading it fails
  const result = await index();
  assert.deepEqual(
    result.errors.map((error) => (error as { folder: string }).folder),
    ['GB'],
  );
  assert.ok(result.games.some((game) => game.platform === 'GB' && game.title === 'Tetris'));
  assert.ok(
    result.games.some((game) => game.platform === 'GBA' && game.title === 'Super Mario Advance'),
    'other folders are not affected',
  );
});
