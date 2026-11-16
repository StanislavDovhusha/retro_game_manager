import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { encodeEcm, makeImage } from '../helpers/ecm.ts';
import { exists, read, write } from '../helpers/fs.ts';
import { PNG } from '../helpers/images.ts';
import { startApi } from '../helpers/server.ts';
import { readSingleZip } from '../helpers/zip.ts';

const api = await startApi();
const sd = path.join(work, 'SD');
const p = (...parts: string[]): string => path.join(sd, ...parts);

async function resetCard(): Promise<void> {
  await fs.rm(sd, { recursive: true, force: true });
  await write(p('SFC', 'Mario.zip'), 'rom');
  await write(p('SFC', 'Mario 2.zip'), 'rom2');
  await write(p('SFC', 'images', 'Mario.png'), PNG);
  await write(p('SFC', 'filelist.csv'), 'Mario.zip,Mario,mario\nMario 2.zip,Mario 2,mario2\nGone.zip,Gone,gone\n');
  await write(p('cubegm', 'saves', 'Mario.sav'), 's');
  await write(p('cubegm', 'allfiles.lst'), 'SFC/Mario.zip|Mario|MARIO|mario|MARIO\nSFC/Mario 2.zip|Mario 2|MARIO 2|mario2|MARIO2\n');
  const root = await api('PUT', '/api/sd/root', { body: { root: sd } });
  assert.equal(root.status, 200);
  const platform = await api('PUT', '/api/sd/platform', { body: { name: 'SFC' } });
  assert.equal(platform.status, 200);
  const settings = await api('PUT', '/api/settings', { body: { extensions: ['zip', 'iso', 'img', 'cue', 'bin'] } });
  assert.equal(settings.status, 200);
}

test('the settings patches the client sends are accepted (partial, empty values, nested)', async () => {
  await resetCard();
  for (const patch of [
    { theme: 'light' },
    { ui: { columnWidths: { name: 300, csv: 80 }, hiddenPanels: { left: true } } },
    { ui: { language: 'uk' } },
    { ui: { columnWidths: { tags: 240 }, foldersShare: 0.7, hiddenPanels: { games: true } } },
    { csv: { delimiter: ';', hasHeader: true, columns: { name: 'Title' } } },
    { csv: { delimiter: ',', hasHeader: false, columns: { name: '' } } },
    { imagesDir: '' },
  ]) {
    const res = await api('PUT', '/api/settings', { body: patch });
    assert.equal(res.status, 200, JSON.stringify(patch));
  }
  const settings = (await api('GET', '/api/settings')).body?.settings as { theme: string; ui: { language: string } };
  assert.equal(settings.theme, 'light');
  assert.equal(settings.ui.language, 'uk');
  const ui = settings.ui as unknown as { columnWidths: Record<string, number>; foldersShare: number; hiddenPanels: { games: boolean } };
  assert.equal(ui.columnWidths.tags, 240);
  assert.equal(ui.foldersShare, 0.7);
  assert.equal(ui.hiddenPanels.games, true);
  await api('PUT', '/api/settings', { body: { ui: { language: 'en' }, theme: 'dark' } });
});

