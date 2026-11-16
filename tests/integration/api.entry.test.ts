import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { exists, read, write } from '../helpers/fs.ts';
import { PNG } from '../helpers/images.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);

interface LibraryFile {
  rel: string;
  title: string | null;
  short: string | null;
  tags: string[];
}
const library = async (): Promise<LibraryFile[]> => (await api('GET', '/api/library')).body?.files as LibraryFile[];
const entry = async (rel: string): Promise<LibraryFile | undefined> => (await library()).find((file) => file.rel === rel);

/** A card whose CSV has no 4th column at all (the format before tags existed). */
async function resetCard(csv = 'Mario.zip,Mario,mario\nMario 2.zip,Mario 2,mario2\nZelda.zip,Zelda,zelda,rpg adventure\n'): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await fs.rm(path.join(work, 'data', 'backups'), { recursive: true, force: true });
  for (const name of ['Mario', 'Mario 2', 'Zelda']) await write(p('SFC', `${name}.zip`), name);
  await write(p('SFC', 'Extra.zip'), 'extra'); // not in the CSV
  await write(p('SFC', 'images', 'Mario.png'), PNG);
  await write(p('SFC', 'filelist.csv'), csv);
  await write(p('cubegm', 'saves', 'Mario.sav'), 's');
  await write(p('cubegm', 'states', 'Mario.state1'), 'st');
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'SFC' } })).status, 200);
  assert.equal((await api('PUT', '/api/settings', { body: { extensions: ['zip'] } })).status, 200);
}

const update = (body: Record<string, unknown>) => api('PUT', '/api/games/entry', { body });

test('the library reads tags from the 4th column; rows without it have no tags and nothing breaks', async () => {
  await resetCard();
  assert.deepEqual((await entry('Zelda.zip'))?.tags, ['rpg', 'adventure']);
  assert.deepEqual((await entry('Mario.zip'))?.tags, []);
  assert.deepEqual((await entry('Extra.zip'))?.tags, []);
});

test('tags: saved as `tag1 tag2` in the 4th column, trimmed, without empty tags and duplicates', async () => {
  await resetCard();
  const res = await update({ rel: 'Mario.zip', tags: ['  rpg ', '', 'snes', 'rpg', 'snes'] });
  assert.equal(res.status, 200, res.text);
  assert.deepEqual(res.body?.tags, ['rpg', 'snes']);
  assert.equal(res.body?.renamed, false);
  assert.equal(
    await read(p('SFC', 'filelist.csv')),
    'Mario.zip,Mario,mario,rpg snes\nMario 2.zip,Mario 2,mario2\nZelda.zip,Zelda,zelda,rpg adventure\n',
  );
  assert.deepEqual((await entry('Mario.zip'))?.tags, ['rpg', 'snes']);
  assert.ok(res.body?.csvBackupPath, 'the CSV is backed up before it is written');

  const cleared = await update({ rel: 'Zelda.zip', tags: [] });
  assert.equal(cleared.status, 200, cleared.text);
  assert.deepEqual((await entry('Zelda.zip'))?.tags, []);
});

test('a tag with a space is refused with a clear message and the CSV is not touched', async () => {
  await resetCard();
  const before = await read(p('SFC', 'filelist.csv'));
  const res = await update({ rel: 'Mario.zip', tags: ['good', 'two words'] });
  assert.equal(res.status, 400);
  assert.match(String(res.body?.error), /two words/);
  assert.equal(await read(p('SFC', 'filelist.csv')), before);
  assert.equal((await update({ rel: 'Mario.zip', tags: ['x'.repeat(65)] })).status, 400);
  assert.equal((await update({ rel: 'Mario.zip' })).status, 400, 'nothing to change');
});

test('the short name: changed alone, a space is refused, an empty one is refused', async () => {
  await resetCard();
  const res = await update({ rel: 'Mario 2.zip', short: 'luigi' });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body?.short, 'luigi');
  assert.match(await read(p('SFC', 'filelist.csv')), /^Mario 2\.zip,Mario 2,luigi\n/m);
  assert.equal((await update({ rel: 'Mario 2.zip', short: 'two words' })).status, 400);
  assert.equal((await update({ rel: 'Mario 2.zip', short: '  ' })).status, 400);
});

test('a game that is not in the CSV gets an entry', async () => {
  await resetCard();
  const res = await update({ rel: 'Extra.zip', tags: ['new'] });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body?.title, 'Extra');
  const after = await entry('Extra.zip');
  assert.deepEqual(after?.tags, ['new']);
  assert.equal(after?.title, 'Extra');
  assert.match(await read(p('SFC', 'filelist.csv')), /^Extra\.zip,Extra,extra,new$/m);
});

