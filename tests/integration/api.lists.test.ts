import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import iconv from 'iconv-lite';
import { read, write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

// The console's game lists (cubegm/allfiles.lst, favorites.lst, recent.lst) follow adding, editing, renaming,
// deleting and the sync. Line: path|title|TITLE|short|SHORT.
const api = await startApi();
const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);
const lst = (name: string): Promise<string> => read(p('cubegm', name));
const backups = async (): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory()) await walk(path.join(dir, entry.name));
      else out.push(entry.name);
    }
  };
  await walk(path.join(work, 'data', 'backups'));
  return out;
};

const PCE = 'PCE/Dai Makai-Mura.zip|Dai Makai-Mura|DAI MAKAI-MURA|daiMakaiMura|DAIMAKAIMURA';
await write(p('PS', 'Hercules.img'), 'disc');
await write(p('PS', 'Old.img'), 'disc');
await write(p('PS', 'filelist.csv'), '﻿Hercules.img,Hercules,hercules,\r\nOld.img,Old,old,\r\n');
await write(p('PCE', 'Dai Makai-Mura.zip'), 'rom');
await write(p('cubegm', 'allfiles.lst'), `PS/Hercules.img|Hercules|HERCULES|hercules|HERCULES\r\nPS/Old.img|Old|OLD|old|OLD\r\n${PCE}\r\n`);
await write(p('cubegm', 'favorites.lst'), 'PS/Old.img|Old|OLD|old|OLD\nnot a game line\n');
await write(p('cubegm', 'recent.lst'), 'PS/Hercules.img|Hercules|HERCULES|hercules|HERCULES\n');
await write(path.join(work, 'src', 'Parasite Eve II.img'), 'disc');

assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'PS' } })).status, 200);
await api('PUT', '/api/settings', { body: { extensions: ['img', 'zip'] } });

test('adding a game appends its line to allfiles.lst only, in the file’s own line ends', async () => {
  const res = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: path.join(work, 'src', 'Parasite Eve II.img') }, title: 'Parasite Eve II', image: null },
  });
  assert.equal(res.status, 200, res.text);
  assert.equal(
    await lst('allfiles.lst'),
    `PS/Hercules.img|Hercules|HERCULES|hercules|HERCULES\r\nPS/Old.img|Old|OLD|old|OLD\r\n${PCE}\r\n` +
      'PS/Parasite Eve II.img|Parasite Eve II|PARASITE EVE II|parasiteEveIi|PARASITEEVEII\r\n',
  );
  assert.equal(await lst('favorites.lst'), 'PS/Old.img|Old|OLD|old|OLD\nnot a game line\n');
  assert.equal(await lst('recent.lst'), 'PS/Hercules.img|Hercules|HERCULES|hercules|HERCULES\n');
  assert.ok(
    (await backups()).some((name) => name.startsWith('allfiles.lst.bak-')),
    'backed up in the data folder',
  );
});

test('a new short name changes fields 4 and 5 in every list', async () => {
  const res = await api('PUT', '/api/games/entry', { body: { rel: 'Hercules.img', short: 'herc' } });
  assert.equal(res.status, 200, res.text);
  assert.match(await lst('allfiles.lst'), /^PS\/Hercules\.img\|Hercules\|HERCULES\|herc\|HERC\r\n/);
  assert.equal(await lst('recent.lst'), 'PS/Hercules.img|Hercules|HERCULES|herc|HERC\n');
  assert.equal((await api('PUT', '/api/games/entry', { body: { rel: 'Hercules.img', short: 'a|b' } })).status, 400, '| is refused');
});

test('renaming updates the line in place in every list that has it', async () => {
  const res = await api('POST', '/api/games/rename', { body: { rel: 'Old.img', title: 'New Title', confirmed: true } });
  assert.equal(res.status, 200, res.text);
  const all = (await lst('allfiles.lst')).split('\r\n');
  assert.equal(all[1], 'PS/New Title.img|New Title|NEW TITLE|newTitle|NEWTITLE', 'same position');
  assert.equal(await lst('favorites.lst'), 'PS/New Title.img|New Title|NEW TITLE|newTitle|NEWTITLE\nnot a game line\n');
  assert.equal((await api('POST', '/api/games/rename', { body: { rel: 'Hercules.img', title: 'A | B', confirmed: true } })).status, 400);
});