test('rename: preview, confirmation is required, then every related file is renamed', async () => {
  await resetCard();
  const preview = await api('POST', '/api/games/rename/preview', { body: { rel: 'Mario.zip', title: 'Super Mario World' } });
  assert.equal(preview.status, 200);
  assert.equal(preview.body?.newRel, 'Super Mario World.zip');
  assert.ok(await exists(p('SFC', 'Mario.zip')));

  const unconfirmed = await api('POST', '/api/games/rename', { body: { rel: 'Mario.zip', title: 'Super Mario World' } });
  assert.equal(unconfirmed.status, 400);
  assert.ok(await exists(p('SFC', 'Mario.zip')));

  const done = await api('POST', '/api/games/rename', { body: { rel: 'Mario.zip', title: 'Super Mario World', confirmed: true } });
  assert.equal(done.status, 200);
  assert.equal(done.body?.short, 'superMarioWorld');
  assert.ok(await exists(p('SFC', 'Super Mario World.zip')));
  assert.ok(await exists(p('SFC', 'images', 'Super Mario World.png')));
  assert.ok(await exists(p('cubegm', 'saves', 'Super Mario World.sav')));
  assert.match(await read(p('SFC', 'filelist.csv')), /^Super Mario World\.zip,Super Mario World,superMarioWorld\n/);
  assert.match(
    await read(p('cubegm', 'allfiles.lst')),
    /^SFC\/Super Mario World\.zip\|Super Mario World\|SUPER MARIO WORLD\|superMarioWorld\|SUPERMARIOWORLD\n/,
  );

  const conflict = await api('POST', '/api/games/rename', { body: { rel: 'Mario 2.zip', title: 'Super Mario World', confirmed: true } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body?.code, 'CONFLICT');
});

test('cover: read, replace, delete', async () => {
  await resetCard();
  const image = await api('GET', '/api/games/image?rel=Mario.zip');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('cache-control'), 'no-cache');

  assert.equal((await api('GET', '/api/games/image?rel=Nope.zip')).status, 404);

  const other = p('other.png');
  await write(other, PNG);
  const set = await api('PUT', '/api/games/image', { body: { rel: 'Mario 2.zip', imagePath: other } });
  assert.equal(set.status, 200);
  assert.equal((await api('GET', '/api/games/image?rel=Mario%202.zip')).status, 200);

  await write(p('fake.png'), 'not an image');
  assert.equal((await api('PUT', '/api/games/image', { body: { rel: 'Mario 2.zip', imagePath: p('fake.png') } })).status, 400);

  assert.equal((await api('DELETE', '/api/games/image', { body: { rel: 'Mario.zip' } })).status, 400); // no confirmation
  const del = await api('DELETE', '/api/games/image', { body: { rel: 'Mario.zip', confirmed: true } });
  assert.equal(del.status, 200);
  assert.ok(!(await exists(p('SFC', 'images', 'Mario.png'))));
});

test('delete: confirmation is required; the CSV entry is removed together with the file', async () => {
  await resetCard();
  assert.equal((await api('DELETE', '/api/games', { body: { rel: 'Mario.zip' } })).status, 400);
  assert.ok(await exists(p('SFC', 'Mario.zip')));
  const res = await api('DELETE', '/api/games', { body: { rel: 'Mario.zip', confirmed: true } });
  assert.equal(res.status, 200);
  assert.ok(!(await exists(p('SFC', 'Mario.zip'))));
  assert.doesNotMatch(await read(p('SFC', 'filelist.csv')), /Mario\.zip/);

  const batch = await api('DELETE', '/api/games/batch', { body: { rels: ['Mario 2.zip', 'Missing.zip'], confirmed: true } });
  assert.equal(batch.status, 200);
  assert.deepEqual(batch.body?.deleted, ['Mario 2.zip']);
  assert.deepEqual(batch.body?.missing, ['Missing.zip']);
  assert.equal((await api('DELETE', '/api/games/batch', { body: { rels: [], confirmed: true } })).status, 400);
});

test('nothing inside rootfs or cubegm can be deleted through the API', async () => {
  await resetCard();
  const res = await api('DELETE', '/api/games', { body: { rel: '../cubegm/saves/Mario.sav', confirmed: true } });
  assert.equal(res.status, 400);
  assert.ok(await exists(p('cubegm', 'saves', 'Mario.sav')));
});

test('CSV: read, save, preview, clean up missing entries', async () => {
  await resetCard();
  const data = await api('GET', '/api/csv/data');
  assert.equal(data.status, 200);
  assert.equal((data.body?.rows as string[][]).length, 3);

  const missing = await api('POST', '/api/csv/missing/preview');
  assert.equal(missing.status, 200);
  assert.equal((missing.body?.missing as unknown[] | undefined)?.length ?? missing.body?.count, 1);

  assert.equal((await api('POST', '/api/csv/missing/apply', { body: { expected: 1 } })).status, 400); // no confirmation
  const applied = await api('POST', '/api/csv/missing/apply', { body: { expected: 1, confirmed: true } });
  assert.equal(applied.status, 200);
  assert.doesNotMatch(await read(p('SFC', 'filelist.csv')), /Gone\.zip/);

  const saved = await api('PUT', '/api/csv/data', { body: { rows: [['Mario.zip', 'Mario', 'mario']] } });
  assert.equal(saved.status, 200);
  assert.equal(await read(p('SFC', 'filelist.csv')), 'Mario.zip,Mario,mario\n');
  assert.equal((await api('PUT', '/api/csv/data', { body: { rows: 'nope' } })).status, 400);

  const preview = await api('POST', '/api/csv/preview', { body: { delimiter: ',', encoding: 'utf8', hasHeader: false } });
  assert.equal(preview.status, 200);
  assert.equal((await api('POST', '/api/csv/preview', { body: { delimiter: 'x' } })).status, 400);
});

