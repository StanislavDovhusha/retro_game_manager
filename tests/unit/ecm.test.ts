import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import { buildAtomic } from '../../src/services/fs/copy.ts';
import { ecmDecoder, eccEdcGenerate, edcUpdate, scanEcm } from '../../src/services/fs/ecm.ts';
import { encodeEcm, makeImage, makeSector, RAW_SECTOR } from '../helpers/ecm.ts';
import { exists, isAppError } from '../helpers/fs.ts';

const damaged = isAppError(400, 'VALIDATION_ERROR');

let counter = 0;
const folder = async (): Promise<string> => {
  const dir = path.join(work, `ecm-${(counter += 1)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

/** Unpacks an archive held in memory, fed in chunks of the given size. */
async function decode(archive: Buffer, chunk = 64 * 1024): Promise<Buffer> {
  const pieces: Buffer[] = [];
  for (let i = 0; i < archive.length; i += chunk) pieces.push(archive.subarray(i, i + chunk));
  const out: Buffer[] = [];
  await pipeline(
    Readable.from(pieces),
    ecmDecoder('test.ecm'),
    new Writable({
      write(data: Buffer, _encoding, callback) {
        out.push(Buffer.from(data));
        callback();
      },
    }),
  );
  return Buffer.concat(out);
}

// ── An independent check of the EDC / ECC math (not the lookup tables of the decoder) ──

/** Multiplication in GF(2^8) with the CD-ROM polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D). */
function gfMul(a: number, b: number): number {
  let result = 0;
  let x = a;
  for (let y = b; y; y >>= 1) {
    if (y & 1) result ^= x;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
  return result & 0xff;
}

/** A Reed-Solomon codeword (data + 2 parity bytes) has both syndromes equal to zero. */
function syndromesZero(codeword: number[]): boolean {
  let s0 = 0;
  let s1 = 0;
  for (const value of codeword) {
    s0 ^= value;
    s1 = gfMul(s1, 2) ^ value;
  }
  return s0 === 0 && s1 === 0;
}

/** Checks the P (86 columns × 26) and Q (52 diagonals × 45) codewords of a sector with valid ECC. */
function eccValid(sector: Buffer): boolean {
  const src = sector.subarray(0x0c);
  for (let major = 0; major < 86; major += 1) {
    const word = Array.from({ length: 24 }, (_, minor) => src[major + 86 * minor] ?? 0);
    word.push(sector[0x81c + major] ?? 0, sector[0x81c + 86 + major] ?? 0);
    if (!syndromesZero(word)) return false;
  }
  for (let major = 0; major < 52; major += 1) {
    let index = (major >> 1) * 86 + (major & 1);
    const word: number[] = [];
    for (let minor = 0; minor < 43; minor += 1) {
      word.push(src[index] ?? 0);
      index = (index + 88) % 2236;
    }
    word.push(sector[0x8c8 + major] ?? 0, sector[0x8c8 + 52 + major] ?? 0);
    if (!syndromesZero(word)) return false;
  }
  return true;
}

test('EDC is the CD-ROM CRC-32 (polynomial 0xD8018001), and it can be continued chunk by chunk', () => {
  const data = makeSector('raw', 7);
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xd8018001 : crc >>> 1;
  }
  assert.equal(edcUpdate(0, data), crc >>> 0);
  assert.equal(edcUpdate(edcUpdate(0, data, 0, 1000), data, 1000), crc >>> 0);
});

test('a regenerated Mode 1 sector has valid Reed-Solomon P/Q parity and a matching EDC', () => {
  const sector = makeSector('mode1', 16);
  assert.ok(eccValid(sector));
  assert.equal(sector.readUInt32LE(0x810), edcUpdate(0, sector, 0, 0x810));
  sector[0x100] = (sector[0x100] ?? 0) ^ 1;
  assert.ok(!eccValid(sector), 'a changed byte breaks the parity');
});

test('Mode 2 Form 1 parity is computed with a zero address; Form 2 has only an EDC', () => {
  const form1 = makeSector('form1', 20);
  const zeroAddress = Buffer.from(form1);
  zeroAddress.fill(0, 0x0c, 0x10);
  assert.ok(eccValid(zeroAddress));
  assert.equal(form1.readUInt32LE(0x818), edcUpdate(0, form1, 0x10, 0x818));
  const form2 = makeSector('form2', 21);
  assert.equal(form2.readUInt32LE(0x92c), edcUpdate(0, form2, 0x10, 0x92c));
  const again = Buffer.from(form2);
  eccEdcGenerate(again, 3);
  assert.deepEqual(again, form2);
});

// ── Unpacking ──

const MIXED = makeImage(['raw', 'mode1', 'mode1', 'form1', 'form2', 'form1', 'raw', 'mode1']);

test('an archive with every record type is unpacked byte for byte and is smaller than the image', async () => {
  const archive = encodeEcm(MIXED);
  assert.ok(archive.length < MIXED.length);
  assert.deepEqual(await decode(archive), MIXED);
});

test('unpacking does not depend on how the input is split into chunks', async () => {
  const archive = encodeEcm(MIXED);
  for (const chunk of [5, 2051, 4096]) assert.deepEqual(await decode(archive, chunk), MIXED, `chunks of ${chunk}`);
});

test('a tail that is not a whole sector is kept as raw bytes', async () => {
  const raw = Buffer.concat([makeImage(['mode1', 'mode1']), Buffer.from('tail bytes')]);
  assert.deepEqual(await decode(encodeEcm(raw)), raw);
});

test('scanEcm gives the unpacked size from the record headers alone', async () => {
  const dir = await folder();
  const file = path.join(dir, 'Game.img.ecm');
  await fs.writeFile(file, encodeEcm(MIXED));
  assert.deepEqual(await scanEcm(file, 'Game.img.ecm'), { size: MIXED.length });
});

test('damaged archives are refused: no header, truncated, wrong checksum', async () => {
  const archive = encodeEcm(MIXED);
  await assert.rejects(decode(Buffer.from('NOPE plain data')), damaged);
  await assert.rejects(decode(archive.subarray(0, archive.length - 100)), damaged);
  const corrupt = Buffer.from(archive);
  corrupt[200] = (corrupt[200] ?? 0) ^ 0xff; // inside the first raw sector: the EDC of the result no longer matches
  await assert.rejects(decode(corrupt), (err: unknown) => damaged(err) && /checksum/.test(String((err as Error).message)));

  const dir = await folder();
  const short = path.join(dir, 'short.ecm');
  await fs.writeFile(short, archive.subarray(0, 3000));
  await assert.rejects(scanEcm(short, 'short.ecm'), damaged);
  const fake = path.join(dir, 'fake.ecm');
  await fs.writeFile(fake, 'not an ecm');
  await assert.rejects(scanEcm(fake, 'fake.ecm'), damaged);
});

test('buildAtomic unpacks a large archive as a stream, reports progress and leaves no temporary files', async () => {
  const dir = await folder();
  // ~2.4 MB: more than one output chunk of the decoder.
  const raw = makeImage(Array.from({ length: 1024 }, (_, i) => (i % 3 === 0 ? 'mode1' : i % 3 === 1 ? 'form1' : 'form2')));
  const src = path.join(dir, 'Big.bin.ecm');
  await fs.writeFile(src, encodeEcm(raw));
  const dest = path.join(dir, 'Big.img');
  const seen: number[] = [];
  await buildAtomic([{ path: src, ecm: true }], dest, raw.length, (written) => seen.push(written));
  assert.deepEqual(await fs.readFile(dest), raw);
  assert.ok(seen.length > 1, 'progress is reported more than once');
  assert.equal(seen.at(-1), raw.length);
  assert.deepEqual((await fs.readdir(dir)).sort(), ['Big.bin.ecm', 'Big.img']);
});

test('buildAtomic mixes plain files and archives, and removes the partial file when an archive is damaged', async () => {
  const dir = await folder();
  const a = makeImage(['mode1', 'mode1']);
  const b = makeImage(['form1', 'form2']);
  await fs.writeFile(path.join(dir, 'a.bin'), a);
  await fs.writeFile(path.join(dir, 'b.bin.ecm'), encodeEcm(b));
  const dest = path.join(dir, 'out.img');
  await buildAtomic([{ path: path.join(dir, 'a.bin') }, { path: path.join(dir, 'b.bin.ecm'), ecm: true }], dest, a.length + b.length);
  assert.deepEqual(await fs.readFile(dest), Buffer.concat([a, b]));

  const broken = encodeEcm(b);
  broken[broken.length - 1] = (broken[broken.length - 1] ?? 0) ^ 1; // the stored checksum
  await fs.writeFile(path.join(dir, 'c.bin.ecm'), broken);
  const failed = path.join(dir, 'failed.img');
  await assert.rejects(buildAtomic([{ path: path.join(dir, 'c.bin.ecm'), ecm: true }], failed, b.length), damaged);
  assert.ok(!(await exists(failed)));
  assert.deepEqual(
    (await fs.readdir(dir)).filter((name) => name.includes('.part')),
    [],
  );
  assert.equal(RAW_SECTOR, 2352);
});
