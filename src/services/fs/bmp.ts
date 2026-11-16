import { t } from '../../i18n/index.ts';
import { ValidationError } from '../../utils/errors.ts';

/** A decoded picture: 8-bit RGBA, rows from the top. */
export interface RgbaImage {
  width: number;
  height: number;
  rgba: Buffer;
}

const MAX_PIXELS = 100_000_000;
const COMPRESSION_RGB = 0;
const COMPRESSION_BITFIELDS = 3;
const COMPRESSION_ALPHA_BITFIELDS = 6;

const unsupported = (detail: string): ValidationError => new ValidationError(t('This BMP variant is not supported: {detail}', { detail }));
const corrupted = (): ValidationError => new ValidationError(t('The BMP file is damaged or incomplete'));

interface Mask {
  mask: number;
  shift: number;
  max: number;
}

/** A colour channel stored in the bits selected by `mask` (0 — there is no such channel). */
function channelOf(mask: number): Mask {
  if (mask === 0) return { mask: 0, shift: 0, max: 0 };
  let shift = 0;
  while (((mask >>> shift) & 1) === 0) shift += 1;
  return { mask, shift, max: mask >>> shift };
}

const extract = (value: number, channel: Mask, fallback: number): number =>
  channel.mask === 0 ? fallback : Math.round((((value & channel.mask) >>> channel.shift) * 255) / channel.max);

/**
 * Decodes a Windows BMP (the formats sharp/libvips cannot read): 1, 4, 8 (with a palette), 16, 24 and 32 bits per
 * pixel, uncompressed or with bit masks, bottom-up or top-down, and the old OS/2 core header. The RLE variants are
 * refused with a clear message.
 */
export function decodeBmp(data: Uint8Array): RgbaImage {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buf.length < 26 || buf.toString('latin1', 0, 2) !== 'BM') throw corrupted();

  const pixelOffset = buf.readUInt32LE(10);
  const headerSize = buf.readUInt32LE(14);
  const core = headerSize === 12;
  if (!core && headerSize < 40) throw unsupported(`DIB header ${headerSize}`);
  if (buf.length < 14 + headerSize) throw corrupted();

  const width = core ? buf.readUInt16LE(18) : buf.readInt32LE(18);
  const rawHeight = core ? buf.readUInt16LE(20) : buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(core ? 24 : 28);
  const compression = core ? COMPRESSION_RGB : buf.readUInt32LE(30);
  const colorsUsed = core ? 0 : buf.readUInt32LE(46);
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);

  if (width <= 0 || height === 0) throw corrupted();
  if (width * height > MAX_PIXELS) throw new ValidationError(t('The picture is too large'));
  if (![1, 4, 8, 16, 24, 32].includes(bpp)) throw unsupported(`${bpp} bits per pixel`);
  if (![COMPRESSION_RGB, COMPRESSION_BITFIELDS, COMPRESSION_ALPHA_BITFIELDS].includes(compression)) {
    throw unsupported(compression === 1 || compression === 2 ? 'RLE compression' : `compression ${compression}`);
  }
  if (compression !== COMPRESSION_RGB && bpp !== 16 && bpp !== 32) throw unsupported('bit masks with this depth');

  // Bit masks (16 and 32 bits per pixel): after the 40-byte header they are stored separately, in newer headers inside it.
  let masks = bpp === 16 ? [0x7c00, 0x03e0, 0x001f, 0] : [0x00ff0000, 0x0000ff00, 0x000000ff, 0];
  let paletteStart = 14 + headerSize;
  if (compression !== COMPRESSION_RGB) {
    const count = compression === COMPRESSION_ALPHA_BITFIELDS ? 4 : 3;
    if (buf.length < 54 + count * 4) throw corrupted();
    masks = Array.from({ length: 4 }, (_, i) => (i < count || headerSize >= 56 ? buf.readUInt32LE(54 + i * 4) : 0));
    if (headerSize === 40) paletteStart += count * 4;
  }
  const [red, green, blue, alpha] = masks.map(channelOf) as [Mask, Mask, Mask, Mask];

  let palette: number[][] = [];
  if (bpp <= 8) {
    const entries = colorsUsed || 1 << bpp;
    const size = core ? 3 : 4;
    if (entries > 256 || paletteStart + entries * size > buf.length) throw corrupted();
    palette = Array.from({ length: entries }, (_, i) => {
      const at = paletteStart + i * size;
      return [buf[at + 2] ?? 0, buf[at + 1] ?? 0, buf[at] ?? 0];
    });
  }

  const stride = (((width * bpp + 31) >>> 5) << 2) >>> 0;
  if (pixelOffset + stride * height > buf.length) throw corrupted();

  const rgba = Buffer.alloc(width * height * 4);
  let anyAlpha = false;
  for (let y = 0; y < height; y += 1) {
    const rowStart = pixelOffset + (topDown ? y : height - 1 - y) * stride;
    let out = y * width * 4;
    for (let x = 0; x < width; x += 1, out += 4) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 255;
      if (bpp <= 8) {
        const bitIndex = x * bpp;
        const byte = buf[rowStart + (bitIndex >>> 3)] ?? 0;
        const index = (byte >>> (8 - bpp - (bitIndex & 7))) & ((1 << bpp) - 1);
        [r, g, b] = palette[index] ?? [0, 0, 0];
      } else if (bpp === 24) {
        const at = rowStart + x * 3;
        b = buf[at] ?? 0;
        g = buf[at + 1] ?? 0;
        r = buf[at + 2] ?? 0;
      } else {
        const value = bpp === 16 ? buf.readUInt16LE(rowStart + x * 2) : buf.readUInt32LE(rowStart + x * 4);
        r = extract(value, red, 0);
        g = extract(value, green, 0);
        b = extract(value, blue, 0);
        if (alpha.mask !== 0) {
          a = extract(value, alpha, 255);
          anyAlpha = anyAlpha || a !== 0;
        } else if (bpp === 32 && compression === COMPRESSION_RGB) {
          // An undefined fourth byte: it counts as transparency only when the picture really uses it.
          const fourth = buf[rowStart + x * 4 + 3] ?? 0;
          a = fourth;
          anyAlpha = anyAlpha || fourth !== 0;
        }
      }
      rgba[out] = r;
      rgba[out + 1] = g;
      rgba[out + 2] = b;
      rgba[out + 3] = a;
    }
  }
  // 32-bit pictures whose alpha is zero everywhere (the usual "unused" byte) are opaque.
  if (bpp === 32 && !anyAlpha) for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return { width, height, rgba };
}
