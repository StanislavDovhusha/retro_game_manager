import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { CsvTable } from '../../src/models/index.ts';
import { applyPlan, buildPlan, csvLookup, removeEntries, removeEntry, resolveColumns, upsertGame } from '../../src/services/csv/plan.ts';
import { readCsv, serializeCsv, writeCsv } from '../../src/services/csv/store.ts';
import { backupDirFor } from '../../src/services/backupService.ts';
import { work } from '../helpers/env.ts';
import { exists, read, write } from '../helpers/fs.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

const withHeader = (): CsvTable => ({
  headers: ['name', 'path', 'note'],
  rows: [
    ['Mario', 'GBA/mario.gba', 'fav'],
    ['Gone', 'GBA/gone.gba', 'x'],
    ['Doc', 'GBA/readme.txt', ''],
    ['Other', 'external/other.bin', 'keep'],
  ],
  hasHeader: true,
  eol: '\n',
  delimiter: ',',
  encoding: 'utf8',
  hadBom: false,
  exists: true,
});
const columns = { name: 'name', path: 'path' };
const files = [{ rel: 'GBA/mario.gba' }, { rel: 'GBA/new game.gba' }];
const fileExists = async (rel: string): Promise<boolean> => rel === 'GBA/readme.txt';

const plain = (): CsvTable => ({
  headers: ['Column 1', 'Column 2', 'Column 3'],
  rows: [['GBA/a.gba', 'Game A', 'gameA'], ['GBA/b.gba'], ['GBA/c.gba', '', '']],
  hasHeader: false,
  eol: '\n',
  delimiter: ',',
  encoding: 'utf8',
  hadBom: false,
  exists: true,
});

test('plan: new, stale and unchanged entries', async () => {
  const plan = await buildPlan({ csv: withHeader(), columns, prefix: '', files, fileExists });
  assert.deepEqual(plan.toAdd, ['GBA/new game.gba']);
  assert.equal(plan.stale.length, 2); // gone.gba and external/other.bin (the prefix is empty: everything is managed)
  assert.equal(plan.unchanged, 2);
});

test('plan: entries outside the prefix are not touched', async () => {
  const plan = await buildPlan({
    csv: withHeader(),
    columns,
    prefix: 'GBA/',
    files: [{ rel: 'mario.gba' }],
    fileExists: async () => false,
  });
  assert.equal(plan.unmanaged, 1);
  assert.deepEqual(
    plan.stale.map((entry) => entry.path),
    ['GBA/gone.gba', 'GBA/readme.txt'],
  );
});

test('apply: keeps extra fields, adds without duplicates', async () => {
  const csv = withHeader();
  const plan = await buildPlan({ csv, columns, prefix: '', files, fileExists });
  const next = applyPlan(csv, plan, { prefix: '' });
  assert.equal(next.rows.find((row) => row[0] === 'Mario')?.[2], 'fav');
  assert.ok(next.rows.some((row) => row[1] === 'GBA/new game.gba' && row[0] === 'new game'));
  const again = await buildPlan({ csv: next, columns, prefix: '', files, fileExists });
  assert.equal(again.toAdd.length, 0);
});

test('apply without additions removes only stale entries', async () => {
  const csv = withHeader();
  const plan = await buildPlan({ csv, columns, prefix: '', files, fileExists });
  const next = applyPlan(csv, { ...plan, toAdd: [] }, { prefix: '' });
  assert.deepEqual(
    next.rows.map((row) => row[1]),
    ['GBA/mario.gba', 'GBA/readme.txt'],
  );
});

test('removeEntry / removeEntries', () => {
  const single = removeEntry(withHeader(), columns, '', 'gba/MARIO.gba');
  assert.equal(single.removed, 1);
  assert.equal(single.csv.rows.length, 3);
  const many = removeEntries(plain(), {}, '', ['gba/A.gba', 'GBA/c.gba', 'none/such.gba']);
  assert.equal(many.removed, 2);
  assert.equal(many.csv.rows.length, 1);
});

test('a CSV without a header: columns 1/2/3 are detected automatically', async () => {
  const csv = plain();
  assert.deepEqual(resolveColumns(csv, {}), { path: 0, name: 1, short: 2, tags: 3 });
  const plan = await buildPlan({
    csv,
    columns: {},
    prefix: '',
    files: [{ rel: 'GBA/a.gba' }, { rel: 'GBA/the legend of zelda.gba' }],
    fileExists: async () => false,
  });
  assert.deepEqual(plan.toAdd, ['GBA/the legend of zelda.gba']);
  const next = applyPlan(csv, plan, { prefix: '' });
  // A new row of a headerless file has every column, the empty tags (the 4th) included.
  assert.deepEqual(next.rows.at(-1), ['GBA/the legend of zelda.gba', 'the legend of zelda', 'theLegendOfZelda', '']);
});

