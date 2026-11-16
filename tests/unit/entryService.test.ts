import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test, { mock } from 'node:test';
import { updateEntry } from '../../src/services/entryService.ts';
import { getSettings, updateSettings } from '../../src/services/settingsService.ts';
import { exists, read, write } from '../helpers/fs.ts';

const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);
const CSV = 'Mario.zip,Mario,mario,plumber\nMario 2.zip,Mario 2,mario2\n';

async function setup(): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await fs.rm(path.join(work, 'data', 'backups'), { force: true, recursive: true });
  await write(p('SFC', 'Mario.zip'), 'rom');
  await write(p('SFC', 'Mario 2.zip'), 'rom2');
  await write(p('SFC', 'images', 'Mario.png'), 'img');
  await write(p('SFC', 'filelist.csv'), CSV);
  await write(p('cubegm', 'saves', 'Mario.sav'), 's');
  await write(p('cubegm', 'states', 'Mario.state1'), 'st');
  await write(p('cubegm', 'allfiles.lst'), 'SFC/Mario.zip\n');
  await updateSettings({ sdRoot: sd });
  await updateSettings({
    gamesDir: p('SFC'),
    imagesDir: p('SFC', 'images'),
    csvPath: p('SFC', 'filelist.csv'),
    platform: 'SFC',
    extensions: ['zip'],
  });
}

test('a failing rename step rolls everything back: files, cover, saves and the CSV (tags included)', async () => {
  await setup();
  // The backups location is a file: the CSV backup (made after the files were moved) cannot be written.
  await fs.mkdir(path.join(work, 'data'), { recursive: true });
  await fs.writeFile(path.join(work, 'data', 'backups'), 'not a directory');
  try {
    await assert.rejects(updateEntry({ rel: 'Mario.zip', name: 'Super Mario World', tags: ['a', 'b'], confirmed: true }));
  } finally {
    await fs.rm(path.join(work, 'data', 'backups'), { force: true });
  }
  assert.equal(await read(p('SFC', 'Mario.zip')), 'rom');
  assert.ok(await exists(p('SFC', 'images', 'Mario.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Mario.sav')));
  assert.ok(await exists(p('cubegm', 'states', 'Mario.state1')));
  assert.equal(await read(p('SFC', 'allfiles.lst').replace('SFC', 'cubegm')), 'SFC/Mario.zip\n');
  assert.equal(await read(p('SFC', 'filelist.csv')), CSV);
  assert.ok(!(await exists(p('SFC', 'Super Mario World.zip'))));
  assert.ok(!(await exists(p('SFC', 'images', 'Super Mario World.png'))));
});

test('a CSV-only change that cannot be backed up leaves the CSV as it was', async () => {
  await setup();
  // The backup of the CSV (in the data folder) cannot be written.
  const realCopyFile = fs.copyFile;
  mock.method(fs, 'copyFile', (from: string, to: string, mode?: number) =>
    String(to).includes('filelist.csv.bak-') ? Promise.reject(new Error('disk full')) : realCopyFile(from, to, mode),
  );
  try {
    await assert.rejects(updateEntry({ rel: 'Mario 2.zip', tags: ['x'] }));
  } finally {
    mock.restoreAll();
  }
  assert.equal(await read(p('SFC', 'filelist.csv')), CSV);
});

test('settings: the folders/all-games split is clamped to a sane range', async () => {
  await setup();
  const base = (await getSettings()).ui.foldersShare;
  assert.equal(base, 0.5);
  assert.equal((await updateSettings({ ui: { foldersShare: 0.7 } })).ui.foldersShare, 0.7);
  assert.equal((await updateSettings({ ui: { foldersShare: 0 } })).ui.foldersShare, 0.1);
  assert.equal((await updateSettings({ ui: { foldersShare: 5 } })).ui.foldersShare, 0.9);
});
