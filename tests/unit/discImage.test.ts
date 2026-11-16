import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { planGame } from '../../src/services/addGameService.ts';
import { concatAtomic, copyAtomic } from '../../src/services/fs/copy.ts';
import { pairBins, parseCue } from '../../src/services/fs/cue.ts';
import type { SourceRef } from '../../src/models/index.ts';
import { exists, isAppError, write } from '../helpers/fs.ts';

const SECTOR = 2352;
const CUE = 'FILE "Game (Track 1).bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n';
const settings = { extensions: ['iso', 'cue'] };
const paths = (...files: string[]): SourceRef[] => files.map((file) => ({ type: 'path', path: file }));
const validation = isAppError(400, 'VALIDATION_ERROR');

let counter = 0;
const folder = async (): Promise<string> => {
  const dir = path.join(work, `disc-${(counter += 1)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

test('parseCue reads files, sector size and track count', () => {
  const cue = parseCue(CUE);
  assert.equal(cue.files.length, 1);
  assert.equal(cue.files[0]?.sector, SECTOR);
  assert.equal(cue.tracks, 1);
  assert.equal(cue.hasAudio, false);
});

test('parseCue rejects text that is not a cue sheet and non-BINARY files', () => {
  assert.throws(() => parseCue('hello'), validation);
  assert.throws(() => parseCue('FILE "a.wav" WAVE\nTRACK 01 AUDIO'), validation);
});

test('pairBins orders the .bin files as the .cue lists them and reports missing ones', () => {
  const refs = [{ name: 'a.bin' }, { name: 'b.bin' }];
  assert.deepEqual(
    pairBins(refs, [{ fileName: 'b.bin' }, { fileName: 'a.bin' }]).map((bin) => bin.fileName),
    ['a.bin', 'b.bin'],
  );
  assert.throws(() => pairBins(refs, [{ fileName: 'a.bin' }]), validation);
});

test('.bin + .cue are merged into one .img (streamed, byte for byte, no temporary leftovers)', async () => {
  const dir = await folder();
  const bin = path.join(dir, 'Game (Track 1).bin');
  const cue = path.join(dir, 'Game.cue');
  const payload = Buffer.concat([Buffer.alloc(SECTOR * 2, 7), Buffer.alloc(SECTOR * 2, 9)]);
  await fs.writeFile(bin, payload);
  await fs.writeFile(cue, CUE);

  const plan = await planGame(paths(bin, cue), settings);
  assert.equal(plan.mode, 'disc');
  assert.match(plan.fileName, /\.img$/);
  assert.equal(plan.needsImgExtension, true); // "img" is not among the allowed extensions: the UI offers to add it
  assert.equal(plan.size, payload.length);

  const dest = path.join(dir, plan.fileName);
  assert.ok(plan.mode === 'disc');
  await concatAtomic(
    plan.parts.map((part) => part.input.abs),
    dest,
    plan.size,
  );
  assert.deepEqual(await fs.readFile(dest), payload);
  assert.deepEqual(
    (await fs.readdir(dir)).filter((name) => name.includes('.part') || name.includes('.tmp')),
    [],
  );
});

test('a multi-file .cue is concatenated in the order of the .cue', async () => {
  const dir = await folder();
  const a = path.join(dir, 'a.bin');
  const b = path.join(dir, 'b.bin');
  const cue = path.join(dir, 'g.cue');
  await fs.writeFile(a, Buffer.alloc(SECTOR, 1));
  await fs.writeFile(b, Buffer.alloc(SECTOR, 2));
  await fs.writeFile(
    cue,
    'FILE "a.bin" BINARY\n TRACK 01 MODE2/2352\n  INDEX 01 00:00:00\nFILE "b.bin" BINARY\n TRACK 02 MODE2/2352\n  INDEX 01 00:00:00\n',
  );
  const plan = await planGame(paths(b, a, cue), settings); // the order of selection does not matter
  assert.ok(plan.mode === 'disc');
  assert.deepEqual(
    plan.parts.map((part) => part.fileName),
    ['a.bin', 'b.bin'],
  );
  assert.equal(plan.warnings.length, 1); // track boundaries are lost
  const dest = path.join(dir, plan.fileName);
  await concatAtomic(
    plan.parts.map((part) => part.input.abs),
    dest,
    plan.size,
  );
  const out = await fs.readFile(dest);
  assert.equal(out[0], 1);
  assert.equal(out[SECTOR], 2);
});

test('concatAtomic removes the temporary file and creates no target when the size does not match', async () => {
  const dir = await folder();
  const src = path.join(dir, 'a.bin');
  await fs.writeFile(src, Buffer.alloc(100));
  const dest = path.join(dir, 'out.img');
  await assert.rejects(concatAtomic([src], dest, 999), (err: unknown) => err instanceof Error);
  assert.ok(!(await exists(dest)));
  assert.deepEqual(await fs.readdir(dir), ['a.bin']);
});

test('copyAtomic copies as a stream, verifies the size and refuses protected folders', async () => {
  const dir = await folder();
  const src = path.join(dir, 'big.bin');
  await fs.writeFile(src, Buffer.alloc(3 * 1024 * 1024, 5)); // larger than one stream chunk
  const dest = path.join(dir, 'copy.bin');
  await copyAtomic(src, dest, 3 * 1024 * 1024);
  assert.equal((await fs.stat(dest)).size, 3 * 1024 * 1024);
  await assert.rejects(copyAtomic(src, path.join(dir, 'x.bin'), 5), (err: unknown) => err instanceof Error);
  assert.ok(!(await exists(path.join(dir, 'x.bin'))));
  await assert.rejects(copyAtomic(src, path.join(dir, 'rootfs', 'x.bin'), 1), isAppError(403, 'FORBIDDEN'));
  await assert.rejects(copyAtomic(src, path.join(dir, 'cubegm', 'x.bin'), 1), isAppError(403, 'FORBIDDEN'));
});

test('planGame rejects invalid sets', async () => {
  const dir = await folder();
  const bin = path.join(dir, 'a.bin');
  const txt = path.join(dir, 'a.txt');
  await write(bin, Buffer.alloc(100));
  await write(txt, 'x');
  await assert.rejects(planGame([], settings), isAppError(400));
  await assert.rejects(planGame(paths(bin, txt), settings), validation); // only .bin and .cue together
  await assert.rejects(planGame(paths(bin, bin), settings), validation); // bins without a cue
  await assert.rejects(planGame(paths(bin), settings), validation); // a single .bin is not an allowed extension
});

test('a .cue whose .bin is not a multiple of the sector size is rejected', async () => {
  const dir = await folder();
  const bin = path.join(dir, 'Game (Track 1).bin');
  const cue = path.join(dir, 'Game.cue');
  await fs.writeFile(bin, Buffer.alloc(SECTOR + 1));
  await fs.writeFile(cue, CUE);
  await assert.rejects(planGame(paths(bin, cue), settings), validation);
});

test('the file name comes from the title, the extension from the source', async () => {
  const dir = await folder();
  const iso = path.join(dir, 'weird_dump_v2.ISO');
  await fs.writeFile(iso, Buffer.alloc(64));
  const only = { extensions: ['iso'] };
  assert.equal((await planGame(paths(iso), only, 'The Legend: of Zelda')).fileName, 'The Legend of Zelda.ISO');
  assert.equal((await planGame(paths(iso), only)).fileName, 'weird_dump_v2.ISO'); // preview without a title
  await assert.rejects(planGame(paths(iso), only, '???'), isAppError(400));
});

test('a game from outside the allowed extensions is refused', async () => {
  const dir = await folder();
  const exe = path.join(dir, 'virus.exe');
  await fs.writeFile(exe, 'MZ');
  await assert.rejects(planGame(paths(exe), settings), isAppError(400));
});