test('sync: preview changes nothing, apply needs confirmation and updates the CSV', async () => {
  await resetCard();
  await write(p('SFC', 'New Game.zip'), 'rom');
  const before = await read(p('SFC', 'filelist.csv'));
  const preview = await api('POST', '/api/sync/preview');
  assert.equal(preview.status, 200);
  assert.equal(await read(p('SFC', 'filelist.csv')), before);
  assert.equal((await api('POST', '/api/sync/apply', { body: {} })).status, 400);
  const applied = await api('POST', '/api/sync/apply', { body: { confirmed: true } });
  assert.equal(applied.status, 200);
  const csv = await read(p('SFC', 'filelist.csv'));
  assert.match(csv, /New Game\.zip,New Game,newGame/);
  assert.doesNotMatch(csv, /Gone\.zip/);
});

test('add a game by path: inspect, then add with a cover; the files are copied into the library', async () => {
  await resetCard();
  const source = path.join(work, 'incoming', 'weird_dump.zip');
  const cover = path.join(work, 'incoming', 'cover.png');
  await write(source, 'zip-data');
  await write(cover, PNG);

  const info = await api('POST', '/api/add/inspect', { body: { kind: 'game', path: source } });
  assert.equal(info.status, 200);
  assert.equal(info.body?.fileName, 'weird_dump.zip');
  assert.equal((await api('POST', '/api/add/inspect', { body: { path: source } })).status, 200, 'kind defaults to "game"');
  const set = await api('POST', '/api/add/inspect-set', { body: { paths: [source] } });
  assert.equal(set.status, 200);
  assert.equal(set.body?.mode, 'single');

  // Only English letters, digits, spaces and - _ ( ) [ ] . & # : — "!", Cyrillic or Japanese is refused.
  for (const title of ['My New Game!', 'Моя игра', '私のゲーム', 'Pokémon']) {
    const refused = await api('POST', '/api/games/add', { body: { game: { type: 'path', path: source }, title, image: null } });
    assert.equal(refused.status, 400, title);
  }
  assert.ok(!(await exists(p('SFC', 'My New Game.zip'))), 'nothing was added');

  const added = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: source }, title: 'My New_Game-2 (USA) [b1]', image: { type: 'path', path: cover } },
  });
  assert.equal(added.status, 200, added.text);
  assert.equal(await read(p('SFC', 'My New_Game-2 (USA) [b1].zip')), 'zip-data');
  assert.ok(await exists(p('SFC', 'images', 'My New_Game-2 (USA) [b1].png')));
  assert.match(await read(p('SFC', 'filelist.csv')), /My New_Game-2 \(USA\) \[b1\]\.zip,My New_Game-2 \(USA\) \[b1\],/);

  const again = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: source }, title: 'My New_Game-2 (USA) [b1]', image: null },
  });
  assert.equal(again.status, 409); // the file already exists: nothing is overwritten
  assert.equal(await read(p('SFC', 'My New_Game-2 (USA) [b1].zip')), 'zip-data');

  // ". & # :" are allowed in a title; the colon cannot be in a file name, so the file goes without it.
  const signs = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: source }, title: 'Dr. Mario: Rx #2 & Co', image: null },
  });
  assert.equal(signs.status, 200, signs.text);
  assert.equal(signs.body?.rel, 'Dr. Mario Rx #2 & Co.zip');
  assert.match(await read(p('SFC', 'filelist.csv')), /Dr\. Mario Rx #2 & Co\.zip,Dr\. Mario: Rx #2 & Co,/);
});

