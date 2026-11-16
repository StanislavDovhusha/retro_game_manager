import fsp from 'node:fs/promises';
import { t } from '../../i18n/index.ts';
import { ValidationError } from '../../utils/errors.ts';

/**
 * ECM ("Error Code Modeler", Neill Corlett) packs a raw CD image by dropping what can be recomputed: the sync
 * pattern, the mode byte, the EDC checksum and the ECC parity of every data sector. Unpacking rebuilds the sectors
 * byte for byte (the same algorithm as the reference `unecm`) and checks the EDC of the whole result.
 *
 * File layout: the magic `ECM\0`, then records. Each record starts with a variable-length header holding its type
 * (2 bits) and `count - 1`; the end is marked by the count 0xFFFFFFFF, followed by the EDC of the whole unpacked
 * data (4 bytes, little-endian).
 *  - type 0: `count` raw bytes;
 *  - type 1: `count` Mode 1 sectors (3 address bytes + 2048 data bytes each → 2352 bytes);
 *  - type 2: `count` Mode 2 Form 1 sectors without sync/header (4 subheader + 2048 data → 2336 bytes);
 *  - type 3: `count` Mode 2 Form 2 sectors without sync/header (4 subheader + 2324 data → 2336 bytes).
 */

export const ECM_MAGIC = Buffer.from([0x45, 0x43, 0x4d, 0x00]);
const END_MARKER = 0xffffffff;
/** Packed size and unpacked size of a sector of each type. */
const SECTOR: Record<1 | 2 | 3, { packed: number; unpacked: number }> = {
  1: { packed: 0x803, unpacked: 2352 },
  2: { packed: 0x804, unpacked: 2336 },
  3: { packed: 0x918, unpacked: 2336 },
};
/** Output is handed on in chunks of about this size (never the whole image at once). */
const OUT_CHUNK = 1024 * 1024;

// ── EDC / ECC ────────────────────────────────────────────────────────────

const ECC_F = new Uint8Array(256);
const ECC_B = new Uint8Array(256);
const EDC_LUT = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  const j = ((i << 1) ^ (i & 0x80 ? 0x11d : 0)) & 0xff;
  ECC_F[i] = j;
  ECC_B[i ^ j] = i;
  let edc = i;
  for (let k = 0; k < 8; k += 1) edc = (edc >>> 1) ^ (edc & 1 ? 0xd8018001 : 0);
  EDC_LUT[i] = edc >>> 0;
}

/** Continues the CD-ROM EDC (a CRC-32 with the polynomial 0xD8018001, no inversion) over `buf[start, end)`. */
export function edcUpdate(edc: number, buf: Uint8Array, start = 0, end = buf.length): number {
  let crc = edc;
  for (let i = start; i < end; i += 1) crc = (crc >>> 8) ^ (EDC_LUT[(crc ^ (buf[i] ?? 0)) & 0xff] ?? 0);
  return crc >>> 0;
}

/** Reed-Solomon parity of one ECC block (P or Q) over the sector bytes from offset 0x0C. */
function eccBlock(sector: Uint8Array, majorCount: number, minorCount: number, majorMult: number, minorInc: number, dest: number): void {
  const size = majorCount * minorCount;
  for (let major = 0; major < majorCount; major += 1) {
    let index = (major >> 1) * majorMult + (major & 1);
    let a = 0;
    let b = 0;
    for (let minor = 0; minor < minorCount; minor += 1) {
      const value = sector[0x0c + index] ?? 0;
      index += minorInc;
      if (index >= size) index -= size;
      a ^= value;
      b ^= value;
      a = ECC_F[a] ?? 0;
    }
    a = ECC_B[(ECC_F[a] ?? 0) ^ b] ?? 0;
    sector[dest + major] = a;
    sector[dest + major + majorCount] = a ^ b;
  }
}

/** Writes the P and Q parity; Mode 2 computes it with the address bytes taken as zero. */
function eccGenerate(sector: Uint8Array, zeroAddress: boolean): void {
  const address = sector.slice(0x0c, 0x10);
  if (zeroAddress) sector.fill(0, 0x0c, 0x10);
  eccBlock(sector, 86, 24, 2, 86, 0x81c); // P
  eccBlock(sector, 52, 43, 86, 88, 0x8c8); // Q
  if (zeroAddress) sector.set(address, 0x0c);
}

