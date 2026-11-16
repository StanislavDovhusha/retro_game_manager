import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { exists, read, write } from '../helpers/fs.ts';
import { inspectImage, makeBmp, makeImage, PNG } from '../helpers/images.ts';
import { startApi } from '../helpers/server.ts';
import { coverMarkerOf } from '../../src/services/fs/coverArt.ts';
import { deviceById } from '../../src/services/devices/registry.ts';

/** Generated covers have the size of the console's profile. */
const { width: COVER_WIDTH, height: COVER_HEIGHT } = deviceById('sf3000').covers;
import { toSafeFileName } from '../../src/utils/text.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const src = path.join(work, 'src');
const p = (...parts: string[]): string => path.join(sd, ...parts);
const images = (): Promise<string[]> => fs.readdir(p('SFC', 'images')).then((names) => names.sort());

async function resetCard(): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await fs.rm(src, { recursive: true, force: true });
  await write(p('SFC', 'Mario.zip'), 'rom');
  await write(p('SFC', 'Mario 2.zip'), 'rom2');
  await write(p('SFC', 'filelist.csv'), 'Mario.zip,Mario,mario\n');
  assert.equal((await api('PUT', '/api/sd/root', { body: { root: sd } })).status, 200);
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'SFC' } })).status, 200);
  assert.equal((await api('PUT', '/api/settings', { body: { extensions: ['zip'] } })).status, 200);
}

const setCover = (rel: string, imagePath: string) => api('PUT', '/api/games/image', { body: { rel, imagePath } });

test('every supported format is saved as <game name>.png', async () => {
  await resetCard();
  const pictures: Record<string, Buffer> = {
    'a.jpg': await makeImage('jpeg', 16, 12),
    'b.jpeg': await makeImage('jpeg', 16, 12),
    'c.webp': await makeImage('webp', 16, 12),
    'd.gif': await makeImage('gif', 16, 12),
    'e.bmp': makeBmp(16, 12),
    'f.png': await makeImage('png', 16, 12),
  };
  for (const [name, bytes] of Object.entries(pictures)) {
    await write(path.join(src, name), bytes);
    const res = await setCover('Mario.zip', path.join(src, name));
    assert.equal(res.status, 200, `${name}: ${res.text}`);
    assert.equal(res.body?.imagePath, p('SFC', 'images', 'Mario.png'), name);
    assert.deepEqual(await inspectImage(p('SFC', 'images', 'Mario.png')), { format: 'png', width: 16, height: 12 }, name);
    assert.deepEqual(await images(), ['Mario.png'], `${name}: nothing but the PNG is left`);
    const served = await api('GET', '/api/games/image?rel=Mario.zip');
    assert.equal(served.headers.get('content-type'), 'image/png');
  }
});

