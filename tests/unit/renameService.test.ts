import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test, { mock } from 'node:test';
import { getSettings, updateSettings } from '../../src/services/settingsService.ts';
import { previewRename, renameGame, replacePaths } from '../../src/services/renameService.ts';
import { exists, isAppError, read, write } from '../helpers/fs.ts';

const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);

const CSV = 'Mario.zip,Mario,mario\nMario 2.zip,Mario 2,mario2\n';
// The console's lists: path|title|TITLE|short|SHORT (favorites with CRLF line ends, as some cards have).
const MARIO = 'SFC/Mario.zip|Mario|MARIO|mario|MARIO';
const ALLFILES = `${MARIO}\nSFC/Mario 2.zip|Mario 2|MARIO 2|mario2|MARIO2\nGBA/Mario.zip|Mario|MARIO|mario|MARIO\n`;
const FAVORITES = `${MARIO}\r\n`;
const RECENT = `broken line\n${MARIO}\n`;
const RENAMED = 'SFC/Super Mario World.zip|Super Mario World|SUPER MARIO WORLD|superMarioWorld|SUPERMARIOWORLD';
const CORES = '<list><file name="SFC/Mario.zip" core="snes9x"/></list>';

/** A fresh SD card with one platform (SFC) and a game that has a cover, saves, states, lists and a core binding. */
async function setup(): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await fs.rm(path.join(work, 'data', 'backups'), { recursive: true, force: true });
  await write(p('SFC', 'Mario.zip'), 'rom');
  await write(p('SFC', 'Mario 2.zip'), 'rom2');
  await write(p('SFC', 'images', 'Mario.png'), 'img');
  await write(p('SFC', 'filelist.csv'), CSV);
  await write(p('cubegm', 'saves', 'Mario.sav'), 's');
  await write(p('cubegm', 'saves', 'Mario 2.sav'), 's2');
  await write(p('cubegm', 'states', 'Mario.state1'), 'st');
  await write(p('cubegm', 'states', 'Mario.state.png'), 'stp');
  await write(p('cubegm', 'allfiles.lst'), ALLFILES);
  await write(p('cubegm', 'favorites.lst'), FAVORITES);
  await write(p('cubegm', 'recent.lst'), RECENT);
  await write(p('cubegm', 'cores', 'filelist.xml'), CORES);
  await updateSettings({ sdRoot: sd });
  await updateSettings({
    gamesDir: p('SFC'),
    imagesDir: p('SFC', 'images'),
    csvPath: p('SFC', 'filelist.csv'),
    platform: 'SFC',
    extensions: ['zip'],
  });
}

/** Everything that rename touches must be exactly as it was. */
async function assertUntouched(): Promise<void> {
  assert.equal(await read(p('SFC', 'Mario.zip')), 'rom');
  assert.ok(await exists(p('SFC', 'images', 'Mario.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Mario.sav')));
  assert.ok(await exists(p('cubegm', 'states', 'Mario.state1')));
  assert.ok(await exists(p('cubegm', 'states', 'Mario.state.png')));
  assert.equal(await read(p('SFC', 'filelist.csv')), CSV);
  assert.equal(await read(p('cubegm', 'allfiles.lst')), ALLFILES);
  assert.equal(await read(p('cubegm', 'favorites.lst')), FAVORITES);
  assert.equal(await read(p('cubegm', 'recent.lst')), RECENT);
  assert.equal(await read(p('cubegm', 'cores', 'filelist.xml')), CORES);
  const left = (await fs.readdir(p('SFC'))).filter((name) => name !== 'images');
  assert.deepEqual(left.sort(), ['Mario 2.zip', 'Mario.zip', 'filelist.csv']);
}

test('renames the game with the cover, CSV, saves, states, .lst lists and cores/filelist.xml', async () => {
  await setup();
  const plan = await previewRename({ rel: 'Mario.zip', title: 'Super Mario World' });
  assert.equal(plan.newRel, 'Super Mario World.zip');
  assert.deepEqual(plan.steps.map((s) => s.kind).sort(), [
    'cores',
    'csv',
    'game',
    'image',
    'list',
    'list',
    'list',
    'save',
    'state',
    'state',
  ]);
  assert.ok(await exists(p('SFC', 'Mario.zip')), 'a preview changes nothing');

  const result = await renameGame({ rel: 'Mario.zip', title: 'Super Mario World' });
  assert.equal(result.short, 'superMarioWorld');
  assert.ok(!(await exists(p('SFC', 'Mario.zip'))));
  assert.equal(await read(p('SFC', 'Super Mario World.zip')), 'rom');
  assert.ok(await exists(p('SFC', 'images', 'Super Mario World.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Super Mario World.sav')));
  assert.ok(await exists(p('cubegm', 'states', 'Super Mario World.state1')));
  assert.ok(await exists(p('cubegm', 'states', 'Super Mario World.state.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Mario 2.sav')), "another game's saves are not touched");
  assert.equal(
    await read(p('SFC', 'filelist.csv')),
    'Super Mario World.zip,Super Mario World,superMarioWorld\nMario 2.zip,Mario 2,mario2\n',
  );
  assert.equal(
    await read(p('cubegm', 'allfiles.lst')),
    `${RENAMED}\nSFC/Mario 2.zip|Mario 2|MARIO 2|mario2|MARIO2\nGBA/Mario.zip|Mario|MARIO|mario|MARIO\n`,
    'every field of the line changes in place; another platform is not touched',
  );
  assert.equal(await read(p('cubegm', 'favorites.lst')), `${RENAMED}\r\n`, 'CRLF kept');
  assert.equal(await read(p('cubegm', 'recent.lst')), `broken line\n${RENAMED}\n`, 'a line that cannot be read stays');
  assert.match(await read(p('cubegm', 'cores', 'filelist.xml')), /name="SFC\/Super Mario World\.zip" core="snes9x"/);
  assert.ok(await exists(path.join(work, 'data', 'backups')), 'the lists are backed up in the app data folder');
});

