import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  MAX_BACKUPS,
  backupDirFor,
  backupFile,
  cardIdOf,
  migrateBackups,
  openBackupsFolder,
  setFolderOpener,
  setVolumeProbe,
} from '../../src/services/backupService.ts';
import { updateSettings } from '../../src/services/settingsService.ts';
import { exists, read, write } from '../helpers/fs.ts';

const backups = path.join(work, 'data', 'backups');
const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);

async function useCard(): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await write(p('SFC', 'filelist.csv'), 'a.zip,A,a\n');
  await fs.mkdir(p('cubegm'), { recursive: true });
  await updateSettings({ sdRoot: sd });
}

test('card id: label and serial of the volume; a folder that is not a volume gets a hash of its path', async () => {
  setVolumeProbe(async () => ({ label: 'GAMECARD', serial: '3C6F257D-5E26-3E33' }));
  try {
    // The root of the file system is a mount point, so the probe is asked.
    assert.equal(await cardIdOf(path.parse(work).root), 'GAMECARD_3C6F257D-5E26-3E33');
    // A plain folder is not: its name and a hash of its path.
    const id = await cardIdOf(sd);
    assert.match(id, /^SD_path-[0-9a-f]{12}$/);
    assert.equal(await cardIdOf(sd), id, 'the same folder always gets the same id');
    assert.notEqual(await cardIdOf(path.join(work, 'other', 'SD')), id, 'another card with the same name is kept apart');
  } finally {
    setVolumeProbe(null);
  }
  setVolumeProbe(async () => {
    throw new Error('diskutil failed');
  });
  try {
    assert.match(await cardIdOf(path.parse(work).root), /_path-[0-9a-f]{12}$/, 'no label or serial: the path hash');
  } finally {
    setVolumeProbe(null);
  }
});

test('a backup goes to backups/<card id>/<platform>/ on the computer; the last 10 copies of each file are kept', async () => {
  await useCard();
  const csv = p('SFC', 'filelist.csv');
  const dir = await backupDirFor(csv);
  assert.equal(dir, path.join(backups, await cardIdOf(sd), 'SFC'));
  for (let i = 0; i < MAX_BACKUPS + 3; i += 1) await backupFile(csv);
  const names = await fs.readdir(dir);
  assert.equal(names.filter((name) => name.startsWith('filelist.csv.bak-')).length, MAX_BACKUPS);
  assert.deepEqual((await fs.readdir(p('SFC'))).sort(), ['filelist.csv'], 'nothing is written next to the CSV');

  // A cubegm list of a rename is filed under the platform of the game.
  const lst = await backupFile(p('cubegm', 'allfiles.lst'), { platform: 'SFC', data: Buffer.from('SFC/a.zip\n') });
  assert.equal(path.dirname(lst), dir);
  assert.equal(await read(lst), 'SFC/a.zip\n');
  assert.ok(
    names.every((name) => !name.startsWith('allfiles')),
    'counted per file: the lists do not push out CSV copies',
  );
});

test('a CSV outside the card is filed under <its parent folder id>/<its folder>', async () => {
  await useCard();
  const csv = path.join(work, 'manual', 'GBA', 'filelist.csv');
  assert.equal(await backupDirFor(csv), path.join(backups, await cardIdOf(path.join(work, 'manual')), 'GBA'));
});

test('migration: old backups move off the card (and are pruned), leftovers of earlier runs go, the rest stays', async () => {
  await useCard();
  await fs.rm(backups, { recursive: true, force: true }); // only the copies moved from the card
  const stamps = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}T10-00-00-000Z`);
  for (const stamp of stamps) await write(p('SFC', `filelist.csv.bak-${stamp}`), stamp);
  await write(p('GBA', 'filelist.csv.bak-2026-11-13T13-02-31-843Z'), 'gba backup');
  await write(p('SFC', '.Game.img.part-99999999'), 'half a game');
  await write(p('SFC', `.Current.img.part-${process.pid}`), 'a write in progress');
  await write(p('SFC', 'images', 'Game.png.tmp-99999999-1700000000000'), 'half a cover');
  await write(p('cubegm', 'allfiles.lst.bak-2026-11-01T10-00-00-000Z'), 'system folder');
  await write(p('SFC', 'Game.zip'), 'rom');

  const result = await migrateBackups({ sdRoot: sd, csvPath: p('SFC', 'filelist.csv') });
  assert.equal(result.moved, 13);
  assert.equal(result.removedLeftovers, 2);

  const id = await cardIdOf(sd);
  const sfc = (await fs.readdir(path.join(backups, id, 'SFC'))).filter((name) => name.startsWith('filelist.csv.bak-'));
  assert.equal(sfc.length, MAX_BACKUPS);
  assert.ok(sfc.includes(`filelist.csv.bak-${stamps.at(-1)}`) && !sfc.includes(`filelist.csv.bak-${stamps[0]}`), 'the newest are kept');
  assert.equal(await read(path.join(backups, id, 'GBA', 'filelist.csv.bak-2026-11-13T13-02-31-843Z')), 'gba backup');

  assert.deepEqual((await fs.readdir(p('SFC'))).sort(), [`.Current.img.part-${process.pid}`, 'Game.zip', 'filelist.csv', 'images']);
  assert.deepEqual(await fs.readdir(p('SFC', 'images')), []);
  assert.deepEqual(await fs.readdir(p('GBA')), []);
  assert.ok(await exists(p('cubegm', 'allfiles.lst.bak-2026-11-01T10-00-00-000Z')), 'cubegm is never touched');

  const again = await migrateBackups({ sdRoot: sd, csvPath: p('SFC', 'filelist.csv') });
  assert.deepEqual([again.moved, again.removedLeftovers], [0, 0], 'running it again changes nothing');
});

test('"Open backups folder" opens the folder of the current card (or of all backups) in the file manager', async () => {
  await useCard();
  const opened: string[] = [];
  setFolderOpener(async (dir) => {
    opened.push(dir);
  });
  try {
    await fs.rm(backups, { recursive: true, force: true });
    assert.deepEqual(await openBackupsFolder(), { path: backups }, 'no backups of this card yet: the folder of all backups');
    await backupFile(p('SFC', 'filelist.csv'));
    const cardDir = path.join(backups, await cardIdOf(sd));
    assert.deepEqual(await openBackupsFolder(), { path: cardDir });
    assert.deepEqual(opened, [backups, cardDir]);

    setFolderOpener(async () => {
      throw Object.assign(new Error('spawn xdg-open ENOENT'), { code: 'ENOENT' });
    });
    await assert.rejects(openBackupsFolder(), (err: unknown) => err instanceof Error && err.message.includes(cardDir));
  } finally {
    setFolderOpener(null);
  }
});
