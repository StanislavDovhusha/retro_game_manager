import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { cardIdOf, setFolderOpener } from '../../src/services/backupService.ts';
import { exists, write } from '../helpers/fs.ts';
import { PNG } from '../helpers/images.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);
const BOM = String.fromCharCode(0xfeff);
const bytes = (file: string): Promise<string> => fs.readFile(file, 'utf8');

/** A card with one platform folder (GB) holding games, disc image side files and an images folder. */
async function resetCard(files: Record<string, string | Buffer> = {}): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await write(p('GB', 'Tetris.gb'), 'rom');
  await write(p('GB', 'Pokemon Red.gb'), 'rom');
  await write(p('GB', 'Disc.img'), 'img');
  for (const side of ['Disc.cue', 'Disc.ccd', 'Disc.sub']) await write(p('GB', side), 'side file');
  await write(p('GB', 'images', 'Tetris.png'), PNG);
  for (const [name, data] of Object.entries(files)) await write(p('GB', name), data);
  await fs.mkdir(p('cubegm'), { recursive: true });
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'GB' } })).status, 200);
  // The extension list of a real installation: .cue is in it, and still it is not a game.
  const res = await api('PUT', '/api/settings', { body: { extensions: ['gb', 'img', 'cue', 'bin', 'zip'] } });
  assert.equal(res.status, 200);
}

const preview = async (): Promise<Record<string, unknown>> => {
  const res = await api('POST', '/api/sync/preview');
  assert.equal(res.status, 200, res.text);
  return res.body ?? {};
};
const apply = async (): Promise<Record<string, unknown>> => {
  const res = await api('POST', '/api/sync/apply', { body: { confirmed: true } });
  assert.equal(res.status, 200, res.text);
  return res.body ?? {};
};

test('sync creates a missing filelist.csv in the console format, one row per game, without side files', async () => {
  await resetCard();
  assert.equal(await exists(p('GB', 'filelist.csv')), false);
  const before = await preview();
  assert.equal(before.created, true);
  assert.deepEqual((before.added as string[]).sort(), ['Disc.img', 'Pokemon Red.gb', 'Tetris.gb']);

  const report = await apply();
  assert.equal(report.created, true);
  assert.equal(report.toAdd, 3);
  assert.equal(report.backupPath, null, 'there was nothing to back up');
  // UTF-8 with a BOM, CRLF, path / title / short title / empty tags — like the console's own files.
  assert.equal(
    await bytes(p('GB', 'filelist.csv')),
    `${BOM}Disc.img,Disc,disc,\r\nPokemon Red.gb,Pokemon Red,pokemonRed,\r\nTetris.gb,Tetris,tetris,\r\n`,
  );
  const library = (await api('GET', '/api/library')).body?.files as { rel: string; inCsv: boolean }[];
  assert.deepEqual(library.map((file) => [file.rel, file.inCsv]).sort(), [
    ['Disc.img', true],
    ['Pokemon Red.gb', true],
    ['Tetris.gb', true],
  ]);
  assert.deepEqual((await preview()).created, false, 'the second time there is nothing to create');
});

test('an empty filelist.csv (a lone BOM) is filled the same way', async () => {
  await resetCard({ 'filelist.csv': BOM });
  assert.equal((await preview()).created, true);
  await apply();
  assert.equal(
    await bytes(p('GB', 'filelist.csv')),
    `${BOM}Disc.img,Disc,disc,\r\nPokemon Red.gb,Pokemon Red,pokemonRed,\r\nTetris.gb,Tetris,tetris,\r\n`,
  );
});

test('sync adds the empty tags column only to the rows without it; everything else stays byte for byte', async () => {
  const original =
    `${BOM}Tetris.gb,Tetris,俄罗斯方块\r\n` + // the console's own row: a Chinese short title
    'Pokemon Red.gb,Pokemon Red,pokemonRed,rpg classic\r\n' + // already has tags
    'Disc.img,Disc\r\n'; // shorter still
  await resetCard({ 'filelist.csv': original });
  const before = await preview();
  assert.equal(before.created, false);
  assert.equal(before.tagsColumnAdded, 2);
  assert.equal(before.toAdd, 0);

  const report = await apply();
  assert.equal(report.tagsColumnAdded, 2);
  assert.equal(
    await bytes(p('GB', 'filelist.csv')),
    `${BOM}Tetris.gb,Tetris,俄罗斯方块,\r\nPokemon Red.gb,Pokemon Red,pokemonRed,rpg classic\r\nDisc.img,Disc,,\r\n`,
  );
  // The backup is on the computer, in the folder of this card and platform — not on the card.
  const backup = String(report.backupPath);
  assert.ok(backup.startsWith(path.join(work, 'data', 'backups', await cardIdOf(sd), 'GB') + path.sep), backup);
  assert.equal(await bytes(backup), original);
  assert.ok(!(await fs.readdir(p('GB'))).some((name) => name.includes('.bak-')));
  assert.equal((await preview()).tagsColumnAdded, 0, 'nothing is left to add');
});

test('choosing the card moves the backups older versions left on it to the computer', async () => {
  await resetCard({ 'filelist.csv': 'Tetris.gb,Tetris,tetris\r\n', 'filelist.csv.bak-2026-11-13T13-02-31-843Z': 'old copy' });
  // The move runs in the background after the card is chosen.
  const target = path.join(work, 'data', 'backups', await cardIdOf(sd), 'GB', 'filelist.csv.bak-2026-11-13T13-02-31-843Z');
  for (let i = 0; i < 100 && !(await exists(target)); i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await bytes(target), 'old copy');
  for (let i = 0; i < 100 && (await exists(p('GB', 'filelist.csv.bak-2026-11-13T13-02-31-843Z'))); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(await exists(p('GB', 'filelist.csv.bak-2026-11-13T13-02-31-843Z')), false, 'removed from the card');
});

test('POST /api/backups/open opens the backup folder in the file manager', async () => {
  await resetCard({ 'filelist.csv': 'Tetris.gb,Tetris,tetris\r\n' });
  await apply(); // makes a backup
  const opened: string[] = [];
  setFolderOpener(async (dir) => {
    opened.push(dir);
  });
  try {
    const res = await api('POST', '/api/backups/open', { body: {} });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body?.path, path.join(work, 'data', 'backups', await cardIdOf(sd)));
    assert.deepEqual(opened, [res.body?.path]);
  } finally {
    setFolderOpener(null);
  }
});

test('a disc image is built in the temp folder of the computer; nothing is left there or on the card', async () => {
  await resetCard({ 'filelist.csv': 'Tetris.gb,Tetris,tetris\r\n' });
  const bin = path.join(work, 'in', 'Game.bin');
  const cue = path.join(work, 'in', 'Game.cue');
  await write(bin, Buffer.alloc(2352 * 2, 1));
  await write(cue, 'FILE "Game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n');
  const res = await api('POST', '/api/games/add', {
    body: { game: [bin, cue].map((file) => ({ type: 'path', path: file })), title: 'Disc Two', image: null },
  });
  assert.equal(res.status, 200, res.text);
  assert.equal((await fs.stat(p('GB', 'Disc Two.img'))).size, 2352 * 2);
  const temp = await fs.readdir(path.join(work, 'data', 'temp')).catch(() => [] as string[]);
  assert.ok(!temp.some((name) => name.startsWith('op-')), `temp: ${temp.join(', ')}`);
  assert.ok(!(await fs.readdir(p('GB'))).some((name) => name.startsWith('.') || name.includes('.part')));
});
