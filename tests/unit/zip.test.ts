import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { dosDateTime, zipAtomic, zipSizeBound } from '../../src/services/fs/zip.ts';
import { encodeEcm, makeImage } from '../helpers/ecm.ts';
import { write } from '../helpers/fs.ts';
import { readSingleZip } from '../helpers/zip.ts';

let counter = 0;
const dir = (): string => path.join(work, `zip-${(counter += 1)}`);
const leftovers = async (folder: string): Promise<string[]> => (await fs.readdir(folder)).filter((name) => name.startsWith('.'));

test('one file is packed into a plain ZIP: no data descriptor, sizes and CRC in the local header', async () => {
  const folder = dir();
  const data = Buffer.concat([crypto.randomBytes(300_000), Buffer.alloc(700_000, 'GAME ')]);
  await write(path.join(folder, 'source.gba'), data);
  const dest = path.join(folder, 'Mario.zip');
  const progress: number[] = [];
  await zipAtomic([{ path: path.join(folder, 'source.gba') }], 'Mario.gba', dest, data.length, (written) => progress.push(written));

  const archive = await fs.readFile(dest);
  const entry = readSingleZip(archive);
  assert.equal(entry.name, 'Mario.gba');
  assert.equal(entry.method, 8, 'deflate');
  assert.equal(entry.flags & 0x0008, 0, 'no data descriptor');
  assert.equal(entry.flags & 0x0800, 0, 'an ASCII name is not marked as UTF-8');
  assert.deepEqual(entry.data, data);
  assert.ok(entry.compressed < data.length, 'the repeated data is compressed');
  assert.ok(archive.length <= zipSizeBound(data.length, 'Mario.gba'));
  assert.equal(progress.at(-1), data.length);
  assert.deepEqual(await leftovers(folder), [], 'no temporary file is left');
});

test('a non-ASCII name is stored as UTF-8; random data stays within the size bound', async () => {
  const folder = dir();
  const data = crypto.randomBytes(200_000);
  await write(path.join(folder, 'source.bin'), data);
  const dest = path.join(folder, 'Игра.zip');
  await zipAtomic([{ path: path.join(folder, 'source.bin') }], 'Игра.gba', dest, data.length);
  const archive = await fs.readFile(dest);
  const entry = readSingleZip(archive);
  assert.equal(entry.name, 'Игра.gba');
  assert.equal(entry.flags & 0x0800, 0x0800);
  assert.deepEqual(entry.data, data);
  assert.ok(archive.length <= zipSizeBound(data.length, 'Игра.gba'), `${archive.length} > bound`);
});

test('several sources (an ECM archive among them) become one file inside the archive', async () => {
  const folder = dir();
  const image = makeImage(['mode1', 'form1', 'form2', 'mode1']);
  const tail = Buffer.alloc(2352 * 2, 7);
  await write(path.join(folder, 'a.bin.ecm'), encodeEcm(image));
  await write(path.join(folder, 'b.bin'), tail);
  const dest = path.join(folder, 'Disc.zip');
  await zipAtomic(
    [{ path: path.join(folder, 'a.bin.ecm'), ecm: true }, { path: path.join(folder, 'b.bin') }],
    'Disc.img',
    dest,
    image.length + tail.length,
  );
  const entry = readSingleZip(await fs.readFile(dest));
  assert.equal(entry.name, 'Disc.img');
  assert.deepEqual(entry.data, Buffer.concat([image, tail]));
});

test('a wrong size or a missing source leaves nothing behind', async () => {
  const folder = dir();
  await write(path.join(folder, 'source.gba'), 'rom data');
  const dest = path.join(folder, 'Game.zip');
  await assert.rejects(zipAtomic([{ path: path.join(folder, 'source.gba') }], 'Game.gba', dest, 999, undefined));
  await assert.rejects(zipAtomic([{ path: path.join(folder, 'missing.gba') }], 'Game.gba', dest, 8));
  assert.deepEqual((await fs.readdir(folder)).sort(), ['source.gba']);
  await assert.rejects(zipAtomic([{ path: path.join(folder, 'source.gba') }], 'Game.gba', dest, 2 ** 32), /4 GB/);
});

test('a temporary file that is already there is neither overwritten nor removed', async () => {
  const folder = dir();
  const part = path.join(folder, `.Game.zip.part-${process.pid}`);
  await write(path.join(folder, 'source.gba'), 'new');
  await write(part, 'someone else');
  await assert.rejects(zipAtomic([{ path: path.join(folder, 'source.gba') }], 'Game.gba', path.join(folder, 'Game.zip'), 3));
  assert.equal(await fs.readFile(part, 'utf8'), 'someone else');
  assert.ok(!(await fs.readdir(folder)).includes('Game.zip'));
});

test('MS-DOS date and time', () => {
  assert.deepEqual(dosDateTime(new Date(2026, 10, 13, 15, 42, 31)), {
    time: (15 << 11) | (42 << 5) | 15,
    date: ((2026 - 1980) << 9) | (11 << 5) | 13,
  });
  assert.equal(dosDateTime(new Date(1975, 0, 1)).date >> 9, 0, 'years before 1980 are clamped');
});
