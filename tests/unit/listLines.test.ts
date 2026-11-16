import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import iconv from 'iconv-lite';
import {
  decodeList,
  listEncoding,
  newListDocument,
  type ListDocument,
  editList,
  encodeList,
  formatListLine,
  linePath,
  listFields,
  listShortName,
  type ListFormat,
  type ListGame,
} from '../../src/services/lists/listLines.ts';

const FORMAT: ListFormat = { separator: '|', fields: ['path', 'title', 'titleUpper', 'short', 'shortUpper'] };
const game = (platform: string, rel: string, title: string, short = ''): ListGame => ({ platform, rel, title, short });

test('the three example lines, exactly', () => {
  assert.equal(formatListLine(FORMAT, game('PS', 'Hercules.img', 'Hercules')), 'PS/Hercules.img|Hercules|HERCULES|hercules|HERCULES');
  assert.equal(
    formatListLine(FORMAT, game('PS', 'Parasite Eve II.img', 'Parasite Eve II')),
    'PS/Parasite Eve II.img|Parasite Eve II|PARASITE EVE II|parasiteEveIi|PARASITEEVEII',
  );
  assert.equal(
    formatListLine(FORMAT, game('PCE', 'Dai Makai-Mura.zip', 'Dai Makai-Mura')),
    'PCE/Dai Makai-Mura.zip|Dai Makai-Mura|DAI MAKAI-MURA|daiMakaiMura|DAIMAKAIMURA',
  );
});

test('the same lines from the short names the user typed (camelCase is kept as typed)', () => {
  assert.equal(
    formatListLine(FORMAT, game('PS', 'Hercules.img', 'Hercules', 'hercules')),
    'PS/Hercules.img|Hercules|HERCULES|hercules|HERCULES',
  );
  assert.equal(
    formatListLine(FORMAT, game('PCE', 'Dai Makai-Mura.zip', 'Dai Makai-Mura', 'daiMakaiMura')),
    'PCE/Dai Makai-Mura.zip|Dai Makai-Mura|DAI MAKAI-MURA|daiMakaiMura|DAIMAKAIMURA',
  );
});

test('short names: the title when there is none; camelCase rules; a camelCase name stays as typed', () => {
  assert.equal(listShortName('', 'Parasite Eve II'), 'parasiteEveIi');
  assert.equal(listShortName('   ', 'Dai Makai-Mura'), 'daiMakaiMura');
  assert.equal(listShortName('daiMakaiMura', 'Anything'), 'daiMakaiMura');
  assert.equal(listShortName('ffVII', 'Final Fantasy VII'), 'ffVII', 'kept exactly, including the capitals');
  assert.equal(listShortName('Super Mario', 'x'), 'superMario', 'a short name with spaces is converted');
  assert.equal(listShortName('MARIO-KART', 'x'), 'marioKart');
  assert.equal(listShortName('', 'Tom & Jerry'), 'tomJerry', 'punctuation is dropped, as for the CSV short names');
  assert.equal(listShortName('', 'Покемон Голд'), 'покемонГолд');
});

test('fields: path with / everywhere, upper case keeps spaces and signs', () => {
  assert.deepEqual(listFields(game('GBA', 'sub\\Metroid: Fusion.gba', 'Metroid: Fusion')), {
    path: 'GBA/sub/Metroid: Fusion.gba',
    title: 'Metroid: Fusion',
    titleUpper: 'METROID: FUSION',
    short: 'metroidFusion',
    shortUpper: 'METROIDFUSION',
  });
  assert.equal(formatListLine(FORMAT, game('GBA', 'A.gba', 'A|B')), null, 'the separator cannot be written');
});

test('lines that cannot be read have no path and are never changed', () => {
  assert.equal(linePath('PS/A.img|A|A|a|A', FORMAT), 'PS/A.img');
  assert.equal(linePath('garbage', FORMAT), null);
  assert.equal(linePath('PS/A.img|A|A', FORMAT), null);
  const lines = ['garbage', 'PS/A.img|A', 'PS/B.img|B|B|b|B'];
  const result = editList(lines, FORMAT, { kind: 'remove', paths: ['PS/A.img', 'PS/B.img'] });
  assert.deepEqual(result.lines, ['garbage', 'PS/A.img|A']);
  assert.equal(result.removed, 1);
});

