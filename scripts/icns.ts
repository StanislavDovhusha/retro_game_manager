/**
 * The Apple icon container (.icns): the header `icns` + total length, then entries of `type` + length + data. Every
 * entry here holds a PNG; these are the types macOS reads PNG data from (10.7+), one per slot of an `.iconset`.
 * Pure: no files, no image library — the build script renders the PNGs and the tests read the result back.
 */

/** Entry type → icon slot and pixel size of its PNG. */
export const ICNS_SLOTS = [
  { type: 'icp4', slot: 'icon_16x16', pixels: 16 },
  { type: 'ic11', slot: 'icon_16x16@2x', pixels: 32 },
  { type: 'icp5', slot: 'icon_32x32', pixels: 32 },
  { type: 'ic12', slot: 'icon_32x32@2x', pixels: 64 },
  { type: 'ic07', slot: 'icon_128x128', pixels: 128 },
  { type: 'ic13', slot: 'icon_128x128@2x', pixels: 256 },
  { type: 'ic08', slot: 'icon_256x256', pixels: 256 },
  { type: 'ic14', slot: 'icon_256x256@2x', pixels: 512 },
  { type: 'ic09', slot: 'icon_512x512', pixels: 512 },
  { type: 'ic10', slot: 'icon_512x512@2x', pixels: 1024 },
] as const;

export interface IcnsEntry {
  type: string;
  data: Uint8Array;
}

const HEADER = 8;

export function encodeIcns(entries: readonly IcnsEntry[]): Buffer {
  const parts = entries.map(({ type, data }) => {
    if (!/^[\x20-\x7e]{4}$/.test(type)) throw new Error(`icns: bad entry type "${type}"`);
    const head = Buffer.alloc(HEADER);
    head.write(type, 0, 'latin1');
    head.writeUInt32BE(HEADER + data.length, 4);
    return Buffer.concat([head, data]);
  });
  const head = Buffer.alloc(HEADER);
  head.write('icns', 0, 'latin1');
  head.writeUInt32BE(HEADER + parts.reduce((sum, part) => sum + part.length, 0), 4);
  return Buffer.concat([head, ...parts]);
}

export function decodeIcns(file: Uint8Array): IcnsEntry[] {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (buf.length < HEADER || buf.toString('latin1', 0, 4) !== 'icns') throw new Error('icns: not an icns file');
  if (buf.readUInt32BE(4) !== buf.length) throw new Error('icns: the length in the header does not match the file');
  const entries: IcnsEntry[] = [];
  for (let at = HEADER; at < buf.length;) {
    if (at + HEADER > buf.length) throw new Error('icns: truncated entry');
    const length = buf.readUInt32BE(at + 4);
    if (length < HEADER || at + length > buf.length) throw new Error('icns: bad entry length');
    entries.push({ type: buf.toString('latin1', at, at + 4), data: buf.subarray(at + HEADER, at + length) });
    at += length;
  }
  return entries;
}

/** Width and height of a PNG from its IHDR chunk, or null when the data is not a PNG. */
export function pngSize(data: Uint8Array): { width: number; height: number } | null {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const signature = '89504e470d0a1a0a';
  if (buf.length < 24 || buf.toString('hex', 0, 8) !== signature || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
