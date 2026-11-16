import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { coverPalette, platformName, type CoverPalette, type DeviceProfile } from '../../../shared/devices.ts';
import { svgToPng } from './imageConvert.ts';

/**
 * Generated covers: a game box drawn by the application when the user adds a game without an image.
 *
 * The box is an SVG template (gradient background in the colors of the platform, a header band with the full platform
 * name, the game title below it) rendered to PNG by sharp. Only text and our own shapes are used — no logos.
 *
 * A generated PNG carries a text chunk with the title it was drawn for. That is how the application knows later that
 * the cover is its own (a picture the user chose never has the chunk) and whether it has to be redrawn after the
 * game is renamed.
 */

/** The design size of the box. The PNG is rendered at the size of the console's profile (`covers.width/height`). */
export const COVER_WIDTH = 480;
export const COVER_HEIGHT = 640;

export interface CoverSize {
  width: number;
  height: number;
}

const LATIN_FONTS = ['Arial', 'Helvetica Neue', 'Helvetica', 'Liberation Sans', 'DejaVu Sans', 'Noto Sans'];
/** System fonts with Japanese, Simplified Chinese and Korean glyphs (macOS, Windows, Linux), so titles are not drawn as empty boxes. */
const CJK_FONTS = {
  ja: ['Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', 'Yu Gothic', 'Meiryo', 'Noto Sans CJK JP', 'Noto Sans JP'],
  zh: [
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei UI',
    'Microsoft YaHei',
    'Noto Sans CJK SC',
    'Noto Sans SC',
    'WenQuanYi Micro Hei',
  ],
  ko: ['Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', 'NanumGothic'],
};

/**
 * The font list of a cover. Han characters are shared by Chinese, Japanese and Korean but drawn differently, so the
 * fonts of the script found in the text come first: kana means Japanese, hangul means Korean, otherwise Chinese.
 */
export function coverFontFamily(text: string): string {
  const order: (keyof typeof CJK_FONTS)[] = /[\u3040-\u30ff\uff66-\uff9f]/.test(text)
    ? ['ja', 'zh', 'ko']
    : /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(text)
      ? ['ko', 'ja', 'zh']
      : ['zh', 'ja', 'ko'];
  const names = [...LATIN_FONTS, ...order.flatMap((script) => CJK_FONTS[script])];
  return `${names.map((name) => `'${name}'`).join(', ')}, sans-serif`;
}

// ── Text measuring and wrapping ───────────────────────────────────────────────────────────

/** Advance widths (in em) of Arial-like glyphs, grouped. Close enough to wrap text without measuring the real font. */
const WIDTH_GROUPS: [string, number][] = [
  ["ijl|'", 0.23],
  [' .,:;!fIt/\\[]', 0.28],
  ['r()-{}`"', 0.34],
  ['ckvxyzsJ*^', 0.5],
  ['0123456789abdeghnopqu$#_?L+=<>~', 0.56],
  ['FTZ', 0.61],
  ['ABEKPSVXY&', 0.67],
  ['CDHNRUw', 0.72],
  ['GOQ', 0.78],
  ['mM', 0.83],
  ['W@%', 0.94],
];
const WIDTHS = new Map<string, number>(WIDTH_GROUPS.flatMap(([chars, width]) => [...chars].map((char): [string, number] => [char, width])));
/** Cyrillic letters (escaped: the server source is kept in ASCII): wide ones (zhe, sha, shcha, yu, ef, yery, em) and narrow ones. */
const WIDE_CYRILLIC = new Set([...'\u0436\u0448\u0449\u044e\u0444\u044b\u043c\u0416\u0428\u0429\u042e\u0424\u042b\u041c']);
const NARROW_CYRILLIC = new Set([...'\u0433\u0437\u043a\u0442\u0413']);
/** Bold glyphs are wider; fonts other than Arial (DejaVu Sans on Linux) are wider still: keep a small margin. */
const BOLD = 1.08;
const MARGIN = 1.03;

function charWidth(char: string): number {
  const known = WIDTHS.get(char);
  if (known !== undefined) return known;
  if (/[\u0400-\u04ff]/.test(char)) {
    const upper = char !== char.toLowerCase();
    if (WIDE_CYRILLIC.has(char)) return upper ? 0.9 : 0.76;
    if (NARROW_CYRILLIC.has(char)) return upper ? 0.6 : 0.45;
    return upper ? 0.68 : 0.53;
  }
  if (/[\uff61-\uff9f]/.test(char)) return 0.5; // half-width katakana
  if (/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u.test(char)) return 1;
  return 0.6;
}

/** Estimated width of a line of text in pixels. */
export function textWidth(text: string, size: number, bold = true): number {
  let em = 0;
  for (const char of text) em += charWidth(char);
  return em * size * (bold ? BOLD : 1) * MARGIN;
}

export interface TextBox {
  width: number;
  /** Height available for the whole block of lines. */
  height: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
  /** Distance between baselines as a multiple of the font size. */
  lineHeight: number;
}

export interface FittedText {
  size: number;
  lines: string[];
}

