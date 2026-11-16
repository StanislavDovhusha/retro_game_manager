import fs from 'node:fs/promises';
import { t } from '../../i18n/index.ts';
import { InternalError, ValidationError } from '../../utils/errors.ts';
import { errorMessage } from '../../utils/guards.ts';
import { atomicWrite } from '../../utils/atomicWrite.ts';
import { decodeBmp } from './bmp.ts';
import { detectImageFormat, type ImageFormat } from './imageSignature.ts';

/**
 * Covers are stored as PNG. The conversion is done by a converter: `sharp` in the application, replaceable in tests
 * (and anywhere `sharp` cannot be loaded).
 */
export interface ImageConverter {
  /** Reads an image file in any supported format and returns it as PNG bytes. Throws when it is not a readable image. */
  toPng(file: string): Promise<Buffer>;
}

/** Pictures with more pixels than this are refused (a decompression bomb protection; a cover never needs more). */
const MAX_PIXELS = 100_000_000;

/** The converter that uses sharp (libvips). It is loaded on first use, so the rest of the server works without it. */
async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch (err) {
    throw new InternalError(
      t('Image conversion is unavailable: the "sharp" module could not be loaded ({message})', { message: errorMessage(err) }),
      {
        cause: err,
      },
    );
  }
}

async function formatOf(file: string): Promise<ImageFormat | null> {
  const handle = await fs.open(file, 'r');
  try {
    const head = Buffer.alloc(16);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return detectImageFormat(head.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

export const sharpConverter: ImageConverter = {
  async toPng(file) {
    const sharp = await loadSharp();
    try {
      const format = await formatOf(file);
      if (format === 'bmp') {
        // libvips (and so sharp) cannot read BMP: the pixels are decoded here and handed over as raw RGBA.
        const { width, height, rgba } = decodeBmp(await fs.readFile(file));
        return await sharp(rgba, { raw: { width, height, channels: 4 } })
          .png()
          .toBuffer();
      }
      const input = sharp(file, { failOn: 'error', limitInputPixels: MAX_PIXELS });
      if (format === 'png') {
        await input.metadata(); // a PNG is kept byte for byte, but it must be a readable one
        return await fs.readFile(file);
      }
      // `rotate()` applies the camera orientation of a JPEG; a GIF or WebP animation becomes its first frame.
      return await input.rotate().png().toBuffer();
    } catch (err) {
      throw new ValidationError(t('The image could not be read or converted to PNG: {message}', { message: errorMessage(err) }), {
        cause: err,
      });
    }
  },
};

let converter: ImageConverter = sharpConverter;

/** Replaces the converter (tests); `null` restores the default one. */
export function setImageConverter(next: ImageConverter | null): void {
  converter = next ?? sharpConverter;
}

/**
 * Renders an SVG document (made by the application itself, see `coverArt.ts`) to PNG bytes with sharp. Text is drawn
 * with the fonts of the system (fontconfig), so the SVG names a list of common sans-serif families.
 */
export async function svgToPng(svg: string): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(Buffer.from(svg, 'utf8'), { density: 72 }).png({ compressionLevel: 9 }).toBuffer();
}

/** Reads an image file (any supported format) and returns PNG bytes. */
export const convertToPng = (source: string): Promise<Buffer> => converter.toPng(source);

/** Saves PNG bytes through a temporary file: an existing file stays untouched until the new one is complete. */
export const writePng = (target: string, png: Buffer): Promise<void> => atomicWrite(target, png);