test('deleting a game removes its line from every list', async () => {
  const res = await api('DELETE', '/api/games', { body: { rel: 'New Title.img', removeFromCsv: true, confirmed: true } });
  assert.equal(res.status, 200, res.text);
  assert.ok(!(await lst('allfiles.lst')).includes('New Title'));
  assert.equal(await lst('favorites.lst'), 'not a game line\n', 'a line that cannot be read stays');
  assert.ok((await lst('allfiles.lst')).includes(PCE), 'another platform is untouched');
});

test('the sync: allfiles.lst gets missing games and loses gone ones; favorites and recent only lose gone ones', async () => {
  await write(p('PS', 'Copied By Hand.img'), 'disc');
  await fs.rm(p('PS', 'Hercules.img'));
  await write(
    p('cubegm', 'favorites.lst'),
    'PS/Ghost.img|Ghost|GHOST|ghost|GHOST\nPS/Parasite Eve II.img|Parasite Eve II|PARASITE EVE II|parasiteEveIi|PARASITEEVEII\n',
  );
  const res = await api('POST', '/api/sync/apply', { body: { confirmed: true } });
  assert.equal(res.status, 200, res.text);
  const report = res.body as unknown as { lists: { added: number; removed: number } };
  assert.deepEqual(
    { added: report.lists.added, removed: report.lists.removed },
    { added: 1, removed: 3 },
    'Hercules from allfiles and recent, Ghost from favorites',
  );
  const all = await lst('allfiles.lst');
  assert.ok(!all.includes('PS/Hercules.img'));
  assert.ok(all.includes('PS/Copied By Hand.img|Copied By Hand|COPIED BY HAND|copiedByHand|COPIEDBYHAND\r\n'));
  assert.ok(all.includes(PCE), 'other platforms are not synced from this folder');
  assert.equal(await lst('favorites.lst'), 'PS/Parasite Eve II.img|Parasite Eve II|PARASITE EVE II|parasiteEveIi|PARASITEEVEII\n');
  assert.equal(await lst('recent.lst'), '', 'the gone game left the recent list');
});

test('a list that does not read cleanly is not written: the operation reports it as an error and it stays byte for byte', async () => {
  // Windows-1251 without a byte order mark: it is read as UTF-8, and the text gets replacement characters.
  const cp1251 = iconv.encode(
    'PS/Copied By Hand.img|Игра|ИГРА|igra|IGRA\r\nPS/Другая.img|Другая|ДРУГАЯ|drugaya|DRUGAYA\r\n',
    'windows-1251',
  );
  await fs.writeFile(p('cubegm', 'recent.lst'), cp1251);
  const res = await api('DELETE', '/api/games', { body: { rel: 'Copied By Hand.img', removeFromCsv: true, confirmed: true } });
  assert.equal(res.status, 200, res.text);
  const errors = (res.body as unknown as { listErrors: string[] }).listErrors;
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /recent\.lst does not read correctly as utf8/);
  assert.deepEqual(await fs.readFile(p('cubegm', 'recent.lst')), cp1251, 'not touched');
  assert.ok(!(await lst('allfiles.lst')).includes('Copied By Hand'), 'the other lists were updated');
});

test('a missing allfiles.lst is created when a game is added: UTF-8, no byte order mark', async () => {
  await fs.rm(p('cubegm', 'allfiles.lst'));
  await write(path.join(work, 'src', 'Hedgehog.img'), 'disc');
  // Titles are English only: Cyrillic and Japanese are refused before anything is written.
  for (const title of ['Ёжик', 'ゼルダの伝説']) {
    const refused = await api('POST', '/api/games/add', {
      body: { game: { type: 'path', path: path.join(work, 'src', 'Hedgehog.img') }, title, image: null },
    });
    assert.equal(refused.status, 400, title);
  }
  assert.equal(await fs.stat(p('cubegm', 'allfiles.lst')).catch(() => null), null, 'nothing was created for a refused title');
  const res = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: path.join(work, 'src', 'Hedgehog.img') }, title: 'Hedgehog in the Fog (1975)', image: null },
  });
  assert.equal(res.status, 200, res.text);
  const bytes = await fs.readFile(p('cubegm', 'allfiles.lst'));
  assert.deepEqual(
    bytes,
    Buffer.from(
      'PS/Hedgehog in the Fog (1975).img|Hedgehog in the Fog (1975)|HEDGEHOG IN THE FOG (1975)|hedgehogInTheFog1975|HEDGEHOGINTHEFOG1975\n',
    ),
  );
});