test('csvLookup: empty and missing values do not break parsing', () => {
  const lookup = csvLookup(plain(), {}, '');
  assert.deepEqual(lookup.get('gba/a.gba'), { name: 'Game A', short: 'gameA', tags: [] });
  assert.deepEqual(lookup.get('gba/b.gba'), { name: '', short: '', tags: [] });
  assert.deepEqual(lookup.get('gba/c.gba'), { name: '', short: '', tags: [] });
});

test('upsertGame adds a new entry, updates an existing one in place and does not mutate the input', () => {
  const added = upsertGame(plain(), {}, '', { rel: 'Zelda.gba', name: 'The Legend of Zelda', short: 'theLegendOfZelda' });
  assert.equal(added.mode, 'added');
  assert.deepEqual(added.csv.rows.at(-1), ['Zelda.gba', 'The Legend of Zelda', 'theLegendOfZelda', '']);

  const original = plain();
  const updated = upsertGame(original, {}, '', { rel: 'gba/B.gba', name: 'Game B', short: 'gameB' });
  assert.equal(updated.mode, 'updated');
  assert.equal(updated.csv.rows.length, original.rows.length);
  assert.deepEqual(updated.csv.rows[1], ['GBA/b.gba', 'Game B', 'gameB']);
  assert.deepEqual(original.rows[1], ['GBA/b.gba']);
});

test('upsertGame respects the path prefix and keeps foreign columns', () => {
  const csv = { ...plain(), rows: [['Games/x.gba', 'X', 'x', 'extra']] };
  const { csv: next } = upsertGame(csv, {}, 'Games/', { rel: 'y.gba', name: 'Y', short: 'y' });
  assert.deepEqual(next.rows[0], ['Games/x.gba', 'X', 'x', 'extra']);
  assert.deepEqual(next.rows[1], ['Games/y.gba', 'Y', 'y', '']);
});

test('store: round trip keeps BOM, line endings, delimiter and extra columns; writes make a backup', async () => {
  const file = path.join(work, 'csv', 'filelist.csv');
  await write(file, '﻿a.gba;A;a;extra\r\nb.gba;B;b\r\n');
  const csv = await readCsv(file, { delimiter: ';', encoding: 'utf8', hasHeader: false });
  assert.equal(csv.hadBom, true);
  assert.equal(csv.eol, '\r\n');
  assert.deepEqual(csv.rows[0], ['a.gba', 'A', 'a', 'extra']);
  assert.equal(serializeCsv(csv).toString('utf8'), '﻿a.gba;A;a;extra\r\nb.gba;B;b\r\n');

  const backup = await writeCsv(file, { ...csv, rows: [...csv.rows, ['c.gba', 'C', 'c']] });
  assert.ok(backup && (await exists(backup)));
  assert.equal(await read(backup), '﻿a.gba;A;a;extra\r\nb.gba;B;b\r\n'); // the backup is the previous content
  assert.match(await read(file), /c\.gba;C;c/);
});

test('store: at most 10 backups are kept; a missing file can be read as an empty table', async () => {
  const file = path.join(work, 'csv2', 'filelist.csv');
  await write(file, 'a.gba,A,a\n');
  const csv = await readCsv(file);
  for (let i = 0; i < 13; i += 1) {
    await writeCsv(file, csv);
    await new Promise((resolve) => setTimeout(resolve, 2)); // backup names carry a millisecond stamp
  }
  // The backups live in the data folder (backups/<card id>/<folder>/), not next to the CSV.
  assert.deepEqual((await fs.readdir(path.dirname(file))).sort(), ['filelist.csv']);
  const backupDir = await backupDirFor(file);
  assert.ok(backupDir.startsWith(path.join(work, 'data', 'backups') + path.sep), backupDir);
  const backups = (await fs.readdir(backupDir)).filter((name) => name.startsWith('filelist.csv.bak-'));
  assert.equal(backups.length, 10);
  const missing = await readCsv(path.join(work, 'csv2', 'nope.csv'), {}, { allowMissing: true });
  assert.equal(missing.exists, false);
  await assert.rejects(readCsv(path.join(work, 'csv2', 'nope.csv')), (err: unknown) => err instanceof Error);
});