test('put: a rename updates the line in place; an add appends only to the main list', () => {
  const lines = ['PS/A.img|A|A|a|A', 'PS/Old.img|Old|OLD|old|OLD', 'PS/C.img|C|C|c|C'];
  const renamed = editList(lines, FORMAT, { kind: 'put', oldPath: 'PS/Old.img', game: game('PS', 'New Name.img', 'New Name'), add: false });
  assert.deepEqual(renamed.lines, ['PS/A.img|A|A|a|A', 'PS/New Name.img|New Name|NEW NAME|newName|NEWNAME', 'PS/C.img|C|C|c|C']);
  assert.equal(renamed.updated, 1);
  const notThere = editList(lines, FORMAT, { kind: 'put', oldPath: 'PS/X.img', game: game('PS', 'Y.img', 'Y'), add: false });
  assert.deepEqual(notThere.lines, lines, 'a list without the game (favorites) is left alone');
  const added = editList(lines, FORMAT, { kind: 'put', game: game('PS', 'D.img', 'D'), add: true });
  assert.deepEqual(added.lines.at(-1), 'PS/D.img|D|D|d|D');
  assert.equal(added.added, 1);
  const shortChanged = editList(lines, FORMAT, { kind: 'put', game: game('PS', 'C.img', 'C', 'cee'), add: false });
  assert.equal(shortChanged.lines[2], 'PS/C.img|C|C|cee|CEE', 'fields 4 and 5 follow the short name');
  assert.equal(editList(lines, FORMAT, { kind: 'put', game: game('PS', 'A.img', 'A'), add: true }).added, 0, 'never twice');
});

test('paths are compared exactly', () => {
  const lines = ['PS/a.img|a|A|a|A'];
  assert.deepEqual(editList(lines, FORMAT, { kind: 'remove', paths: ['PS/A.img', 'ps/a.img'] }).lines, lines);
});

test('sync: lines of gone games of the platform go, missing games are added, other platforms stay; an extension change keeps the line', () => {
  const lines = [
    'GBA/Gone.gba|Gone|GONE|gone|GONE',
    'PS/Keep.img|Keep|KEEP|keep|KEEP',
    'GBA/Keep.gba|Keep|KEEP|keepIt|KEEPIT',
    'GBA/Zipped.gba|Zipped|ZIPPED|zipped|ZIPPED',
    'broken line',
  ];
  const games = [game('GBA', 'Keep.gba', 'Keep Renamed'), game('GBA', 'Zipped.zip', 'Zipped'), game('GBA', 'New.gba', 'New')];
  const main = editList(lines, FORMAT, { kind: 'sync', platform: 'GBA', games, add: true });
  assert.deepEqual(main.lines, [
    'PS/Keep.img|Keep|KEEP|keep|KEEP',
    'GBA/Keep.gba|Keep|KEEP|keepIt|KEEPIT',
    'GBA/Zipped.zip|Zipped|ZIPPED|zipped|ZIPPED',
    'broken line',
    'GBA/New.gba|New|NEW|new|NEW',
  ]);
  assert.deepEqual([main.added, main.removed, main.updated], [1, 1, 1]);
  const favorites = editList(lines, FORMAT, { kind: 'sync', platform: 'GBA', games, add: false });
  assert.equal(favorites.added, 0, 'favorites and recent only lose lines');
  assert.ok(favorites.lines.includes('GBA/Zipped.zip|Zipped|ZIPPED|zipped|ZIPPED'), 'and follow an extension change');
});

const decoded = (bytes: Uint8Array): ListDocument => {
  const read = decodeList(bytes);
  assert.ok('doc' in read, JSON.stringify(read));
  return read.doc;
};

test('UTF-8 is written back as it was: no byte order mark is added, one is kept; line ends and the final break too', () => {
  for (const text of [
    'PS/Покемон.img|Покемон|ПОКЕМОН|покемон|ПОКЕМОН\r\nPS/B.img|B|B|b|B\r\n',
    'PS/A.img|A|A|a|A\nPS/B.img|B|B|b|B',
    '﻿PS/A.img|A|A|a|A\n',
  ]) {
    const bytes = Buffer.from(text, 'utf8');
    const doc = decoded(bytes);
    assert.equal(doc.encoding, 'utf8');
    assert.deepEqual(encodeList(doc), bytes, JSON.stringify(text));
  }
  const noBom = decoded(Buffer.from('PS/A.img|A|A|a|A\n'));
  assert.equal(noBom.bom, false);
  assert.notEqual(encodeList({ ...noBom, lines: [...noBom.lines, 'PS/Ä.img|Ä|Ä|ä|Ä'] })?.[0], 0xef, 'still no BOM after a change');
});

