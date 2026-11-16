import { work } from '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectDiscSet, discSetFile, discSetTitle, type DiscSetResult } from '../../shared/discSet.ts';
import type { SourceRef } from '../../src/models/index.ts';
import { planGame } from '../../src/services/addGameService.ts';
import { buildAtomic } from '../../src/services/fs/copy.ts';
import { encodeEcm, makeImage } from '../helpers/ecm.ts';
import { isAppError } from '../helpers/fs.ts';

const kind = (names: string[]): string => {
  const result = detectDiscSet(names);
  return result.ok ? result.set.kind : `issue:${result.issue.code}`;
};
const issue = (names: string[]): Extract<DiscSetResult, { ok: false }>['issue'] => {
  const result = detectDiscSet(names);
  assert.ok(!result.ok, `an issue is expected for ${names.join(', ')}`);
  return result.issue;
};

// ── Recognizing a set by file names ──

test('an ECM archive is described by the file inside it', () => {
  assert.deepEqual(discSetFile('Game.img.ecm'), {
    name: 'Game.img.ecm',
    ext: 'ecm',
    ecm: true,
    unpacked: 'Game.img',
    unpackedExt: 'img',
    key: 'game',
  });
  assert.equal(discSetFile('Game.ecm').unpackedExt, '');
  assert.equal(discSetTitle('Final Fantasy VII (Disc 1).bin.ecm'), 'Final Fantasy VII (Disc 1)');
  assert.equal(discSetTitle('Game.ccd'), 'Game');
});

test('one file: copied as it is, unless it is an ECM archive or a part that needs the others', () => {
  assert.equal(kind(['Mario.zip']), 'single');
  assert.equal(kind(['Game.img']), 'single');
  assert.equal(kind(['Game.cue']), 'bincue'); // the .bin files are reported by the server, which reads the .cue
  assert.deepEqual(detectDiscSet(['Game.img.ecm']), { ok: true, set: { kind: 'ecm', file: 0, outputExt: 'img' } });
  assert.deepEqual(detectDiscSet(['Game.bin.ecm']), { ok: true, set: { kind: 'ecm', file: 0, outputExt: 'img' } });
  assert.deepEqual(detectDiscSet(['Game.ecm']), { ok: true, set: { kind: 'ecm', file: 0, outputExt: 'img' } });
  assert.deepEqual(detectDiscSet(['Game.iso.ecm']), { ok: true, set: { kind: 'ecm', file: 0, outputExt: 'iso' } });
});

test('BIN/CUE: a .cue with its .bin files (plain or packed as .ecm)', () => {
  assert.deepEqual(detectDiscSet(['Game.bin', 'Game.cue']), { ok: true, set: { kind: 'bincue', cue: 1, bins: [0] } });
  assert.deepEqual(detectDiscSet(['Game.cue', 'Game (Track 1).bin.ecm', 'Game (Track 2).bin']), {
    ok: true,
    set: { kind: 'bincue', cue: 0, bins: [1, 2] },
  });
  assert.equal(kind(['A.bin', 'B.bin']), 'issue:cueRequired');
  assert.equal(kind(['A.cue', 'B.cue', 'A.bin']), 'issue:multipleCue');
});

test('CloneCD: .ccd + .img + .sub, the .img may be an ECM archive; a .cue of the same dump is ignored', () => {
  assert.deepEqual(detectDiscSet(['Game.sub', 'Game.img', 'Game.ccd']), {
    ok: true,
    set: { kind: 'clonecd', ccd: 2, img: 1, sub: 0, ignored: [] },
  });
  assert.deepEqual(detectDiscSet(['Game.ccd', 'Game.img.ecm', 'Game.sub']), {
    ok: true,
    set: { kind: 'clonecd', ccd: 0, img: 1, sub: 2, ignored: [] },
  });
  assert.deepEqual(detectDiscSet(['Game.ccd', 'Game.ecm']), { ok: true, set: { kind: 'clonecd', ccd: 0, img: 1, sub: null, ignored: [] } });
  assert.deepEqual(detectDiscSet(['GAME.CCD', 'game.img', 'Game.cue']), {
    ok: true,
    set: { kind: 'clonecd', ccd: 0, img: 1, sub: null, ignored: [2] },
  });
  // With a single candidate a renamed .img still belongs to the set.
  assert.equal(kind(['Game.ccd', 'Renamed.img']), 'clonecd');
});

