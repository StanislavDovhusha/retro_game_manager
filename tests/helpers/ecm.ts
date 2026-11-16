/**
 * Small CD images and their ECM archives for the tests. The encoder works like the reference `ecm` tool: a sector
 * whose EDC/ECC can be recomputed is stored without them (Mode 1 as type 1; Mode 2 Form 1/2 as 16 raw header bytes +
 * a type 2/3 sector), everything else is stored as raw bytes.
 */
import { eccEdcGenerate, ECM_MAGIC, edcUpdate } from '../../src/services/fs/ecm.ts';

export const RAW_SECTOR = 2352;
export type SectorKind = 'mode1' | 'form1' | 'form2' | 'raw';

const bcd = (value: number): number => ((Math.floor(value / 10) << 4) | (value % 10)) & 0xff;

/** A raw 2352-byte sector at the given LBA, with valid EDC/ECC for the data modes; `seed` varies the data. */
export function makeSector(kind: SectorKind, lba: number, seed = lba): Buffer {
  const sector = Buffer.alloc(RAW_SECTOR);
  let x = (seed * 2654435761 + 12345) >>> 0;
  const rnd = (): number => {
    x = (x * 1103515245 + 12345) >>> 0;
    return x >>> 24;
  };
  if (kind === 'raw') {
    for (let i = 0; i < RAW_SECTOR; i += 1) sector[i] = rnd();
    return sector;
  }
  sector.fill(0xff, 1, 11);
  const frames = lba + 150;
  sector[0x0c] = bcd(Math.floor(frames / (75 * 60)));
  sector[0x0d] = bcd(Math.floor(frames / 75) % 60);
  sector[0x0e] = bcd(frames % 75);
  if (kind === 'mode1') {
    sector[0x0f] = 1;
    for (let i = 0x10; i < 0x810; i += 1) sector[i] = rnd();
    eccEdcGenerate(sector, 1);
    return sector;
  }
  sector[0x0f] = 2;
  const subheader = [0, 0, kind === 'form1' ? 0x08 : 0x28, 0];
  sector.set(subheader, 0x10);
  sector.set(subheader, 0x14);
  const end = kind === 'form1' ? 0x818 : 0x92c;
  for (let i = 0x18; i < end; i += 1) sector[i] = rnd();
  eccEdcGenerate(sector, kind === 'form1' ? 2 : 3);
  return sector;
}

/** A raw image: one sector of each kind per entry. */
export const makeImage = (kinds: SectorKind[]): Buffer => Buffer.concat(kinds.map((kind, lba) => makeSector(kind, lba)));

function typeCount(type: number, count: number): number[] {
  let num = (count - 1) >>> 0;
  const out = [(num >= 32 ? 0x80 : 0) | ((num & 31) << 2) | type];
  num >>>= 5;
  while (num) {
    out.push((num >= 128 ? 0x80 : 0) | (num & 127));
    num >>>= 7;
  }
  return out;
}

/** Which ECM type a 2352-byte sector can be stored as (0 — raw). */
function detect(sector: Buffer): 0 | 1 | 2 | 3 {
  const sync = sector[0] === 0 && sector.subarray(1, 11).every((byte) => byte === 0xff) && sector[11] === 0;
  if (!sync) return 0;
  for (const type of sector[0x0f] === 1 ? ([1] as const) : sector[0x0f] === 2 ? ([2, 3] as const) : []) {
    if (type !== 1 && !sector.subarray(0x10, 0x14).equals(sector.subarray(0x14, 0x18))) continue;
    const copy = Buffer.from(sector);
    eccEdcGenerate(copy, type);
    if (copy.equals(sector)) return type;
  }
  return 0;
}

/** Packs a raw image (any length; whole 2352-byte sectors are analyzed, the tail is stored raw) into an ECM archive. */
export function encodeEcm(raw: Buffer): Buffer {
  const records: { type: number; items: Buffer[] }[] = [];
  const push = (type: number, item: Buffer): void => {
    const last = records.at(-1);
    if (last && last.type === type) last.items.push(item);
    else records.push({ type, items: [item] });
  };
  let pos = 0;
  for (; pos + RAW_SECTOR <= raw.length; pos += RAW_SECTOR) {
    const sector = raw.subarray(pos, pos + RAW_SECTOR);
    const type = detect(sector);
    if (type === 0) push(0, sector);
    else if (type === 1) push(1, Buffer.concat([sector.subarray(0x0c, 0x0f), sector.subarray(0x10, 0x810)]));
    else {
      push(0, sector.subarray(0, 0x10));
      push(type, sector.subarray(0x14, type === 2 ? 0x818 : 0x92c));
    }
  }
  if (pos < raw.length) push(0, raw.subarray(pos));

  const parts: Buffer[] = [ECM_MAGIC];
  for (const record of records) {
    const count = record.type === 0 ? record.items.reduce((sum, item) => sum + item.length, 0) : record.items.length;
    parts.push(Buffer.from(typeCount(record.type, count)), ...record.items);
  }
  parts.push(Buffer.from(typeCount(0, 0))); // count - 1 = 0xFFFFFFFF: the end marker
  const edc = Buffer.alloc(4);
  edc.writeUInt32LE(edcUpdate(0, raw), 0);
  parts.push(edc);
  return Buffer.concat(parts);
}