test('an entry with empty titles: the answer names the game by its file, the empty cells stay empty', async () => {
  await resetCard('Extra.zip,,\nMario.zip,Mario,mario\n');
  const res = await update({ rel: 'Extra.zip', tags: ['x'] });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body?.title, 'Extra');
  assert.equal(res.body?.short, '');
  assert.match(await read(p('SFC', 'filelist.csv')), /^Extra\.zip,,,x\n/);
});

test('a new name: confirmation is required; then the file, cover, saves and states are renamed and the tags stay', async () => {
  await resetCard();
  assert.equal((await update({ rel: 'Zelda.zip', name: 'Link' })).status, 400);
  assert.ok(await exists(p('SFC', 'Zelda.zip')));

  const res = await update({ rel: 'Mario.zip', name: 'Super Mario World', confirmed: true, tags: ['plumber'] });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body?.renamed, true);
  assert.equal(res.body?.rel, 'Super Mario World.zip');
  assert.ok(await exists(p('SFC', 'Super Mario World.zip')));
  assert.ok(!(await exists(p('SFC', 'Mario.zip'))));
  assert.ok(await exists(p('SFC', 'images', 'Super Mario World.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Super Mario World.sav')));
  assert.ok(await exists(p('cubegm', 'states', 'Super Mario World.state1')));
  assert.match(await read(p('SFC', 'filelist.csv')), /^Super Mario World\.zip,Super Mario World,superMarioWorld,plumber\n/);

  const renamedZelda = await update({ rel: 'Zelda.zip', name: 'Link', confirmed: true });
  assert.equal(renamedZelda.status, 200, renamedZelda.text);
  assert.deepEqual(renamedZelda.body?.tags, ['rpg', 'adventure'], 'the tags are kept when only the name changes');
  assert.match(await read(p('SFC', 'filelist.csv')), /^Link\.zip,Link,link,rpg adventure$/m);
});

test('a taken name is a 409 and nothing changes', async () => {
  await resetCard();
  const csv = await read(p('SFC', 'filelist.csv'));
  const res = await update({ rel: 'Mario 2.zip', name: 'Mario', confirmed: true, tags: ['x'] });
  assert.equal(res.status, 409);
  assert.ok(await exists(p('SFC', 'Mario 2.zip')));
  assert.equal(await read(p('SFC', 'filelist.csv')), csv);
});

test('the same name (only spaces or letter case of the input differ) is not a rename', async () => {
  await resetCard();
  const res = await update({ rel: 'Mario.zip', name: '  Mario ', tags: ['a'] });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body?.renamed, false);
  assert.ok(await exists(p('SFC', 'Mario.zip')));
});

test('unknown games and paths outside the library are refused', async () => {
  await resetCard();
  assert.equal((await update({ rel: 'Nope.zip', tags: ['a'] })).status, 404);
  assert.equal((await update({ rel: '../../etc/passwd', tags: ['a'] })).status, 400);
  assert.equal((await update({ rel: 'Mario.zip', tags: 'rpg' })).status, 400, 'tags must be a list');
});

test('a CSV with a header: the tags column must be configured', async () => {
  await resetCard('path,name,short\nMario.zip,Mario,mario\n');
  assert.equal(
    (
      await api('PUT', '/api/settings', {
        body: { csv: { delimiter: ',', hasHeader: true, columns: { path: 'path', name: 'name', short: 'short' } } },
      })
    ).status,
    200,
  );
  const before = await read(p('SFC', 'filelist.csv'));
  const refused = await update({ rel: 'Mario.zip', tags: ['a'] });
  assert.equal(refused.status, 400, 'there is no tags column to write to');
  assert.equal(await read(p('SFC', 'filelist.csv')), before);

  // The column is named in the settings, but the header does not have it: still an understandable refusal.
  assert.equal((await api('PUT', '/api/settings', { body: { csv: { columns: { tags: 'tags' } } } })).status, 200);
  assert.equal((await update({ rel: 'Mario.zip', tags: ['a'] })).status, 400);
  assert.equal(await read(p('SFC', 'filelist.csv')), before);

  await write(p('SFC', 'filelist.csv'), 'path,name,short,tags\nMario.zip,Mario,mario,\n');
  const ok = await update({ rel: 'Mario.zip', tags: ['a', 'b'] });
  assert.equal(ok.status, 200, ok.text);
  assert.match(await read(p('SFC', 'filelist.csv')), /Mario\.zip,Mario,mario,a b/);
});