test('rolls back every move when a later step fails (backup of a list cannot be written)', async () => {
  await setup();
  // The backups location is a file, so the first backup (made after the files were already moved) fails.
  await fs.mkdir(path.join(work, 'data'), { recursive: true });
  await fs.writeFile(path.join(work, 'data', 'backups'), 'not a directory');
  try {
    await assert.rejects(renameGame({ rel: 'Mario.zip', title: 'Super Mario World' }), (err: unknown) => err instanceof Error);
    await assertUntouched();
    assert.ok(!(await exists(p('SFC', 'Super Mario World.zip'))));
    assert.ok(!(await exists(p('cubegm', 'saves', 'Super Mario World.sav'))));
  } finally {
    await fs.rm(path.join(work, 'data', 'backups'), { force: true });
  }
});

test('rolls back list edits that were already written when a later list fails', async () => {
  await setup();
  // The backup of the LAST edit (recent.lst) cannot be written: cores/filelist.xml and two lists are already rewritten then.
  const realWriteFile = fs.writeFile;
  mock.method(fs, 'writeFile', (file: Parameters<typeof fs.writeFile>[0], ...rest: unknown[]) =>
    String(file).includes('recent.lst.bak-')
      ? Promise.reject(new Error('disk full'))
      : (realWriteFile as (...args: unknown[]) => Promise<void>)(file, ...rest),
  );
  try {
    await assert.rejects(renameGame({ rel: 'Mario.zip', title: 'Super Mario World' }), (err: unknown) => err instanceof Error);
  } finally {
    mock.restoreAll();
  }
  await assertUntouched(); // the files already rewritten are restored byte for byte
  assert.ok(!(await exists(p('cubegm', 'saves', 'Super Mario World.sav'))));
});

test('name conflicts are rejected before anything changes', async () => {
  await setup();
  await assert.rejects(renameGame({ rel: 'Mario.zip', title: 'Mario 2' }), isAppError(409, 'CONFLICT'));
  await write(p('cubegm', 'saves', 'New.sav'), 'x');
  await assert.rejects(renameGame({ rel: 'Mario.zip', title: 'New' }), isAppError(409, 'CONFLICT'));
  await fs.rm(p('cubegm', 'saves', 'New.sav'));
  await assertUntouched();
});

test('path traversal, empty title and missing game', async () => {
  await setup();
  await assert.rejects(renameGame({ rel: '../x.zip', title: 'A' }), isAppError(400, 'PATH_OUTSIDE_ROOT'));
  await assert.rejects(renameGame({ rel: 'Mario.zip', title: '   ' }), isAppError(400));
  await assert.rejects(renameGame({ rel: 'Mario.zip', title: '???' }), isAppError(400));
  await assert.rejects(renameGame({ rel: 'Nope.zip', title: 'A' }), isAppError(404));
  await assert.rejects(renameGame({ rel: 'images', title: 'A' }), isAppError(400));
  await assertUntouched();
});

test('a symlinked game that points outside the games folder is not renamed', async () => {
  await setup();
  await write(path.join(work, 'outside', 'evil.zip'), 'evil');
  await fs.symlink(path.join(work, 'outside', 'evil.zip'), p('SFC', 'link.zip'));
  await assert.rejects(renameGame({ rel: 'link.zip', title: 'Pwned' }), isAppError(403, 'PATH_OUTSIDE_ROOT'));
  assert.ok(await exists(path.join(work, 'outside', 'evil.zip')));
});

test('without an SD platform only the file, cover and CSV change, with a warning; cubegm is not touched', async () => {
  await setup();
  await updateSettings({ platform: '' });
  assert.equal((await getSettings()).platform, '');
  const result = await renameGame({ rel: 'Mario.zip', title: 'Zelda' });
  assert.ok(result.warnings.length > 0);
  assert.ok(await exists(p('SFC', 'Zelda.zip')));
  assert.ok(await exists(p('SFC', 'images', 'Zelda.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Mario.sav')));
  assert.equal(await read(p('cubegm', 'allfiles.lst')), ALLFILES);
});

test('a second operation is refused while one is running (operation lock)', async () => {
  await setup();
  const first = renameGame({ rel: 'Mario.zip', title: 'One' });
  const second = renameGame({ rel: 'Mario 2.zip', title: 'Two' });
  await assert.rejects(second, isAppError(409, 'CONFLICT'));
  await first;
});

test('replacePaths replaces only whole paths in every notation', () => {
  const r = replacePaths(
    'SFC/Mario.zip\nSFC/Mario.zip.bak\nSFC\\Mario.zip\n<a n="SFC/Mario.zip"/>\nXSFC/Mario.zip',
    'SFC/Mario.zip',
    'SFC/New.zip',
  );
  assert.equal(r.count, 3);
  assert.equal(r.text, 'SFC/New.zip\nSFC/Mario.zip.bak\nSFC\\New.zip\n<a n="SFC/New.zip"/>\nXSFC/Mario.zip');
  assert.equal(replacePaths('nothing here', 'a/b.zip', 'a/c.zip').count, 0);
});
