import assert from 'node:assert/strict';
import zlib from 'node:zlib';

export interface ZipEntry {
  name: string;
  flags: number;
  method: number;
  crc: number;
  compressed: number;
  size: number;
  data: Buffer;
}

/**
 * Reads a ZIP archive with exactly one file the way a strict reader would: the end record, the central directory and
 * the local header must agree, the data must inflate to the declared size and match the CRC.
 */
export function readSingleZip(buf: Buffer): ZipEntry {
  const end = buf.length - 22;
  assert.equal(buf.readUInt32LE(end), 0x06054b50, 'end of central directory record');
  assert.equal(buf.readUInt16LE(end + 10), 1, 'one entry');
  const centralSize = buf.readUInt32LE(end + 12);
  const centralOffset = buf.readUInt32LE(end + 16);
  assert.equal(centralOffset + centralSize, end, 'the central directory ends where the end record starts');

  const c = centralOffset;
  assert.equal(buf.readUInt32LE(c), 0x02014b50, 'central directory header');
  const nameLength = buf.readUInt16LE(c + 28);
  const central = {
    flags: buf.readUInt16LE(c + 8),
    method: buf.readUInt16LE(c + 10),
    crc: buf.readUInt32LE(c + 16),
    compressed: buf.readUInt32LE(c + 20),
    size: buf.readUInt32LE(c + 24),
    localOffset: buf.readUInt32LE(c + 42),
    name: buf.subarray(c + 46, c + 46 + nameLength),
  };
  assert.equal(central.localOffset, 0);

  assert.equal(buf.readUInt32LE(0), 0x04034b50, 'local file header');
  const local = {
    flags: buf.readUInt16LE(6),
    method: buf.readUInt16LE(8),
    crc: buf.readUInt32LE(14),
    compressed: buf.readUInt32LE(18),
    size: buf.readUInt32LE(22),
    name: buf.subarray(30, 30 + buf.readUInt16LE(26)),
  };
  const dataStart = 30 + local.name.length + buf.readUInt16LE(28);
  for (const key of ['flags', 'method', 'crc', 'compressed', 'size'] as const) {
    assert.equal(local[key], central[key], `local header and central directory agree on ${key}`);
  }
  assert.deepEqual(local.name, central.name);
  assert.equal(dataStart + local.compressed, centralOffset, 'the data fills the space up to the central directory');

  const data = zlib.inflateRawSync(buf.subarray(dataStart, dataStart + local.compressed));
  assert.equal(data.length, local.size);
  assert.equal(zlib.crc32(data), local.crc);
  return { ...local, name: local.name.toString('utf8'), data };
}
