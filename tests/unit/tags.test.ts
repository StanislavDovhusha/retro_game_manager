import assert from 'node:assert/strict';
import test from 'node:test';
import { findInvalidTag, formatTags, MAX_TAG_LENGTH, normalizeTags, parseTags } from '../../shared/tags.ts';

test('parseTags: split on any whitespace, trim, drop empty tags and duplicates', () => {
  assert.deepEqual(parseTags('  rpg   action\tsnes   rpg  '), ['rpg', 'action', 'snes']);
  assert.deepEqual(parseTags(''), []);
  assert.deepEqual(parseTags('   '), []);
});

test('normalizeTags keeps the order, the first duplicate stays, the case matters', () => {
  assert.deepEqual(normalizeTags([' b ', 'a', 'b', '', 'A']), ['b', 'a', 'A']);
});

test('formatTags writes the CSV cell', () => {
  assert.equal(formatTags(['rpg', 'rpg', ' snes ', '']), 'rpg snes');
  assert.equal(formatTags([]), '');
});

test('findInvalidTag: a space is forbidden, the length is limited', () => {
  assert.equal(findInvalidTag(['ok', 'also-ok']), null);
  assert.deepEqual(findInvalidTag(['ok', 'two words']), { tag: 'two words', reason: 'space' });
  assert.deepEqual(findInvalidTag(['a\tb']), { tag: 'a\tb', reason: 'space' });
  assert.equal(findInvalidTag(['x'.repeat(MAX_TAG_LENGTH + 1)])?.reason, 'length');
  assert.equal(findInvalidTag(['  padded  ']), null); // the edges are trimmed, not rejected
});