test('incomplete sets name the missing files', () => {
  assert.deepEqual(issue(['Game.ccd', 'Game.sub']), { code: 'missing', files: ['Game.img'] });
  assert.deepEqual(issue(['Game.ccd']), { code: 'missing', files: ['Game.img'] });
  assert.deepEqual(issue(['Game.sub']), { code: 'missing', files: ['Game.ccd', 'Game.img'] });
  assert.deepEqual(issue(['Game.img', 'Game.sub']), { code: 'missing', files: ['Game.ccd'] });
  assert.deepEqual(issue(['Game.img.ecm', 'Game.sub']), { code: 'missing', files: ['Game.ccd'] });
});

test('files that cannot go together are refused', () => {
  assert.equal(issue(['Game.bin', 'readme.txt']).code, 'mixed');
  assert.equal(issue(['Game.iso.ecm', 'Game.cue']).code, 'mixed');
  assert.equal(issue(['A.ccd', 'B.ccd', 'A.img']).code, 'multipleCcd');
  assert.deepEqual(issue(['Game.img', 'Game.img.ecm', 'Game.ccd']), { code: 'duplicate', files: ['Game.img', 'Game.img.ecm'] });
  assert.deepEqual(issue(['Game.ccd', 'Game.img', 'Other.img']), { code: 'extra', files: ['Other.img'] });
  assert.deepEqual(issue(['Game.ccd', 'A.img', 'B.img']), { code: 'extra', files: ['A.img', 'B.img'] });
  assert.deepEqual(issue(['Game.cue', 'Game.bin', 'Game.sub']), { code: 'extra', files: ['Game.sub'] });
  assert.equal(issue([]).code, 'empty');
});

// ── The client uses the same detection for its quick check ──

interface Rules {
  validateGameSet(names: readonly string[], extensions: readonly string[]): { key: string; params?: Record<string, unknown> } | null;
  targetFileName(names: readonly string[], title: string, compress?: boolean): { name: string; kind: string; inner?: string } | null;
  isZipSelection(names: readonly string[]): boolean;
  titleFromFiles(names: readonly string[]): string | null;
}
const rulesFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/src/app/features/dialogs/add-game-dialog/add-game.rules.ts',
);
const rules = (await import(pathToFileURL(rulesFile).href)) as Rules;

test('client: the quick check, the target name and the title of a set', () => {
  const exts = ['zip', 'img'];
  assert.equal(rules.validateGameSet(['Game.ccd', 'Game.img.ecm', 'Game.sub'], exts), null);
  assert.equal(rules.validateGameSet(['Game.bin.ecm'], exts), null);
  assert.deepEqual(rules.validateGameSet(['Game.ccd', 'Game.sub'], exts), {
    key: 'addGame.errors.missingFiles',
    params: { files: 'Game.img' },
  });
  assert.equal(rules.validateGameSet(['Game.iso.ecm'], exts)?.key, 'addGame.errors.extensionNotAllowed');
  assert.equal(rules.validateGameSet(['Game.cue'], exts)?.key, 'addGame.errors.binRequired');
  assert.equal(rules.validateGameSet(['Game.bin'], exts)?.key, 'addGame.errors.binNeedsCue');

  assert.deepEqual(rules.targetFileName(['Game.img.ecm'], 'My Game'), { name: 'My Game.img', kind: 'ecm' });
  assert.deepEqual(rules.targetFileName(['G.ccd', 'G.img', 'G.sub'], 'My Game'), { name: 'My Game.img', kind: 'clonecd' });
  assert.deepEqual(rules.targetFileName(['G.bin.ecm', 'G.cue'], 'My Game'), { name: 'My Game.img', kind: 'disc' });
  assert.deepEqual(rules.targetFileName(['g.zip'], 'My Game'), { name: 'My Game.zip', kind: 'file' });

  // "Compress to .zip": the game file keeps its name inside <title>.zip; a .zip is not packed again.
  assert.deepEqual(rules.targetFileName(['g.gba'], 'My Game', true), { name: 'My Game.zip', kind: 'zip', inner: 'My Game.gba' });
  assert.deepEqual(rules.targetFileName(['G.bin', 'G.cue'], 'My Game', true), { name: 'My Game.zip', kind: 'zip', inner: 'My Game.img' });
  assert.deepEqual(rules.targetFileName(['g.zip'], 'My Game', true), { name: 'My Game.zip', kind: 'file' });
  assert.equal(rules.isZipSelection(['Game.ZIP']), true);
  assert.equal(rules.isZipSelection(['Game.gba']), false);

  assert.equal(rules.titleFromFiles(['Crash (Track 2).bin', 'Crash.cue']), 'Crash');
  assert.equal(rules.titleFromFiles(['Spyro.img.ecm', 'Spyro.sub', 'Spyro.ccd']), 'Spyro');
  assert.equal(rules.titleFromFiles(['Tekken 3.bin.ecm']), 'Tekken 3');
});