/** Splits a word that is wider than the line by characters. */
function breakWord(word: string, size: number, width: number): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of word) {
    if (current && textWidth(current + char, size) > width) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

/** Chinese, Japanese and Korean text has no spaces between words and may be wrapped after any character. */
const CJK = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

/**
 * Greedy word wrap at the given font size. A word wider than the line is split by characters only when `breakWords`
 * is set; otherwise the result is null (the caller tries a smaller font first). A word in a script written without
 * spaces is always split.
 */
export function wrapText(text: string, size: number, width: number, breakWords = true): string[] | null {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (textWidth(word, size) <= width) current = word;
    else if (!breakWords && !CJK.test(word)) return null;
    else {
      const parts = breakWord(word, size, width);
      current = parts.pop() ?? '';
      lines.push(...parts);
    }
  }
  if (current) lines.push(current);
  return lines;
}

const blockHeight = (lines: number, size: number, lineHeight: number): number => size * (1 + (lines - 1) * lineHeight);

/**
 * The largest font size (from `maxSize` down to `minSize`) at which the text fits the box when wrapped; long text
 * gets more lines and a smaller font. Words are kept whole when any size allows it; a word too long even for the
 * smallest font is split. When even the smallest size does not fit, the last line ends with an ellipsis.
 */
export function fitText(text: string, box: TextBox): FittedText {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return { size: box.maxSize, lines: [] };
  for (const breakWords of [false, true]) {
    for (let size = box.maxSize; size >= box.minSize; size -= 1) {
      const lines = wrapText(clean, size, box.width, breakWords);
      if (lines && lines.length <= box.maxLines && blockHeight(lines.length, size, box.lineHeight) <= box.height) return { size, lines };
    }
  }
  const size = box.minSize;
  const fitting = Math.max(1, Math.min(box.maxLines, Math.floor((box.height / size - 1) / box.lineHeight) + 1));
  const lines = (wrapText(clean, size, box.width) ?? []).slice(0, fitting);
  let last = lines.pop() ?? '';
  while (last && textWidth(`${last}\u2026`, size) > box.width) last = [...last].slice(0, -1).join('').trimEnd();
  lines.push(`${last}\u2026`);
  return { size, lines };
}

// ── The SVG template ──────────────────────────────────────────────────────────────────────

const xml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** `<text>` lines centered horizontally at `cx` and vertically in the band from `top` of the given height. */
function textBlock(fitted: FittedText, cx: number, top: number, height: number, lineHeight: number, attrs: string): string {
  if (!fitted.lines.length) return '';
  const total = blockHeight(fitted.lines.length, fitted.size, lineHeight);
  const firstBaseline = top + (height - total) / 2 + fitted.size * 0.82;
  return fitted.lines
    .map(
      (line, index) =>
        `<text x="${cx}" y="${(firstBaseline + index * fitted.size * lineHeight).toFixed(1)}" font-size="${fitted.size}" ${attrs}>${xml(line)}</text>`,
    )
    .join('');
}

export interface CoverContent {
  title: string;
  /** The text of the header: the full platform name (or the folder name of an unknown platform; may be empty). */
  header: string;
  palette: CoverPalette;
  /** A short platform code written at the bottom of the box (empty: nothing). */
  code: string;
}

/**
 * Builds the SVG of a cover. It is drawn on the 480×640 design box and scaled to `size`; a size of another shape is
 * filled edge to edge (the design is centred and cut at the sides).
 */
