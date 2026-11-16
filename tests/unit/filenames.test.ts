import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTitle, toCamelCase, toSafeFileName } from '../../src/utils/text.ts';
import { isAppError } from '../helpers/fs.ts';

test('toSafeFileName replaces characters that are invalid on Windows or Unix', () => {
  assert.equal(toSafeFileName("Zelda: Link's Awakening"), "Zelda Link's Awakening");
  assert.equal(toSafeFileName('AC/DC <Live>?'), 'AC DC Live');
  assert.equal(toSafeFileName('a\\b|c*d"e'), 'a b c d e');
  assert.equal(toSafeFileName('tab\there\u0000nul'), 'tab here nul');
});

test('toSafeFileName strips leading and trailing dots and spaces', () => {
  assert.equal(toSafeFileName('  ..hack.. '), 'hack');
  assert.equal(toSafeFileName('.hidden'), 'hidden');
  assert.equal(toSafeFileName('name.'), 'name');
});

test('toSafeFileName cannot produce a path (no separators, never "." or "..")', () => {
  for (const evil of ['../../etc/passwd', '..\\..\\windows', '/absolute/path', 'a/../b']) {
    const name = toSafeFileName(evil);
    assert.ok(!/[\\/]/.test(name), `${evil} -> ${name}`);
    assert.ok(name !== '.' && name !== '..' && !name.startsWith('.'), `${evil} -> ${name}`);
  }
});

test('toSafeFileName avoids reserved Windows device names', () => {
  for (const reserved of ['CON', 'nul', 'COM1', 'lpt9']) assert.equal(toSafeFileName(reserved), `_${reserved}`);
  assert.equal(toSafeFileName('CONSOLE'), 'CONSOLE');
});

test('toSafeFileName keeps non-Latin letters, limits the length and reports unusable titles as empty', () => {
  assert.equal(toSafeFileName('Кот и Пёс'), 'Кот и Пёс');
  assert.ok(toSafeFileName('x'.repeat(400)).length <= 150);
  assert.equal(toSafeFileName('???'), '');
  assert.equal(toSafeFileName(null), '');
});

test('toCamelCase builds the short title', () => {
  assert.equal(toCamelCase('The Legend of Zelda'), 'theLegendOfZelda');
  assert.equal(toCamelCase('Super Mario Bros. 3 (USA) [!]'), 'superMarioBros3Usa');
  assert.equal(toCamelCase("Zelda: Link's Awakening"), 'zeldaLinksAwakening');
  assert.equal(toCamelCase('Кот и Пёс'), 'котИПёс');
  assert.equal(toCamelCase('  '), '');
});

test('normalizeTitle collapses whitespace and rejects unusable titles', () => {
  assert.equal(normalizeTitle('  Super   Mario  '), 'Super Mario');
  const validation = isAppError(400, 'VALIDATION_ERROR');
  assert.throws(() => normalizeTitle('   '), validation);
  assert.throws(() => normalizeTitle('???'), validation);
  assert.throws(() => normalizeTitle('x'.repeat(201)), validation);
  assert.throws(() => normalizeTitle('bad\u0007title'), validation);
});