test('the picture is really converted: the stored bytes are a PNG, not the original renamed', async () => {
  await resetCard();
  await write(path.join(src, 'cover.jpg'), await makeImage('jpeg', 10, 10));
  assert.equal((await setCover('Mario.zip', path.join(src, 'cover.jpg'))).status, 200);
  const head = await fs.readFile(p('SFC', 'images', 'Mario.png'));
  assert.deepEqual([...head.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test('a cover in another format is deleted only after the new PNG is saved', async () => {
  await resetCard();
  await write(p('SFC', 'images', 'Mario.jpg'), await makeImage('jpeg'));
  await write(p('SFC', 'images', 'Mario.webp'), await makeImage('webp'));
  await write(p('SFC', 'images', 'Mario 2.jpg'), await makeImage('jpeg')); // another game: must stay
  await write(path.join(src, 'new.gif'), await makeImage('gif', 20, 10));
  const res = await setCover('Mario.zip', path.join(src, 'new.gif'));
  assert.equal(res.status, 200, res.text);
  assert.deepEqual(await images(), ['Mario 2.jpg', 'Mario.png']);
  assert.deepEqual(await inspectImage(p('SFC', 'images', 'Mario.png')), { format: 'png', width: 20, height: 10 });
});

test('a picture that cannot be converted: the old cover stays untouched and nothing new appears', async () => {
  await resetCard();
  await write(p('SFC', 'images', 'Mario.jpg'), await makeImage('jpeg'));
  const good = await makeImage('jpeg', 64, 64);
  await write(path.join(src, 'broken.jpg'), good.subarray(0, 40)); // a valid signature, a truncated body
  const res = await setCover('Mario.zip', path.join(src, 'broken.jpg'));
  assert.equal(res.status, 400, res.text);
  assert.deepEqual(await images(), ['Mario.jpg']);

  await write(path.join(src, 'text.png'), 'not an image');
  assert.equal((await setCover('Mario.zip', path.join(src, 'text.png'))).status, 400);
  const bmp = makeBmp(8, 8);
  await write(path.join(src, 'cut.bmp'), bmp.subarray(0, bmp.length - 30));
  assert.equal((await setCover('Mario.zip', path.join(src, 'cut.bmp'))).status, 400);
  assert.deepEqual(await images(), ['Mario.jpg']);
});

test('a cover that is already <game>.png is replaced in place', async () => {
  await resetCard();
  await write(p('SFC', 'images', 'Mario.png'), PNG);
  await write(path.join(src, 'wide.png'), await makeImage('png', 30, 5));
  assert.equal((await setCover('Mario.zip', path.join(src, 'wide.png'))).status, 200);
  assert.deepEqual(await images(), ['Mario.png']);
  assert.deepEqual(await inspectImage(p('SFC', 'images', 'Mario.png')), { format: 'png', width: 30, height: 5 });
  assert.ok(await exists(path.join(src, 'wide.png')), 'the source file is never touched');
});

test('setting the picture that is the current cover itself does not delete it', async () => {
  await resetCard();
  await write(p('SFC', 'images', 'Mario.png'), await makeImage('png', 7, 7));
  assert.equal((await setCover('Mario.zip', p('SFC', 'images', 'Mario.png'))).status, 200);
  assert.deepEqual(await images(), ['Mario.png']);
});

test('adding a game with a JPG cover stores <title>.png', async () => {
  await resetCard();
  await write(path.join(src, 'Zelda.zip'), 'zelda');
  await write(path.join(src, 'zelda cover.jpg'), await makeImage('jpeg', 12, 9));
  const added = await api('POST', '/api/games/add', {
    body: {
      game: { type: 'path', path: path.join(src, 'Zelda.zip') },
      title: 'Zelda',
      image: { type: 'path', path: path.join(src, 'zelda cover.jpg') },
    },
  });
  assert.equal(added.status, 200, added.text);
  assert.deepEqual(await images(), ['Zelda.png']);
  assert.deepEqual(await inspectImage(p('SFC', 'images', 'Zelda.png')), { format: 'png', width: 12, height: 9 });
});

test('adding a game with a cover that cannot be read adds nothing', async () => {
  await resetCard();
  await write(path.join(src, 'Zelda.zip'), 'zelda');
  await write(path.join(src, 'bad.jpg'), (await makeImage('jpeg', 50, 50)).subarray(0, 30));
  const added = await api('POST', '/api/games/add', {
    body: {
      game: { type: 'path', path: path.join(src, 'Zelda.zip') },
      title: 'Zelda',
      image: { type: 'path', path: path.join(src, 'bad.jpg') },
    },
  });
  assert.equal(added.status, 400, added.text);
  assert.ok(!(await exists(p('SFC', 'Zelda.zip'))));
  assert.deepEqual(await fs.readdir(p('SFC', 'images')).catch(() => []), []);
});

// ── Generated covers ──

const addGame = async (title: string): Promise<Record<string, unknown> | null> => {
  const source = path.join(src, `${title}-source.zip`);
  await write(source, 'rom');
  const res = await api('POST', '/api/games/add', { body: { game: { type: 'path', path: source }, title, image: null } });
  assert.equal(res.status, 200, res.text);
  return res.body;
};
const markerOf = async (file: string) => coverMarkerOf(await fs.readFile(file));

test('a game added without an image gets a generated cover <title>.png with the platform colors', async () => {
  await resetCard();
  const added = await addGame('Super Metroid');
  assert.equal(added?.imageName, 'Super Metroid.png');
  assert.equal(added?.imageGenerated, true);
  assert.deepEqual(await images(), ['Super Metroid.png']);
  const file = p('SFC', 'images', 'Super Metroid.png');
  assert.deepEqual(await inspectImage(file), { format: 'png', width: COVER_WIDTH, height: COVER_HEIGHT });
  assert.deepEqual(await markerOf(file), { title: 'Super Metroid', platform: 'SFC' });
  const served = await api('GET', `/api/games/image?rel=${encodeURIComponent('Super Metroid.zip')}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
});

test('a picture the user chooses later replaces the generated cover', async () => {
  await resetCard();
  await addGame('Kirby');
  await write(path.join(src, 'kirby.jpg'), await makeImage('jpeg', 20, 30));
  assert.equal((await setCover('Kirby.zip', path.join(src, 'kirby.jpg'))).status, 200);
  assert.deepEqual(await images(), ['Kirby.png']);
  assert.deepEqual(await inspectImage(p('SFC', 'images', 'Kirby.png')), { format: 'png', width: 20, height: 30 });
  assert.equal(await markerOf(p('SFC', 'images', 'Kirby.png')), null, 'it is the user’s cover now');
});

test('renaming a game redraws its generated cover with the new title; a cover the user chose is only renamed', async () => {
  await resetCard();
  await addGame('Contra');
  const preview = await api('POST', '/api/games/rename/preview', { body: { rel: 'Contra.zip', title: 'Contra III' } });
  assert.equal(preview.status, 200, preview.text);
  const kinds = (preview.body?.steps as { kind: string; from: string }[]).map((step) => [step.kind, step.from]);
  assert.deepEqual(
    kinds.filter(([kind]) => kind === 'image' || kind === 'cover'),
    [
      ['image', 'Contra.png'],
      ['cover', 'Contra III.png'],
    ],
  );
  const done = await api('POST', '/api/games/rename', { body: { rel: 'Contra.zip', title: 'Contra III', confirmed: true } });
  assert.equal(done.status, 200, done.text);
  assert.deepEqual(await images(), ['Contra III.png']);
  assert.deepEqual(await markerOf(p('SFC', 'images', 'Contra III.png')), { title: 'Contra III', platform: 'SFC' });

  // A title change from the table is a rename as well.
  const edited = await api('PUT', '/api/games/entry', { body: { rel: 'Contra III.zip', name: 'Contra Hard Corps', confirmed: true } });
  assert.equal(edited.status, 200, edited.text);
  assert.deepEqual(await images(), ['Contra Hard Corps.png']);
  assert.equal((await markerOf(p('SFC', 'images', 'Contra Hard Corps.png')))?.title, 'Contra Hard Corps');

  // The user's own picture: renamed, never redrawn.
  await write(path.join(src, 'own.png'), await makeImage('png', 12, 12));
  assert.equal((await setCover('Contra Hard Corps.zip', path.join(src, 'own.png'))).status, 200);
  const own = await fs.readFile(p('SFC', 'images', 'Contra Hard Corps.png'));
  const renamed = await api('POST', '/api/games/rename', { body: { rel: 'Contra Hard Corps.zip', title: 'Probotector', confirmed: true } });
  assert.equal(renamed.status, 200, renamed.text);
  assert.ok(!(renamed.body?.steps as { kind: string }[]).some((step) => step.kind === 'cover'));
  assert.deepEqual(await fs.readFile(p('SFC', 'images', 'Probotector.png')), own);
});

test('a title change that keeps the file name still redraws the generated cover', async () => {
  await resetCard();
  await addGame('Mega Man 2');
  // A game whose file name differs from its title (copied by hand): MM2.zip titled "Mega Man 2" in the CSV.
  await fs.rename(p('SFC', 'Mega Man 2.zip'), p('SFC', 'MM2.zip'));
  await fs.rename(p('SFC', 'images', 'Mega Man 2.png'), p('SFC', 'images', 'MM2.png'));
  await write(p('SFC', 'filelist.csv'), (await read(p('SFC', 'filelist.csv'))).replace('Mega Man 2.zip,', 'MM2.zip,'));
  // The new title "MM2" makes the same file name, but the cover shows the title: it is drawn again.
  const res = await api('PUT', '/api/games/entry', { body: { rel: 'MM2.zip', name: 'MM2', confirmed: true } });
  assert.equal(res.status, 200, res.text);
  assert.deepEqual(await images(), ['MM2.png']);
  assert.equal((await markerOf(p('SFC', 'images', 'MM2.png')))?.title, 'MM2');
});

test('no cover is drawn over an image that already has the name of the game', async () => {
  await resetCard();
  const existing = await makeImage('png', 10, 10);
  await write(p('SFC', 'images', 'Zelda.png'), existing);
  const added = await addGame('Zelda');
  assert.equal(added?.imageGenerated, false);
  assert.equal(added?.imageName, null);
  assert.ok((added?.warnings as string[]).some((warning) => warning.includes('Zelda.png')));
  assert.deepEqual(await fs.readFile(p('SFC', 'images', 'Zelda.png')), existing);
});

test('a cover is generated for a title with spaces, brackets, hyphens and underscores; images/ is created', async () => {
  await resetCard();
  assert.equal(await exists(p('SFC', 'images')), false, 'the images folder does not exist yet');
  const refused = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: path.join(src, 'Zelda.zip') }, title: 'Легенда о Зелде', image: null },
  });
  assert.equal(refused.status, 400, 'a Cyrillic title is refused');
  const title = 'The Legend of Zelda - Link_s Awakening (DX) [Rev 1]';
  const added = await addGame(title);
  assert.equal(added?.imageGenerated, true);

  // The cover has the same (cleaned) name as the game file: <name>.png next to <name>.zip.
  const base = toSafeFileName(title);
  assert.equal(added?.rel, `${base}.zip`);
  assert.equal(added?.imageName, `${base}.png`);
  const file = p('SFC', 'images', `${base}.png`);
  assert.ok(await exists(file), file);
  assert.deepEqual(await inspectImage(file), { format: 'png', width: COVER_WIDTH, height: COVER_HEIGHT }, 'a valid PNG');
  assert.equal((await markerOf(file))?.title, added?.title);

  // The table shows it: the library finds the cover by the game.
  const library = (await api('GET', '/api/library')).body?.files as { rel: string; hasImage?: boolean; image?: unknown }[];
  const row = library.find((game) => game.rel === `${base}.zip`);
  assert.ok(row, 'the game is in the library');
  const served = await api('GET', `/api/games/image?rel=${encodeURIComponent(`${base}.zip`)}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
});

test('when the cover cannot be created the game is still added, with the "Cover could not be created" warning', async () => {
  await resetCard();
  await write(p('SFC', 'images'), 'a file where the images folder should be'); // the folder cannot be read or created
  const added = await addGame('Earthbound');
  assert.equal(added?.imageGenerated, false);
  assert.equal(added?.imageName, null);
  assert.ok(
    (added?.warnings as string[]).some((warning) => warning.startsWith('Cover could not be created')),
    String(added?.warnings),
  );
  assert.ok(await exists(p('SFC', 'Earthbound.zip')));
  assert.match(await fs.readFile(p('SFC', 'filelist.csv'), 'utf8'), /^Earthbound\.zip,Earthbound,earthbound,$/m);
  const log = (await api('GET', '/api/log')).body?.entries as { level: string; message: string }[];
  assert.ok(
    log.some((entry) => entry.level === 'warn' && entry.message.startsWith('Cover could not be created')),
    'the journal has it too',
  );
});

test('a read-only images folder: the game is added, the cover is skipped with a warning', { skip: process.getuid?.() === 0 }, async () => {
  await resetCard();
  await fs.mkdir(p('SFC', 'images'));
  await fs.chmod(p('SFC', 'images'), 0o555);
  try {
    const added = await addGame('Star Fox');
    assert.equal(added?.imageGenerated, false);
    assert.ok((added?.warnings as string[]).some((warning) => warning.startsWith('Cover could not be created')));
    assert.ok(await exists(p('SFC', 'Star Fox.zip')));
    assert.deepEqual(await fs.readdir(p('SFC', 'images')), [], 'no temporary file is left behind');
  } finally {
    await fs.chmod(p('SFC', 'images'), 0o755);
  }
});