test('encoding: a byte order mark decides, UTF-8 otherwise', () => {
  assert.deepEqual(listEncoding(Buffer.from('PS/A.img|A|A|a|A\n')), { encoding: 'utf8', bom: false });
  assert.deepEqual(listEncoding(Buffer.from('\ufeffx', 'utf8')), { encoding: 'utf8', bom: true });
  assert.deepEqual(listEncoding(Buffer.from([0xff, 0xfe, 0x78, 0x00])), { encoding: 'utf-16le', bom: true });
  assert.deepEqual(listEncoding(Buffer.from([0xfe, 0xff, 0x00, 0x78])), { encoding: 'utf-16be', bom: true });
  assert.deepEqual(listEncoding(Buffer.from('PS/\u00c4.img|\u00c4|\u00c4|\u00e4|\u00c4\n', 'utf8')), { encoding: 'utf8', bom: false });
});

test('a list that does not read cleanly as UTF-8 (replacement characters) is reported, never changed', () => {
  const russian = ['Покемон Голд', 'Другая игра', 'Танчики'].map((n) => `PS/${n}.img|${n}|${n.toUpperCase()}|x|X`).join('\r\n') + '\r\n';
  assert.deepEqual(decodeList(iconv.encode(russian, 'windows-1251')), { problem: { kind: 'undecodable', encoding: 'utf8' } });
  const chinese = ['仙剑奇侠传', '三国志', '超级马里奥兄弟', '魂斗罗', '双截龙'].map((n) => `FC/${n}.nes|${n}|${n}|x|X`).join('\n') + '\n';
  assert.deepEqual(decodeList(iconv.encode(chinese, 'gb18030')), { problem: { kind: 'undecodable', encoding: 'utf8' } });
  assert.ok('doc' in decodeList(Buffer.from([0x50, 0x53, 0x00, 0x41, 0x0a])), 'a NUL byte is text in UTF-8');
  assert.deepEqual(decodeList(Buffer.from('PS/\ufffd.img|x|X|x|X\n', 'utf8')), { problem: { kind: 'undecodable', encoding: 'utf8' } });
  assert.deepEqual(decodeList(Buffer.from('PS/x.img|\ufffd|X|x|X\n', 'utf8')), { problem: { kind: 'undecodable', encoding: 'utf8' } });
  assert.deepEqual(decodeList(Buffer.from('PS/x.img|x\ufffd|X\n', 'utf8')), { problem: { kind: 'undecodable', encoding: 'utf8' } });
});

test('broken bytes only in the short names of a full line (Chinese firmware) do not block the list', () => {
  const head = Buffer.from('FC/Donkey Kong (USA).zip|Donkey Kong (USA)|DONKEY KONG (USA)|大金刚（美）|DJG', 'utf8');
  const line = Buffer.concat([head, Buffer.from([0xff, 0xfe]), Buffer.from('M\nFC/b.zip|b|B|b|B\n', 'utf8')]);
  const doc = decoded(line);
  assert.equal(doc.lines.length, 2);
  assert.equal(doc.lines[1], 'FC/b.zip|b|B|b|B');
});

test('UTF-16 with its byte order mark; a new title the encoding cannot hold is not written', () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('PS/Ä.img|Ä|Ä|ä|Ä\r\n', 'utf16le')]);
  const doc16 = decoded(utf16);
  assert.equal(doc16.encoding, 'utf-16le');
  assert.deepEqual(encodeList(doc16), utf16);
  const utf16be = Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode('PS/仙剑.img|仙剑|仙剑|x|X\n', 'utf-16be')]);
  const doc16be = decoded(utf16be);
  assert.deepEqual([doc16be.encoding, doc16be.lines[0]], ['utf-16be', 'PS/仙剑.img|仙剑|仙剑|x|X']);
  assert.deepEqual(encodeList(doc16be), utf16be);
  const latin = { lines: ['PS/A.img|A|A|a|A'], eol: '\n' as const, finalEol: true, encoding: 'windows-1252', bom: false };
  assert.equal(encodeList({ ...latin, lines: [...latin.lines, 'PS/仙剑.img|仙剑|仙剑|x|X'] }), null);
});

test('a new list: UTF-8 without a byte order mark, LF', () => {
  const doc = newListDocument();
  assert.deepEqual(encodeList({ ...doc, lines: ['PS/A.img|A|A|a|A'] }), Buffer.from('PS/A.img|A|A|a|A\n'));
  assert.deepEqual(decoded(Buffer.alloc(0)).lines, []);
});