function writeEdc(sector: Uint8Array, start: number, length: number, dest: number): void {
  const edc = edcUpdate(0, sector, start, start + length);
  sector[dest] = edc & 0xff;
  sector[dest + 1] = (edc >>> 8) & 0xff;
  sector[dest + 2] = (edc >>> 16) & 0xff;
  sector[dest + 3] = (edc >>> 24) & 0xff;
}

/** Fills in the EDC and ECC of a full 2352-byte sector of the given ECM type (1, 2 or 3). */
export function eccEdcGenerate(sector: Uint8Array, type: 1 | 2 | 3): void {
  if (type === 1) {
    writeEdc(sector, 0x00, 0x810, 0x810);
    sector.fill(0, 0x814, 0x81c);
    eccGenerate(sector, false);
  } else if (type === 2) {
    writeEdc(sector, 0x10, 0x808, 0x818);
    eccGenerate(sector, true);
  } else {
    writeEdc(sector, 0x10, 0x91c, 0x92c);
  }
}

// ── Errors and record headers ────────────────────────────────────────────────

const damaged = (name: string, reason: string): ValidationError =>
  new ValidationError(t('The ECM archive “{name}” is damaged: {reason}', { name, reason }));
const truncated = (name: string): ValidationError => damaged(name, t('the file ends too early'));
const badRecord = (name: string): ValidationError => damaged(name, t('invalid record header'));

/** A record header: the type and the number of items, or `null` for the end marker. */
type RecordHeader = { type: 0 | 1 | 2 | 3; count: number } | null;

async function readHeader(nextByte: () => Promise<number>, name: string): Promise<RecordHeader> {
  let c = await nextByte();
  const type = (c & 3) as 0 | 1 | 2 | 3;
  let num = (c >> 2) & 0x1f;
  let bits = 5;
  while (c & 0x80) {
    if (bits > 26) throw badRecord(name); // more than 32 bits
    c = await nextByte();
    num += (c & 0x7f) * 2 ** bits;
    bits += 7;
  }
  if (num === END_MARKER) return null;
  if (num + 1 >= 0x80000000) throw badRecord(name);
  return { type, count: num + 1 };
}

// ── Scanning (sizes only) ─────────────────────────────────────────────────

/** Reads a file through a small window at arbitrary positions (record headers are a few bytes far apart). */
class WindowReader {
  private buf = Buffer.alloc(64 * 1024);
  private start = 0;
  private length = 0;
  pos = 0;
  private readonly handle: fsp.FileHandle;

  constructor(handle: fsp.FileHandle) {
    this.handle = handle;
  }

  async byte(): Promise<number> {
    if (this.pos < this.start || this.pos >= this.start + this.length) {
      const { bytesRead } = await this.handle.read(this.buf, 0, this.buf.length, this.pos);
      this.start = this.pos;
      this.length = bytesRead;
      if (bytesRead === 0) throw new RangeError('eof');
    }
    const value = this.buf[this.pos - this.start] ?? 0;
    this.pos += 1;
    return value;
  }
}

export interface EcmInfo {
  /** Size of the unpacked data. */
  size: number;
}

/**
 * Checks the structure of an ECM archive without unpacking it and returns the size of the unpacked data. Only the
 * record headers are read, so it is fast even for a large image; the sector checksums are verified while unpacking.
 */
export async function scanEcm(abs: string, name: string): Promise<EcmInfo> {
  const handle = await fsp.open(abs, 'r');
  try {
    const { size: fileSize } = await handle.stat();
    const reader = new WindowReader(handle);
    const magic = Buffer.alloc(4);
    const { bytesRead } = await handle.read(magic, 0, 4, 0);
    if (bytesRead < 4 || !magic.equals(ECM_MAGIC)) throw damaged(name, t('this is not an ECM file (no ECM header)'));
    reader.pos = 4;
    const next = (): Promise<number> =>
      reader.byte().catch((err: unknown) => {
        throw err instanceof RangeError ? truncated(name) : err;
      });
    let size = 0;
    for (;;) {
      const header = await readHeader(next, name);
      if (!header) break;
      if (header.type === 0) {
        reader.pos += header.count;
        size += header.count;
      } else {
        reader.pos += header.count * SECTOR[header.type].packed;
        size += header.count * SECTOR[header.type].unpacked;
      }
      if (reader.pos > fileSize) throw truncated(name);
    }
    if (reader.pos + 4 > fileSize) throw truncated(name);
    return { size };
  } finally {
    await handle.close();
  }
}

