import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { DEFAULT_COVER, coverPalette as paletteOf } from '../../shared/devices.ts';
import { deviceById } from '../../src/services/devices/registry.ts';

const device = deviceById('sf3000');
const PLATFORMS = device.platforms;
const coverPalette = (folder: string) => paletteOf(device, folder);
import {
  coverFontFamily,
  coverContent,
  coverMarkerOf,
  coverSvg,
  fitText,
  readCoverMarker,
  renderCover,
  textWidth,
  withCoverMarker,
  type TextBox,
} from '../../src/services/fs/coverArt.ts';
import { makeImage } from '../helpers/images.ts';

const BOX: TextBox = { width: 400, height: 380, maxLines: 6, maxSize: 66, minSize: 22, lineHeight: 1.16 };

test('every platform has its own cover colors; unknown folders get the neutral palette', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const { folder: code, cover } of PLATFORMS) {
    for (const color of [cover.from, cover.to, cover.accent, cover.text]) assert.match(color, hex, `${code}: ${color}`);
  }
  assert.equal(new Set(PLATFORMS.map(({ cover }) => `${cover.from}/${cover.to}`)).size, PLATFORMS.length, 'no two platforms look the same');
  assert.equal(coverPalette('sfc'), PLATFORMS.find((platform) => platform.folder === 'SFC')?.cover);
  assert.equal(coverPalette('roms'), DEFAULT_COVER);
  assert.equal(coverPalette(''), DEFAULT_COVER);
});

test('text width: wide letters are wider than narrow ones, bold is wider, the size scales it', () => {
  assert.ok(textWidth('WWWW', 20) > textWidth('iiii', 20) * 3);
  assert.ok(textWidth('Mario', 20, true) > textWidth('Mario', 20, false));
  assert.equal(Math.round(textWidth('Mario', 40)), Math.round(textWidth('Mario', 20) * 2));
  assert.ok(textWidth('ШШ', 20) > textWidth('оо', 20), 'Cyrillic: wide and ordinary letters');
});

test('a short title is drawn on one line in the largest font', () => {
  assert.deepEqual(fitText('Tetris', BOX), { size: 66, lines: ['Tetris'] });
  assert.deepEqual(fitText('  ', BOX).lines, []);
});

test('a long title is wrapped onto several lines with a smaller font, and every line fits', () => {
  const title = 'Final Fantasy VII International Edition Disc 1 of 4 Special Collectors Limited Re-release';
  const fitted = fitText(title, BOX);
  assert.ok(fitted.size < BOX.maxSize && fitted.size >= BOX.minSize, `size ${fitted.size}`);
  assert.ok(fitted.lines.length > 1 && fitted.lines.length <= BOX.maxLines);
  for (const line of fitted.lines) assert.ok(textWidth(line, fitted.size) <= BOX.width, line);
  assert.equal(fitted.lines.join(' '), title, 'no word is lost or split');
  assert.ok(fitted.size * (1 + (fitted.lines.length - 1) * BOX.lineHeight) <= BOX.height);
});

test('a smaller font is preferred to splitting a word; a word too long for any size is split', () => {
  const cyrillic = 'Без платформы'; // two words
  assert.deepEqual(fitText(cyrillic, BOX).lines, cyrillic.split(' '));

  const word = 'Supercalifragilisticexpialidociousadventuregame';
  const fitted = fitText(word, BOX);
  assert.ok(fitted.lines.length > 1);
  assert.equal(fitted.lines.join(''), word);
  for (const line of fitted.lines) assert.ok(textWidth(line, fitted.size) <= BOX.width, line);
});

test('text that cannot fit even at the smallest size is cut with an ellipsis', () => {
  const small: TextBox = { width: 200, height: 60, maxLines: 2, maxSize: 30, minSize: 20, lineHeight: 1.2 };
  const fitted = fitText('one two three four five six seven eight nine ten eleven twelve', small);
  assert.equal(fitted.size, 20);
  assert.ok(fitted.lines.length <= 2);
  assert.ok(fitted.lines.at(-1)?.endsWith('…'));
  for (const line of fitted.lines) assert.ok(textWidth(line, 20) <= small.width, line);
});