export function coverSvg(
  { title, header, palette, code }: CoverContent,
  size: CoverSize = { width: COVER_WIDTH, height: COVER_HEIGHT },
): string {
  const W = COVER_WIDTH;
  const H = COVER_HEIGHT;
  const spine = 22;
  const cx = spine + (W - spine) / 2;
  const inner = W - spine - 2 * 34;
  const band = 150;

  const headerText = fitText(header, { width: inner, height: band - 40, maxLines: 2, maxSize: 46, minSize: 20, lineHeight: 1.12 });
  const titleTop = band + 54;
  const titleHeight = H - titleTop - 86;
  const titleText = fitText(title, { width: inner, height: titleHeight, maxLines: 6, maxSize: 66, minSize: 22, lineHeight: 1.16 });
  const font = `font-family="${xml(coverFontFamily(`${title} ${header}`))}" font-weight="700" text-anchor="middle"`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
    '<defs>',
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/></linearGradient>`,
    '<linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>',
    '</defs>',
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    // Decoration: concentric rings and diagonal stripes in the accent color.
    `<g fill="none" stroke="${palette.accent}" stroke-opacity="0.13">`,
    `<circle cx="${W - 40}" cy="${H - 60}" r="150" stroke-width="26"/><circle cx="${W - 40}" cy="${H - 60}" r="230" stroke-width="10"/>`,
    '</g>',
    `<g stroke="${palette.accent}" stroke-opacity="0.09" stroke-width="14">`,
    ...[0, 1, 2, 3].map((i) => `<line x1="${spine - 40 + i * 44}" y1="${H + 20}" x2="${spine + 160 + i * 44}" y2="${H - 180}"/>`),
    '</g>',
    // The header band with the platform name, and the accent stripe under it.
    `<rect width="${W}" height="${band}" fill="#000000" fill-opacity="0.32"/>`,
    `<rect width="${W}" height="${band}" fill="url(#shine)"/>`,
    `<rect y="${band}" width="${W}" height="7" fill="${palette.accent}"/>`,
    textBlock(headerText, cx, 0, band, 1.12, `${font} fill="${palette.text}" letter-spacing="0.5"`),
    // The game title with a soft shadow.
    textBlock(titleText, cx + 2, titleTop + 3, titleHeight, 1.16, `${font} fill="#000000" fill-opacity="0.35"`),
    textBlock(titleText, cx, titleTop, titleHeight, 1.16, `${font} fill="${palette.text}"`),
    // The bottom: an accent line and the platform code.
    `<rect x="${cx - 40}" y="${H - 58}" width="80" height="4" rx="2" fill="${palette.accent}"/>`,
    code
      ? `<text x="${cx}" y="${H - 24}" font-size="20" ${font} fill="${palette.text}" fill-opacity="0.75" letter-spacing="3">${xml(code.toUpperCase())}</text>`
      : '',
    // The spine of the box and a thin edge.
    `<rect width="${spine}" height="${H}" fill="#000000" fill-opacity="0.35"/>`,
    `<rect x="${spine}" width="2" height="${H}" fill="#ffffff" fill-opacity="0.18"/>`,
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>`,
    '</svg>',
  ].join('');
}

// ── The marker of a generated cover ───────────────────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MARKER_KEY = 'game-manager:cover';
/** The key written by versions before the rename: covers already on cards carry it and are still recognized. */
const LEGACY_MARKER_KEY = 'sf3000-game-manager:cover';
/** The marker is written right after IHDR, so reading the head of the file is enough. */
const HEAD_BYTES = 64 * 1024;

export interface CoverMarker {
  /** The title the cover was drawn for. */
  title: string;
  /** The platform folder at that time ('' without a platform). */
  platform: string;
}

/** JSON with every non-ASCII character escaped: a tEXt chunk holds Latin-1 only. */
const asciiJson = (value: unknown): string =>
  JSON.stringify(value).replace(/[\u007f-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** Adds the marker of a generated cover to PNG bytes (a tEXt chunk after IHDR). */
export function withCoverMarker(png: Buffer, marker: CoverMarker): Buffer {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString('latin1', 12, 16) !== 'IHDR') throw new Error('not a PNG');
  const afterHeader = 8 + 8 + png.readUInt32BE(8) + 4;
  const text = chunk('tEXt', Buffer.from(`${MARKER_KEY}\0${asciiJson({ v: 1, ...marker })}`, 'latin1'));
  return Buffer.concat([png.subarray(0, afterHeader), text, png.subarray(afterHeader)]);
}

/** The marker of a generated cover in PNG bytes, or null (another image, or a cover the user chose). */
export function coverMarkerOf(png: Buffer): CoverMarker | null {
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT' || type === 'IEND') return null;
    const end = offset + 8 + length;
    if (end > png.length) return null;
    if (type === 'tEXt') {
      const data = png.subarray(offset + 8, end);
      const zero = data.indexOf(0);
      const key = zero > 0 ? data.toString('latin1', 0, zero) : '';
      if (key === MARKER_KEY || key === LEGACY_MARKER_KEY) {
        try {
          const value: unknown = JSON.parse(data.toString('latin1', zero + 1));
          if (value && typeof value === 'object' && 'title' in value && typeof value.title === 'string') {
            const platform = 'platform' in value && typeof value.platform === 'string' ? value.platform : '';
            return { title: value.title, platform };
          }
        } catch {
          return null;
        }
      }
    }
    offset = end + 4;
  }
  return null;
}

/** Reads the marker from a cover file; null when the file is not a generated cover or cannot be read. */
export async function readCoverMarker(file: string): Promise<CoverMarker | null> {
  let handle;
  try {
    handle = await fs.open(file, 'r');
    const head = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return coverMarkerOf(head.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────────────────

/** What a cover of a game of this platform of the console shows. */
export function coverContent(title: string, platform: string, device: DeviceProfile | null): CoverContent {
  const code = platform.trim();
  const name = platformName(device, code);
  // An unknown folder (`roms`) is written in the header itself, so it is not repeated at the bottom.
  return { title, header: name ?? code, palette: coverPalette(device, code), code: name ? code : '' };
}

/** Draws the cover of a game as PNG bytes (with the marker of a generated cover), at the console's cover size. */
export async function renderCover({ title, platform }: CoverMarker, device: DeviceProfile | null): Promise<Buffer> {
  const size = device ? { width: device.covers.width, height: device.covers.height } : undefined;
  const png = await svgToPng(coverSvg(coverContent(title, platform, device), size));
  return withCoverMarker(png, { title, platform: platform.trim() });
}