test('add a game from .bin + .cue: one .img is produced', async () => {
  await resetCard();
  const bin = path.join(work, 'disc', 'Game (Track 1).bin');
  const cue = path.join(work, 'disc', 'Game.cue');
  await write(bin, Buffer.alloc(2352 * 3, 4));
  await write(cue, 'FILE "Game (Track 1).bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n');
  const set = await api('POST', '/api/add/inspect-set', { body: { paths: [bin, cue] } });
  assert.equal(set.status, 200);
  assert.equal(set.body?.outputName, 'Game.img');
  const added = await api('POST', '/api/games/add', {
    body: {
      game: [
        { type: 'path', path: bin },
        { type: 'path', path: cue },
      ],
      title: 'Disc Game',
      image: null,
    },
  });
  assert.equal(added.status, 200);
  assert.equal((await fs.stat(p('SFC', 'Disc Game.img'))).size, 2352 * 3);
});

test('add a CloneCD set whose .img is an ECM archive: the unpacked .img alone lands on the card', async () => {
  await resetCard();
  const image = makeImage(['mode1', 'form1', 'form2', 'mode1']);
  const dir = path.join(work, 'clone');
  await write(path.join(dir, 'Spyro.ccd'), '[CloneCD]\nVersion=3\n');
  await write(path.join(dir, 'Spyro.img.ecm'), encodeEcm(image));
  await write(path.join(dir, 'Spyro.sub'), Buffer.alloc(4 * 96));
  const files = ['Spyro.ccd', 'Spyro.img.ecm', 'Spyro.sub'].map((name) => path.join(dir, name));

  const set = await api('POST', '/api/add/inspect-set', { body: { paths: files } });
  assert.equal(set.status, 200);
  assert.equal(set.body?.mode, 'clonecd');
  assert.equal(set.body?.outputName, 'Spyro.img');
  assert.equal(set.body?.size, image.length, 'the size of the unpacked image');

  const added = await api('POST', '/api/games/add', {
    body: { game: files.map((file) => ({ type: 'path', path: file })), title: 'Spyro the Dragon', image: null },
  });
  assert.equal(added.status, 200);
  assert.equal(added.body?.mode, 'clonecd');
  assert.deepEqual(await fs.readFile(p('SFC', 'Spyro the Dragon.img')), image);
  const onCard = await fs.readdir(p('SFC'));
  assert.ok(!onCard.some((name) => /\.(ecm|ccd|sub)$|\.part/.test(name)), onCard.join(', '));
  assert.match(await read(p('SFC', 'filelist.csv')), /Spyro the Dragon\.img,Spyro the Dragon,spyroTheDragon/);
  assert.ok(await exists(path.join(dir, 'Spyro.img.ecm')), 'the source files on the computer are not touched');
  assert.deepEqual((await api('GET', '/api/add/progress')).body, { progress: null });
});

test('"Compress to .zip": Game.sfc lands on the card as <title>.zip with <title>.sfc inside; the CSV gets the .zip', async () => {
  await resetCard();
  await api('PUT', '/api/settings', { body: { extensions: ['sfc'] } }); // .zip is not in the list yet
  const rom = Buffer.concat([Buffer.alloc(64 * 1024, 'SNES'), Buffer.from('end')]);
  const source = path.join(work, 'incoming', 'super_dump.sfc');
  await write(source, rom);

  const added = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: source }, title: 'Super Game', image: null, compress: true },
  });
  assert.equal(added.status, 200, added.text);
  assert.equal(added.body?.rel, 'Super Game.zip');
  assert.equal(added.body?.compressed, true);
  assert.equal(added.body?.extensionsChanged, true);

  const entry = readSingleZip(await fs.readFile(p('SFC', 'Super Game.zip')));
  assert.equal(entry.name, 'Super Game.sfc');
  assert.deepEqual(entry.data, rom);
  const onCard = await fs.readdir(p('SFC'));
  assert.ok(!onCard.includes('Super Game.sfc') && !onCard.some((name) => name.includes('.part')), onCard.join(', '));
  assert.match(await read(p('SFC', 'filelist.csv')), /^Super Game\.zip,Super Game,superGame,$/m, 'with the empty tags column');
  assert.equal(await read(source).then((text) => text.length), rom.length, 'the source is not touched');

  const settings = (await api('GET', '/api/settings')).body?.settings as { extensions: string[] };
  assert.ok(settings.extensions.includes('zip'), 'the .zip extension was added so the game shows up after scanning');
  const library = (await api('GET', '/api/library')).body?.files as { rel: string; inCsv: boolean }[];
  assert.equal(library.find((file) => file.rel === 'Super Game.zip')?.inCsv, true);
});

