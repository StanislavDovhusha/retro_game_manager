import sharp from 'sharp';

/** A real picture of the given format (the cover conversion decodes images, so a fake file with a signature is not enough). */
export async function makeImage(format: 'png' | 'jpeg' | 'webp' | 'gif', width = 8, height = 6, background = '#e03030'): Promise<Buffer> {
  const base = sharp({ create: { width, height, channels: 3, background } });
  return format === 'png'
    ? base.png().toBuffer()
    : format === 'jpeg'
      ? base.jpeg().toBuffer()
      : format === 'webp'
        ? base.webp().toBuffer()
        : base.gif().toBuffer();
}

/** A 24-bit uncompressed bottom-up BMP filled with one colour. */
export function makeBmp(width: number, height: number, [r, g, b]: [number, number, number] = [30, 120, 220]): Buffer {
  const stride = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + stride * height);
  out.write('BM');
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = 54 + y * stride + x * 3;
      out[at] = b;
      out[at + 1] = g;
      out[at + 2] = r;
    }
  }
  return out;
}

export const PNG = await makeImage('png');

/** The size and the format of a picture, read back. */
export async function inspectImage(file: string | Buffer): Promise<{ format: string | undefined; width: number; height: number }> {
  const { format, width, height } = await sharp(file).metadata();
  return { format, width: width ?? 0, height: height ?? 0 };
}