test('the SVG shows the platform name and the title, escapes them, and draws no logos or outside pictures', () => {
  const svg = coverSvg(coverContent('Tom & Jerry <Classic>', 'SFC', device));
  assert.ok(svg.includes('>Super Nintendo') && svg.includes('(SNES)<'), 'the full platform name (on one or two lines)');
  assert.ok(svg.includes('&amp;') && svg.includes('&lt;Classic&gt;'), 'the title is XML-escaped');
  assert.ok(!svg.includes('<Classic>'));
  assert.ok(svg.includes(coverPalette('SFC').from) && svg.includes(coverPalette('SFC').accent));
  assert.ok(!/<image|href=|url\((?!#)/.test(svg), 'only own shapes and text');

  const unknown = coverContent('Mario', 'roms', device);
  assert.equal(unknown.header, 'roms');
  assert.equal(unknown.code, '', 'the folder name is not repeated at the bottom');
  assert.equal(coverContent('Mario', '', device).header, '');
});

test('the marker of a generated cover: written into the PNG, read back (also non-ASCII titles), absent elsewhere', async () => {
  const plain = await makeImage('png', 8, 8);
  assert.equal(coverMarkerOf(plain), null, 'a picture the user chose');
  assert.equal(coverMarkerOf(Buffer.from('not a png')), null);

  const title = 'Игра "Quotes" \\ é';
  const marked = withCoverMarker(plain, { title, platform: 'GBA' });
  assert.deepEqual(coverMarkerOf(marked), { title, platform: 'GBA' });
  const meta = await sharp(marked).metadata();
  assert.equal(meta.width, 8, 'the PNG stays valid');
});

test('a rendered cover has the size of the console profile, with the marker; the marker is read from the file', async () => {
  const png = await renderCover({ title: 'The Legend of Zelda', platform: 'SFC' }, device);
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['png', device.covers.width, device.covers.height]);
  const file = path.join(work, 'cover.png');
  await fs.writeFile(file, png);
  assert.deepEqual(await readCoverMarker(file), { title: 'The Legend of Zelda', platform: 'SFC' });
  assert.equal(await readCoverMarker(path.join(work, 'missing.png')), null);

  // The colors of the platform are really there: the top-left corner (under the header band) is reddish for FC.
  const fc = await sharp(await renderCover({ title: 'Contra', platform: 'FC' }, device))
    .extract({ left: 40, top: 200, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok((fc[0] ?? 0) > (fc[2] ?? 0) + 40, `red dominates: ${[...fc].join(',')}`);
});

test('CJK titles: wrapped after any character at a large size, drawn with the fonts of their script', () => {
  const box = { width: 390, height: 400, maxLines: 6, maxSize: 66, minSize: 22, lineHeight: 1.16 };
  const chinese = fitText('\u585e\u5c14\u8fbe\u4f20\u8bf4\uff1a\u65f6\u4e4b\u7b1b', box);
  assert.ok(chinese.lines.length > 1, 'a title without spaces is not squeezed into one line');
  assert.ok(chinese.size >= 50, `size ${chinese.size}`);
  for (const line of chinese.lines) assert.ok(textWidth(line, chinese.size) <= box.width);
  assert.equal(chinese.lines.join(''), '\u585e\u5c14\u8fbe\u4f20\u8bf4\uff1a\u65f6\u4e4b\u7b1b');

  const first = (text: string): string => coverFontFamily(text).split(', ')[6] ?? '';
  assert.ok(coverFontFamily('Zelda').startsWith("'Arial'"), 'Latin fonts stay first');
  assert.equal(first('\u30bc\u30eb\u30c0\u306e\u4f1d\u8aac'), "'Hiragino Sans'", 'kana: Japanese fonts');
  assert.equal(first('\uc820\ub2e4\uc758 \uc804\uc124'), "'Apple SD Gothic Neo'", 'hangul: Korean fonts');
  assert.equal(first('\u585e\u5c14\u8fbe\u4f20\u8bf4'), "'PingFang SC'", 'Han only: Chinese fonts');
  for (const font of ['Noto Sans CJK JP', 'Microsoft YaHei', 'Malgun Gothic']) assert.ok(coverFontFamily('x').includes(`'${font}'`), font);
  const svg = coverSvg({ title: '\u30bc\u30eb\u30c0', header: 'GBA', palette: DEFAULT_COVER, code: '' });
  assert.match(svg, /font-family="[^"]*Hiragino Sans/);
});
