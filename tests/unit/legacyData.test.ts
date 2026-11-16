import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { LEGACY_DATA_DIRS, LEGACY_PRODUCT_NAMES, moveDataFolder, moveLegacyData } from '../../src/utils/legacyData.ts';

const put = async (file: string, text = 'x'): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
};
const exists = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false,
  );

test('the old names are known: "Game Manager" first, then "SF3000 Game Manager"; ~/.game-manager, then ~/.sf3000-manager', () => {
  assert.deepEqual(LEGACY_PRODUCT_NAMES, ['Game Manager', 'SF3000 Game Manager']);
  assert.deepEqual(
    LEGACY_DATA_DIRS.map((dir) => path.basename(dir)),
    ['.game-manager', '.sf3000-manager'],
  );
});

test('the old data folder moves to the new place once: settings, backups, logs; then the old folder is removed', async () => {
  const from = path.join(work, 'a', 'Game Manager');
  const to = path.join(work, 'a', 'Retro Game Manager');
  await put(path.join(from, 'settings.json'), '{"sdRoot":"/Volumes/CARD"}');
  await put(path.join(from, 'backups', 'card', 'GBA', 'filelist.csv.bak-1'));
  await put(path.join(from, 'logs', 'operations.log'));
  const result = await moveDataFolder(from, to);
  assert.deepEqual(result, { moved: true, entries: 3, skipped: [] });
  assert.equal(await fs.readFile(path.join(to, 'settings.json'), 'utf8'), '{"sdRoot":"/Volumes/CARD"}');
  assert.ok(await exists(path.join(to, 'backups', 'card', 'GBA', 'filelist.csv.bak-1')));
  assert.ok(await exists(path.join(to, 'logs', 'operations.log')));
  assert.ok(!(await exists(from)), 'the old folder is removed');
  assert.deepEqual(await moveDataFolder(from, to), { moved: false, reason: 'no-old-data' }, 'nothing to do the second time');
});

test('folders the new version already made are merged; its own files stay; the old folder is still removed', async () => {
  const from = path.join(work, 'b', 'old');
  const to = path.join(work, 'b', 'new');
  await put(path.join(from, 'settings.json'), 'old');
  await put(path.join(from, 'logs', 'operations.log'), 'old journal');
  await put(path.join(from, 'logs', 'game-manager.log'), 'old log');
  await put(path.join(from, 'Local Storage', 'a'));
  await put(path.join(to, 'logs', 'retro-game-manager.log'), 'new log'); // made at start-up
  await put(path.join(to, 'Local Storage', 'a'), 'new');
  const result = await moveDataFolder(from, to);
  assert.deepEqual(result, { moved: true, entries: 3, skipped: ['Local Storage/a'] });
  assert.equal(await fs.readFile(path.join(to, 'settings.json'), 'utf8'), 'old');
  assert.equal(await fs.readFile(path.join(to, 'logs', 'operations.log'), 'utf8'), 'old journal', 'merged into logs/');
  assert.equal(await fs.readFile(path.join(to, 'logs', 'game-manager.log'), 'utf8'), 'old log');
  assert.equal(await fs.readFile(path.join(to, 'logs', 'retro-game-manager.log'), 'utf8'), 'new log');
  assert.equal(await fs.readFile(path.join(to, 'Local Storage', 'a'), 'utf8'), 'new', 'a file the new version made stays');
  assert.ok(!(await exists(from)));
});

test('a new folder that already has settings is never touched, and the old one is kept', async () => {
  const other = path.join(work, 'c');
  await put(path.join(other, 'old', 'settings.json'), 'old');
  await put(path.join(other, 'new', 'settings.json'), 'new');
  assert.deepEqual(await moveDataFolder(path.join(other, 'old'), path.join(other, 'new')), { moved: false, reason: 'already-in-use' });
  assert.equal(await fs.readFile(path.join(other, 'new', 'settings.json'), 'utf8'), 'new');
  assert.ok(await exists(path.join(other, 'old', 'settings.json')));
});

test('the newest old folder wins; an older one is left alone', async () => {
  const base = path.join(work, 'd');
  const newer = path.join(base, '.game-manager');
  const older = path.join(base, '.sf3000-manager');
  const to = path.join(base, '.retro-game-manager');
  await put(path.join(newer, 'settings.json'), 'newer');
  await put(path.join(older, 'settings.json'), 'older');
  const moves = await moveLegacyData([newer, older], to);
  assert.equal(moves.length, 1);
  assert.equal(moves[0]?.result?.moved, true);
  assert.equal(await fs.readFile(path.join(to, 'settings.json'), 'utf8'), 'newer');
  assert.ok(await exists(path.join(older, 'settings.json')), 'the older version is not mixed in');
  // Without the newer one, the older one is used.
  const to2 = path.join(base, 'second');
  const moves2 = await moveLegacyData([path.join(base, 'missing'), older], to2);
  assert.deepEqual(
    moves2.map((m) => m.result?.moved),
    [false, true],
  );
});

test(
  'a failed move is reported, nothing is thrown, and the old folder is kept',
  { skip: process.platform === 'win32' || process.getuid?.() === 0 },
  async () => {
    const base = path.join(work, 'e');
    const from = path.join(base, 'Game Manager');
    const to = path.join(base, 'Retro Game Manager');
    await put(path.join(from, 'settings.json'), 'old');
    await put(path.join(from, 'backups', 'x.bak'));
    await fs.mkdir(to, { recursive: true });
    await fs.chmod(to, 0o555); // the new folder cannot be written to
    try {
      const [move] = await moveLegacyData([from], to);
      assert.ok(move?.error, 'the error is reported for the log');
      assert.ok(await exists(path.join(from, 'settings.json')), 'the old folder is kept');
    } finally {
      await fs.chmod(to, 0o755);
    }
  },
);