test('"Compress to .zip" for a disc image: the built .img is packed; a .zip source is copied as it is', async () => {
  await resetCard();
  const bin = path.join(work, 'zipdisc', 'Game.bin');
  const cue = path.join(work, 'zipdisc', 'Game.cue');
  await write(bin, Buffer.alloc(2352 * 3, 9));
  await write(cue, 'FILE "Game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n');
  const disc = await api('POST', '/api/games/add', {
    body: { game: [bin, cue].map((file) => ({ type: 'path', path: file })), title: 'Packed Disc', image: null, compress: true },
  });
  assert.equal(disc.status, 200, disc.text);
  assert.equal(disc.body?.rel, 'Packed Disc.zip');
  const entry = readSingleZip(await fs.readFile(p('SFC', 'Packed Disc.zip')));
  assert.equal(entry.name, 'Packed Disc.img');
  assert.deepEqual(entry.data, Buffer.alloc(2352 * 3, 9));

  const zip = path.join(work, 'zipdisc', 'already.zip');
  await write(zip, 'PK-already');
  const copied = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: zip }, title: 'Already Zip', image: null, compress: true },
  });
  assert.equal(copied.status, 200, copied.text);
  assert.equal(copied.body?.compressed, false);
  assert.equal(await read(p('SFC', 'Already Zip.zip')), 'PK-already', 'an archive is not packed into another one');
});

test('"Compress to .zip" is refused for PlayStation; nothing is written', async () => {
  await resetCard();
  await fs.mkdir(p('PS', 'images'), { recursive: true });
  assert.equal((await api('PUT', '/api/sd/platform', { body: { name: 'PS' } })).status, 200);
  const source = path.join(work, 'incoming', 'ps-game.iso');
  await write(source, 'iso');
  const refused = await api('POST', '/api/games/add', {
    body: { game: { type: 'path', path: source }, title: 'PS Game', image: null, compress: true },
  });
  assert.equal(refused.status, 400);
  assert.match(String(refused.body?.error), /PS/);
  assert.deepEqual(await fs.readdir(p('PS')), ['images'], 'neither a game file nor a CSV appeared');

  const plain = await api('POST', '/api/games/add', { body: { game: { type: 'path', path: source }, title: 'PS Game', image: null } });
  assert.equal(plain.status, 200, `without the flag the game is copied as before: ${plain.text}`);
  assert.equal(await read(p('PS', 'PS Game.iso')), 'iso');
});

test('the "Compress to .zip" choice is remembered in the settings', async () => {
  const defaults = (await api('GET', '/api/settings')).body?.settings as { ui: { compressZip: boolean } };
  assert.equal(defaults.ui.compressZip, false);
  assert.equal((await api('PUT', '/api/settings', { body: { ui: { compressZip: true } } })).status, 200);
  const saved = (await api('GET', '/api/settings')).body?.settings as { ui: { compressZip: boolean; language: string } };
  assert.equal(saved.ui.compressZip, true);
  assert.ok(saved.ui.language, 'the other ui settings are kept');
  assert.equal((await api('PUT', '/api/settings', { body: { ui: { compressZip: 'yes' } } })).status, 400);
  await api('PUT', '/api/settings', { body: { ui: { compressZip: false } } });
});

test('an incomplete set and a damaged archive are refused; nothing is left on the card', async () => {
  await resetCard();
  const dir = path.join(work, 'broken');
  await write(path.join(dir, 'Game.ccd'), '[CloneCD]\n');
  await write(path.join(dir, 'Game.sub'), Buffer.alloc(96));
  const incomplete = await api('POST', '/api/add/inspect-set', {
    body: { paths: [path.join(dir, 'Game.ccd'), path.join(dir, 'Game.sub')] },
  });
  assert.equal(incomplete.status, 400);
  assert.match(String(incomplete.body?.error), /Game\.img/);

  // The structure is fine (the plan accepts it), but the data is damaged: found while unpacking.
  const archive = encodeEcm(makeImage(['mode1', 'mode1']));
  archive[archive.length - 1] = (archive[archive.length - 1] ?? 0) ^ 1;
  await write(path.join(dir, 'Bad.bin.ecm'), archive);
  const csvBefore = await read(p('SFC', 'filelist.csv'));
  const failed = await api('POST', '/api/games/add', {
    body: { game: [{ type: 'path', path: path.join(dir, 'Bad.bin.ecm') }], title: 'Bad Game', image: null },
  });
  assert.equal(failed.status, 400);
  assert.match(String(failed.body?.error), /ECM/);
  assert.ok(!(await fs.readdir(p('SFC'))).some((name) => name.startsWith('Bad') || name.includes('.part')));
  assert.equal(await read(p('SFC', 'filelist.csv')), csvBefore);
});

