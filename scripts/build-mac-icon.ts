/**
 * The macOS icon: resources/icon-mac.png (1024×1024) and resources/icon.icns with every size of an `.iconset`
 * (16, 32, 64, 128, 256, 512 and 1024 px, as PNG entries).
 *
 * Usage: node scripts/build-mac-icon.ts   (run by `npm run icons` after the drawing script; needs only sharp)
 *
 * The source is resources/icon.png. On macOS the icon body follows Apple's grid — 824 px of the 1024 px canvas, the rest
 * is a transparent margin — so in the Dock it is as large as the other applications' icons; the drawing in icon.png
 * fills a little more (the Windows and Linux icons are made from it as is). The same icon-mac.png is put into the Dock
 * during development (electron/main.ts), where the Electron binary would show its own icon.
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp, { type Sharp } from 'sharp';
import { ICNS_SLOTS, encodeIcns } from './icns.ts';

const resources = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const CANVAS = 1024;
/** Apple's macOS app icon grid: the body is 824 × 824 in the 1024 canvas. */
const BODY = 824;

/** The opaque part of the source (the rounded square plus the badge). */
async function bodyOf(source: string): Promise<Sharp> {
  const trimmed = await sharp(source).ensureAlpha().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const scale = BODY / Math.max(width, height);
  return sharp(trimmed.data).resize(Math.round(width * scale), Math.round(height * scale), { kernel: 'lanczos3' });
}

async function main(): Promise<void> {
  const source = path.join(resources, 'icon.png');
  const meta = await sharp(source).metadata();
  if (meta.width !== CANVAS || meta.height !== CANVAS)
    throw new Error(`resources/icon.png must be ${CANVAS}×${CANVAS}, it is ${meta.width}×${meta.height}`);

  const body = await (await bodyOf(source)).png().toBuffer({ resolveWithObject: true });
  const mac = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: body.data, left: Math.round((CANVAS - body.info.width) / 2), top: Math.round((CANVAS - body.info.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(resources, 'icon-mac.png'), mac);

  const entries = await Promise.all(
    ICNS_SLOTS.map(async ({ type, pixels }) => ({
      type,
      data:
        pixels === CANVAS ? mac : await sharp(mac).resize(pixels, pixels, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer(),
    })),
  );
  await writeFile(path.join(resources, 'icon.icns'), encodeIcns(entries));
  process.stdout.write(`written: resources/icon-mac.png, resources/icon.icns (${ICNS_SLOTS.map((slot) => slot.slot).join(', ')})\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