// ── Unpacking (streaming) ────────────────────────────────────────────────

/** Pulls exact amounts of bytes out of a stream of chunks. */
class ChunkReader {
  private chunk: Buffer = Buffer.alloc(0);
  private offset = 0;
  /** Bytes taken from the input so far. */
  consumed = 0;
  private readonly iterator: AsyncIterator<unknown>;
  private readonly name: string;

  constructor(iterator: AsyncIterator<unknown>, name: string) {
    this.iterator = iterator;
    this.name = name;
  }

  private async fill(): Promise<void> {
    for (;;) {
      const next = await this.iterator.next();
      if (next.done) throw truncated(this.name);
      const value: unknown = next.value;
      this.chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
      this.offset = 0;
      if (this.chunk.length) return;
    }
  }

  async byte(): Promise<number> {
    if (this.offset >= this.chunk.length) await this.fill();
    this.consumed += 1;
    return this.chunk[this.offset++] ?? 0;
  }

  /** Copies exactly `length` bytes into `target` at `at`. */
  async into(target: Buffer, at: number, length: number): Promise<void> {
    let pos = at;
    let left = length;
    while (left > 0) {
      if (this.offset >= this.chunk.length) await this.fill();
      const n = Math.min(left, this.chunk.length - this.offset);
      this.chunk.copy(target, pos, this.offset, this.offset + n);
      this.offset += n;
      pos += n;
      left -= n;
    }
    this.consumed += length;
  }
}

/**
 * A stream stage (for `stream.pipeline`) that unpacks an ECM archive. It reads the archive chunk by chunk and hands
 * on the unpacked data in ~1 MB chunks, so memory use does not depend on the size of the image. `onInput` reports
 * how many bytes of the archive have been processed. A damaged archive throws a `ValidationError`.
 */
export function ecmDecoder(name: string, onInput?: (consumed: number) => void) {
  return async function* decode(source: AsyncIterable<unknown>): AsyncGenerator<Buffer> {
    const reader = new ChunkReader(source[Symbol.asyncIterator](), name);
    const head = Buffer.alloc(4);
    await reader.into(head, 0, 4).catch(() => undefined);
    if (!head.equals(ECM_MAGIC)) throw damaged(name, t('this is not an ECM file (no ECM header)'));

    const sector = Buffer.alloc(2352);
    let out = Buffer.allocUnsafe(OUT_CHUNK);
    let used = 0;
    let edc = 0;
    const next = (): Promise<number> => reader.byte();

    for (;;) {
      const header = await readHeader(next, name);
      if (!header) break;
      const { type } = header;
      let left = header.count;
      while (left > 0) {
        if (type === 0) {
          const n = Math.min(left, out.length - used);
          await reader.into(out, used, n);
          edc = edcUpdate(edc, out, used, used + n);
          used += n;
          left -= n;
        } else {
          sector.fill(0);
          sector.fill(0xff, 1, 11); // sync pattern
          let from = 0;
          if (type === 1) {
            sector[0x0f] = 0x01;
            await reader.into(sector, 0x0c, 3);
            await reader.into(sector, 0x10, 0x800);
          } else {
            sector[0x0f] = 0x02;
            await reader.into(sector, 0x14, SECTOR[type].packed);
            sector.copy(sector, 0x10, 0x14, 0x18); // the subheader is stored twice
            from = 0x10;
          }
          eccEdcGenerate(sector, type);
          edc = edcUpdate(edc, sector, from, 2352);
          used += sector.copy(out, used, from, 2352);
          left -= 1;
        }
        if (out.length - used < 2352) {
          yield out.subarray(0, used);
          onInput?.(reader.consumed);
          out = Buffer.allocUnsafe(OUT_CHUNK);
          used = 0;
        }
      }
    }
    const tail = Buffer.alloc(4);
    await reader.into(tail, 0, 4);
    if (tail.readUInt32LE(0) !== edc) throw damaged(name, t('the checksum of the unpacked data does not match'));
    if (used) yield out.subarray(0, used);
    onInput?.(reader.consumed);
  };
}