test('games cannot be added into a protected folder or from a missing source', async () => {
  await resetCard();
  assert.equal((await api('POST', '/api/add/inspect', { body: { kind: 'game', path: p('SFC', 'nope.zip') } })).status, 400);
  assert.equal((await api('POST', '/api/add/inspect', { body: { kind: 'game', path: 'relative/path.zip' } })).status, 400);
  assert.equal((await api('POST', '/api/add/inspect-set', { body: { paths: [] } })).status, 400);
});

test('the support popup settings: saved between sessions, merged with the rest of ui, damaged values repaired', async () => {
  const defaults = (await api('GET', '/api/settings')).body?.settings as {
    ui: { language: string; tourDone: boolean; donate: { autoShow: boolean; counter: number; threshold: number; usageDays: number } };
  };
  const pick = (donate: typeof defaults.ui.donate) => ({ autoShow: donate.autoShow, counter: donate.counter, threshold: donate.threshold });
  assert.deepEqual(pick(defaults.ui.donate), { autoShow: true, counter: 0, threshold: 0 });
  assert.equal(defaults.ui.tourDone, false, 'the tour has not been taken yet');

  const saved = await api('PUT', '/api/settings', { body: { ui: { donate: { counter: 3, threshold: 9 } } } });
  assert.equal(saved.status, 200);
  const afterToggle = await api('PUT', '/api/settings', { body: { ui: { donate: { autoShow: false } } } });
  const settings = afterToggle.body?.settings as typeof defaults;
  assert.deepEqual(pick(settings.ui.donate), { autoShow: false, counter: 3, threshold: 9 }, 'a partial patch keeps the other values');
  assert.ok(settings.ui.language, 'the other ui settings are untouched');

  const reread = (await api('GET', '/api/settings')).body?.settings as typeof defaults;
  assert.deepEqual(pick(reread.ui.donate), { autoShow: false, counter: 3, threshold: 9 });

  // The launch reminder's records and the tour flag are kept too; a malformed day is refused by the schema.
  const launch = { firstLaunch: '2026-11-01', usageDays: 4, lastUsageDay: '2026-11-04', lastShownAt: 1_800_000_000_000 };
  const withLaunch = await api('PUT', '/api/settings', { body: { ui: { donate: launch, tourDone: true } } });
  assert.equal(withLaunch.status, 200);
  const kept = (withLaunch.body?.settings as typeof defaults).ui;
  assert.deepEqual({ ...kept.donate, ...launch }, kept.donate);
  assert.equal(kept.tourDone, true);
  assert.equal((await api('PUT', '/api/settings', { body: { ui: { donate: { firstLaunch: 'monday' } } } })).status, 400);
  await api('PUT', '/api/settings', { body: { ui: { tourDone: false } } });

  const outOfRange = await api('PUT', '/api/settings', { body: { ui: { donate: { threshold: 101 } } } });
  assert.equal(outOfRange.status, 400, 'a threshold the schema cannot accept is refused');
  const wrongType = await api('PUT', '/api/settings', { body: { ui: { donate: { autoShow: 'no' } } } });
  assert.equal(wrongType.status, 400);

  const outsideRange = await api('PUT', '/api/settings', { body: { ui: { donate: { threshold: 50 } } } });
  assert.equal(outsideRange.status, 200, 'values the schema allows but the rules do not are repaired, not stored');
  assert.equal((outsideRange.body?.settings as typeof defaults).ui.donate.threshold, 0);

  await api('PUT', '/api/settings', { body: { ui: { donate: { autoShow: true, counter: 0, threshold: 0 } } } });
});
