import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanTitle, hasUnsupportedChars, stripUnsupportedChars } from '../../shared/gameName.ts';
import { normalizeShort } from '../../src/services/entryService.ts';
import { normalizeTitle } from '../../src/utils/text.ts';
import { isAppError } from '../helpers/fs.ts';

// Titles and short names: English letters, digits, spaces and - _ ( ) [ ] . & # : only.
const ALLOWED = [
  'Super Mario World',
  'Mega Man 2',
  'Contra - Hard Corps',
  'Final_Fantasy_VII',
  'Zelda (USA) [Rev 1]',
  'R-Type III',
  '1942',
  'Mario: Odyssey',
  'Dr. Mario',
  'Tom & Jerry',
  'Street Fighter #2',
  'Vol. 2: The Return (USA) [b1] - Disc #1 & 2',
];
const REFUSED = [
  'Ёжик в тумане',
  'Покемон',
  'ドラゴンクエスト',
  '仙剑奇侠传',
  '젤다의 전설',
  'Pokémon',
  "Link's Awakening",
  'Mario!',
  'Who? / What',
  'A|B',
  'Game 🎮',
];

test('Latin letters, digits, spaces, hyphens, underscores and brackets are allowed', () => {
  for (const title of ALLOWED) {
    assert.equal(hasUnsupportedChars(title), false, title);
    assert.equal(normalizeTitle(title), title, title);
  }
});

test('Cyrillic, Japanese, Chinese, Korean, accents and other signs are refused by the server', () => {
  const validation = isAppError(400, 'VALIDATION_ERROR');
  for (const title of REFUSED) {
    assert.equal(hasUnsupportedChars(title), true, title);
    assert.throws(() => normalizeTitle(title), validation, title);
  }
});

test('short names: the same characters, still without spaces', () => {
  for (const short of ['mario', 'megaMan2', 'final_fantasy-7', 'zelda(usa)[1]', 'dr.mario', 'tom&jerry', 'sf#2', 'mario:odyssey']) {
    assert.equal(normalizeShort(short), short);
  }
  const validation = isAppError(400, 'VALIDATION_ERROR');
  for (const short of ['ёжик', 'ドラクエ', 'pokémon', 'mario!', 'a|b']) assert.throws(() => normalizeShort(short), validation, short);
  assert.throws(() => normalizeShort('mega man'), validation, 'a space is still refused');
});

test('typing and pasting: what is not allowed is removed (accents first lose their mark), spaces are kept', () => {
  assert.equal(stripUnsupportedChars('Pokémon Gold'), 'Pokemon Gold');
  assert.equal(stripUnsupportedChars('Mario: Odyssey!'), 'Mario: Odyssey');
  assert.equal(stripUnsupportedChars('Dr. Mario & Luigi #2?'), 'Dr. Mario & Luigi #2');
  assert.equal(stripUnsupportedChars('Ёжик'), '', 'Cyrillic is removed');
  assert.equal(stripUnsupportedChars('ドラゴンクエスト'), '', 'only unsupported characters: nothing is left');
  assert.equal(stripUnsupportedChars('Tab\there '), 'Tab here ', 'whitespace becomes a space, trailing spaces stay while typing');
  assert.equal(stripUnsupportedChars('Zelda (USA) [Rev 1]_x-y'), 'Zelda (USA) [Rev 1]_x-y');
});

test('a title made from a file name keeps only the allowed characters', () => {
  assert.equal(cleanTitle('Pokémon Gold (日本)'), 'Pokemon Gold ()');
  assert.equal(cleanTitle('Super Mario Bros. 3'), 'Super Mario Bros. 3');
  assert.equal(cleanTitle("Zelda: Link's Awakening DX"), 'Zelda: Links Awakening DX');
  assert.equal(cleanTitle('  Final   Fantasy  '), 'Final Fantasy');
  assert.equal(cleanTitle('ゼルダの伝説'), '');
});
