import fs from 'node:fs/promises';
import { t } from '../../i18n/index.ts';
import { ValidationError } from '../../utils/errors.ts';

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'bmp' | 'webp';

const startsWith = (buf: Uint8Array, bytes: readonly number[], offset = 0): boolean => bytes.every((byte, i) => buf[offset + i] === byte);

/** Recognizes an image by its first bytes (the extension alone proves nothing). */
export function detectImageFormat(head: Uint8Array): ImageFormat | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38]) && (head[4] === 0x37 || head[4] === 0x39) && head[5] === 0x61) return 'gif';
  if (startsWith(head, [0x42, 0x4d])) return 'bmp';
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}

/** Throws a validation error unless the file starts like a supported image. */
export async function assertImageFile(abs: string): Promise<ImageFormat> {
  const handle = await fs.open(abs, 'r');
  try {
    const head = Buffer.alloc(16);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    const format = detectImageFormat(head.subarray(0, bytesRead));
    if (!format) throw new ValidationError(t('The file is not a valid image (PNG, JPG, WEBP, BMP or GIF)'));
    return format;
  } finally {
    await handle.close();
  }
}
