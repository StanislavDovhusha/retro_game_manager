import fsp from 'node:fs/promises';
import zlib from 'node:zlib';
import { t } from '../../i18n/index.ts';
import { assertNotProtected } from '../../utils/paths.ts';
import { type BuildProgress, type BuildSource, tmpName, writeSources } from './copy.ts';

/**
 * A ZIP archive with one deflated file, written as a stream (the game is never held in memory as a whole).
 *
 * The local header is written first with empty CRC and sizes, the compressed data follows, and when the data is
 * written the header is filled in place. The result is a plain ZIP without data descriptors and without ZIP64, which
 * the simplest unzip code of an emulator reads: every value the reader needs is in the local header too.
 */

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
/** 2.0: deflate. */
const VERSION = 20;
const DEFLATE = 8;
/** General purpose flag 11: the file name is UTF-8. */
const UTF8_NAME = 0x0800;
/** 0xFFFFFFFF in a size or offset means ZIP64, which is not written: every value must stay below it. */
export const ZIP_MAX_BYTES = 0xffff_fffe;

const LOCAL_SIZE = 30;
const CENTRAL_SIZE = 46;
const END_SIZE = 22;

/** Date and time in the MS-DOS format of ZIP (local time, two-second precision, years from 1980). */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

interface Entry {
  name: Buffer;
  flags: number;
  time: number;
  date: number;
  crc: number;
  compressed: number;
  size: number;
}

function localHeader(entry: Entry): Buffer {
  const buf = Buffer.alloc(LOCAL_SIZE + entry.name.length);
  buf.writeUInt32LE(LOCAL_HEADER, 0);
  buf.writeUInt16LE(VERSION, 4);
  buf.writeUInt16LE(entry.flags, 6);
  buf.writeUInt16LE(DEFLATE, 8);
  buf.writeUInt16LE(entry.time, 10);
  buf.writeUInt16LE(entry.date, 12);
  buf.writeUInt32LE(entry.crc, 14);
  buf.writeUInt32LE(entry.compressed, 18);
  buf.writeUInt32LE(entry.size, 22);
  buf.writeUInt16LE(entry.name.length, 26);
  buf.writeUInt16LE(0, 28); // no extra field
  entry.name.copy(buf, LOCAL_SIZE);
  return buf;
}

function centralDirectory(entry: Entry, centralOffset: number): Buffer {
  const buf = Buffer.alloc(CENTRAL_SIZE + entry.name.length + END_SIZE);
  buf.writeUInt32LE(CENTRAL_HEADER, 0);
  buf.writeUInt16LE(VERSION, 4); // made by: MS-DOS / FAT, version 2.0
  buf.writeUInt16LE(VERSION, 6);
  buf.writeUInt16LE(entry.flags, 8);
  buf.writeUInt16LE(DEFLATE, 10);
  buf.writeUInt16LE(entry.time, 12);
  buf.writeUInt16LE(entry.date, 14);
  buf.writeUInt32LE(entry.crc, 16);
  buf.writeUInt32LE(entry.compressed, 20);
  buf.writeUInt32LE(entry.size, 24);
  buf.writeUInt16LE(entry.name.length, 28);
  // extra field, comment, disk number, internal and external attributes, offset of the local header: all 0
  entry.name.copy(buf, CENTRAL_SIZE);

  const end = CENTRAL_SIZE + entry.name.length;
  buf.writeUInt32LE(END_OF_CENTRAL, end);
  buf.writeUInt16LE(1, end + 8); // entries on this disk
  buf.writeUInt16LE(1, end + 10); // entries in total
  buf.writeUInt32LE(CENTRAL_SIZE + entry.name.length, end + 12);
  buf.writeUInt32LE(centralOffset, end + 16);
  return buf;
}

/**
 * The most a ZIP of `size` bytes of data under the name `entryName` can take: the deflate worst case (incompressible
 * data is stored in blocks, a few bytes per block) plus the headers. Used to check the free space in advance.
 */
export function zipSizeBound(size: number, entryName: string): number {
  const name = Buffer.byteLength(entryName, 'utf8');
  // zlib's deflateBound() for raw deflate, rounded up.
  const deflated = size + Math.ceil(size / 4096) + Math.ceil(size / 16_384) + Math.ceil(size / 33_554_432) + 16;
  return deflated + LOCAL_SIZE + CENTRAL_SIZE + 2 * name + END_SIZE;
}

/**
 * Builds `dest` as a ZIP archive holding one file `entryName`, made of the sources in the given order (plain files as
 * they are, ECM archives unpacked on the fly; see `writeSources`). Written through a hidden temporary file that gets
 * its real name only when the archive is complete; the amount of data must be exactly `expectedSize`.
 */
export async function zipAtomic(
  sources: BuildSource[],
  entryName: string,
  dest: string,
  expectedSize: number,
  onProgress?: BuildProgress,
): Promise<void> {
  assertNotProtected(dest);
  if (expectedSize > ZIP_MAX_BYTES) {
    throw new Error(t('The game file is larger than 4 GB and cannot be compressed to .zip'));
  }
  const name = Buffer.from(entryName, 'utf8');
  const flags = /^[\x20-\x7e]*$/.test(entryName) ? 0 : UTF8_NAME;
  const entry: Entry = { name, flags, ...dosDateTime(new Date()), crc: 0, compressed: 0, size: 0 };
  const dataStart = LOCAL_SIZE + name.length;

  const tmp = tmpName(dest);
  const handle = await fsp.open(tmp, 'wx');
  let closed = false;
  try {
    await handle.write(localHeader(entry), 0, dataStart, 0);

    const deflate = zlib.createDeflateRaw({ level: zlib.constants.Z_DEFAULT_COMPRESSION });
    // The compressed data goes right after the header. Reading the deflate stream chunk by chunk keeps the
    // backpressure; when a write fails, the loop ends, the deflate stream is destroyed and writeSources fails as well.
    const deflated = (async (): Promise<number> => {
      let position = dataStart;
      for await (const chunk of deflate as AsyncIterable<Buffer>) {
        await handle.write(chunk, 0, chunk.length, position);
        position += chunk.length;
      }
      return position - dataStart;
    })();
    deflated.catch(() => undefined); // awaited below

    let crc = 0;
    try {
      entry.size = await writeSources(sources, deflate, (chunk, written, index) => {
        crc = zlib.crc32(chunk, crc);
        onProgress?.(written, index);
      });
      deflate.end();
    } catch (err) {
      deflate.destroy();
      await deflated.catch(() => undefined);
      throw err;
    }
    entry.compressed = await deflated;
    entry.crc = crc >>> 0;

    if (entry.size !== expectedSize) {
      throw new Error(t('the result size ({size}) does not match the expected size ({expectedSize})', { size: entry.size, expectedSize }));
    }
    const centralOffset = dataStart + entry.compressed;
    if (entry.compressed > ZIP_MAX_BYTES || centralOffset > ZIP_MAX_BYTES) {
      throw new Error(t('The game file is larger than 4 GB and cannot be compressed to .zip'));
    }
    const central = centralDirectory(entry, centralOffset);
    await handle.write(central, 0, central.length, centralOffset);
    await handle.write(localHeader(entry), 0, dataStart, 0); // the real CRC and sizes
    await handle.close();
    closed = true;
    await fsp.rename(tmp, dest);
  } catch (err) {
    if (!closed) await handle.close().catch(() => undefined);
    await fsp.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}