// ── The server plan for real files ──

const settings = { extensions: ['zip', 'iso'] };
const paths = (...files: string[]): SourceRef[] => files.map((file) => ({ type: 'path', path: file }));
const validation = isAppError(400, 'VALIDATION_ERROR');
const CCD = '[CloneCD]\r\nVersion=3\r\n[Disc]\r\nTocEntries=4\r\n';
const IMAGE = makeImage(['mode1', 'mode1', 'form1', 'form2']);

let counter = 0;
async function folder(files: Record<string, string | Buffer>): Promise<(name: string) => string> {
  const dir = path.join(work, `set-${(counter += 1)}`);
  await fs.mkdir(dir, { recursive: true });
  for (const [name, data] of Object.entries(files)) await fs.writeFile(path.join(dir, name), data);
  return (name) => path.join(dir, name);
}

test('plan: an ECM archive alone becomes an .img of the unpacked size', async () => {
  const f = await folder({ 'Game.img.ecm': encodeEcm(IMAGE) });
  const plan = await planGame(paths(f('Game.img.ecm')), settings, 'My Game');
  assert.equal(plan.mode, 'ecm');
  assert.equal(plan.fileName, 'My Game.img');
  assert.equal(plan.size, IMAGE.length);
  assert.equal(plan.needsImgExtension, true);
  assert.deepEqual(
    plan.parts.map((part) => [part.fileName, part.ecm]),
    [['Game.img', true]],
  );
});

test('plan: .bin.ecm + .cue goes through the BIN/CUE conversion and builds the .img', async () => {
  const cue = 'FILE "Game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n';
  const f = await folder({ 'Game.bin.ecm': encodeEcm(IMAGE), 'Game.cue': cue });
  const plan = await planGame(paths(f('Game.cue'), f('Game.bin.ecm')), settings);
  assert.equal(plan.mode, 'disc');
  assert.equal(plan.fileName, 'Game.img');
  assert.equal(plan.size, IMAGE.length);
  const dest = f('Game.img');
  await buildAtomic(
    plan.parts.map((part) => ({ path: part.input.abs, ecm: part.ecm })),
    dest,
    plan.size,
  );
  assert.deepEqual(await fs.readFile(dest), IMAGE);
});

test('plan: CloneCD keeps only the .img by default; the .ccd/.sub can be kept under the game name', async () => {
  const sub = Buffer.alloc((IMAGE.length / 2352) * 96);
  const f = await folder({ 'Game.ccd': CCD, 'Game.img': IMAGE, 'Game.sub': sub, 'Packed.ccd': CCD, 'Packed.img.ecm': encodeEcm(IMAGE) });
  const plan = await planGame(paths(f('Game.ccd'), f('Game.img'), f('Game.sub')), settings, 'Clone Game');
  assert.equal(plan.mode, 'clonecd');
  assert.equal(plan.fileName, 'Clone Game.img');
  assert.equal(plan.size, IMAGE.length);
  assert.deepEqual(plan.companions, []);

  const kept = await planGame(paths(f('Game.ccd'), f('Game.img'), f('Game.sub')), settings, 'Clone Game', { keepCompanions: true });
  assert.deepEqual(
    kept.companions.map((companion) => companion.fileName),
    ['Clone Game.ccd', 'Clone Game.sub'],
  );
  assert.deepEqual(kept.warnings, []);

  const packed = await planGame(paths(f('Packed.ccd'), f('Packed.img.ecm')), settings);
  assert.equal(packed.fileName, 'Packed.img');
  assert.ok(packed.parts[0]?.ecm);
  assert.equal(packed.size, IMAGE.length);
});

test('plan: incomplete or broken sets give clear errors', async () => {
  const f = await folder({
    'Game.ccd': CCD,
    'Game.sub': Buffer.alloc(96),
    'Fake.ccd': 'hello',
    'Fake.img': IMAGE,
    'Odd.ccd': CCD,
    'Odd.img': Buffer.alloc(1000),
    'Broken.img.ecm': encodeEcm(IMAGE).subarray(0, 500),
  });
  await assert.rejects(
    planGame(paths(f('Game.ccd'), f('Game.sub')), settings),
    (err: unknown) => validation(err) && /Game\.img/.test((err as Error).message),
  );
  await assert.rejects(planGame(paths(f('Fake.ccd'), f('Fake.img')), settings), validation); // no [CloneCD] section
  await assert.rejects(planGame(paths(f('Odd.ccd'), f('Odd.img')), settings), validation); // not whole sectors
  await assert.rejects(
    planGame(paths(f('Broken.img.ecm')), settings),
    (err: unknown) => validation(err) && /ECM/.test((err as Error).message),
  );
});
