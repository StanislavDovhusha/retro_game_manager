import '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LANGS } from '../../shared/constants.ts';
import { DONATE_KINDS } from '../../shared/donate.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CYR = /[\u0400-\u04ff]/;

/** Client dictionary flattened to `dotted.key → text` (the files are nested JSON). */
function clientDict(lang: string): Record<string, string> {
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(root, `client/public/i18n/${lang}.json`), 'utf8'));
  assert.ok(typeof raw === 'object' && raw !== null && !Array.isArray(raw), `${lang}.json: an object is expected`);
  const out: Record<string, string> = {};
  (function flatten(node: object, prefix: string): void {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object' && value !== null) flatten(value, `${prefix}${key}.`);
      else out[`${prefix}${key}`] = String(value);
    }
  })(raw, '');
  return out;
}

/** Client source files with templates and code (the dictionaries are checked separately). */
function clientFiles(): string[] {
  const out: string[] = [];
  (function walk(d: string): void {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|html|scss|css)$/.test(f)) out.push(p);
    }
  })(path.join(root, 'client/src'));
  return out;
}

/** String literals that are not translation keys although they look like `a.b`. */
const NOT_KEYS = new Set(['game-manager.lang', 'filelist.csv']);
const KEY_PATTERN = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/;

/**
 * Translation keys used by the client: every single-quoted literal like `'settings.title'` in templates and code,
 * plus the prefixes of dynamic keys (`'renameGame.kinds.' + kind`).
 */
function clientKeys(): { keys: Set<string>; prefixes: Set<string> } {
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  for (const p of clientFiles()) {
    if (!/\.(ts|html)$/.test(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) {
      const literal = m[1] ?? '';
      if (NOT_KEYS.has(literal)) continue;
      if (KEY_PATTERN.test(literal)) keys.add(literal);
      else if (/^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\.$/.test(literal)) prefixes.add(literal);
    }
  }
  // The popup texts are named by shared/donate.ts (`donate.<kind>.<n>`), not by a literal in the client code.
  for (const kind of DONATE_KINDS) prefixes.add(`donate.${kind}.`);
  return { keys, prefixes };
}
const clientPlaceholders = (s: string): string =>
  (s.match(/\{\{\s*(\w+)\s*\}\}/g) ?? [])
    .map((x) => x.replace(/[{}\s]/g, ''))
    .sort()
    .join(',');

test('client: every key used in the code exists in every language with the same placeholders', () => {
  const { keys, prefixes } = clientKeys();
  assert.ok(keys.size > 200, `keys found: ${keys.size}`);
  const dicts = Object.fromEntries(LANGS.map((lang) => [lang, clientDict(lang)])) as Record<(typeof LANGS)[number], Record<string, string>>;
  for (const k of keys) {
    // A key can be the base of a plural group: `plural.game` → `plural.game.one`, `.few`, …
    const resolved = k in dicts.en ? [k] : Object.keys(dicts.en).filter((key) => key.startsWith(`${k}.`));
    assert.ok(resolved.length > 0, `missing from en.json: ${k}`);
    for (const key of resolved) {
      for (const [name, dict] of Object.entries(dicts)) {
        assert.ok(key in dict, `missing from ${name}.json: ${key}`);
        assert.equal(clientPlaceholders(dict[key] ?? ''), clientPlaceholders(dicts.en[key] ?? ''), `placeholders in ${name}: ${key}`);
      }
    }
  }
  for (const prefix of prefixes) {
    assert.ok(
      Object.keys(dicts.en).some((key) => key.startsWith(prefix)),
      `dynamic key prefix without keys: ${prefix}`,
    );
  }
});

test('client: en.json is the primary dictionary — all other dictionaries have exactly its keys, and en has no Cyrillic', () => {
  const en = clientDict('en');
  assert.ok(Object.keys(en).length > 200);
  for (const lang of LANGS) {
    const dict = clientDict(lang);
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort(), `${lang}.json keys differ from en.json`);
    for (const [key, text] of Object.entries(dict)) {
      assert.ok(text.trim() !== '', `${lang}.json: empty text: ${key}`);
      assert.equal(clientPlaceholders(text), clientPlaceholders(en[key] ?? ''), `placeholders in ${lang}: ${key}`);
      // A single-brace `{name}` is the server's syntax: ngx-translate would print it as it is.
      assert.ok(!/(^|[^{])\{\w+\}(?!\})/.test(text), `${lang}.json: single-brace placeholder: ${key}`);
    }
  }
  for (const [k, v] of Object.entries(en)) assert.ok(!CYR.test(v), `Cyrillic in the English text: ${k}`);
  for (const k of Object.keys(en))
    assert.match(k, /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/, `the key is not an English dotted identifier: ${k}`);
});

test('client: every dictionary entry is used by the code', () => {
  const { keys, prefixes } = clientKeys();
  const unused = Object.keys(clientDict('en')).filter((key) => {
    if (keys.has(key)) return false;
    const group = key.split('.').slice(0, -1).join('.');
    if (keys.has(group)) return false; // plural group
    return ![...prefixes].some((prefix) => key.startsWith(prefix));
  });
  assert.deepEqual(unused, []);
});

test('client: Japanese, Chinese and Korean need no plural forms; Polish has all four', () => {
  for (const lang of ['ja', 'zh-CN', 'ko']) {
    const dict = clientDict(lang);
    const forms = new Set(['one', 'few', 'many', 'other'].map((form) => dict[`plural.game.${form}`]));
    assert.equal(forms.size, 1, `${lang}: one form for every count`);
    assert.equal(new Intl.PluralRules(lang).select(1), 'other');
  }
  const pl = clientDict('pl');
  const form = (count: number): string | undefined => pl[`plural.game.${new Intl.PluralRules('pl').select(count)}`];
  assert.deepEqual([form(1), form(2), form(5), form(22), form(25)], ['gra', 'gry', 'gier', 'gry', 'gier']);
});

test('client: Czech has one, few and other forms (many is for fractions); Kazakh keeps the noun singular after a number', () => {
  const cs = clientDict('cs');
  const czech = (count: number): string | undefined => cs[`plural.game.${new Intl.PluralRules('cs').select(count)}`];
  assert.deepEqual([czech(1), czech(2), czech(4), czech(5), czech(22), czech(1.5)], ['hra', 'hry', 'hry', 'her', 'her', 'hry']);
  const kk = clientDict('kk');
  assert.deepEqual([new Intl.PluralRules('kk').select(1), new Intl.PluralRules('kk').select(5)], ['one', 'other']);
  assert.equal(
    new Set(['one', 'few', 'many', 'other'].map((form) => kk[`plural.game.${form}`])).size,
    1,
    'kk: «5 ойын», not a plural form',
  );
});

test('client: Kazakh is written in Cyrillic', () => {
  const kk = clientDict('kk');
  // Every text with words has Kazakh in it (placeholders, program names and formats stay as they are).
  const latinOnly = Object.entries(kk).filter(([, text]) => /[A-Za-z]{4}/.test(text.replace(/\{\{\s*\w+\s*\}\}/g, '')) && !CYR.test(text));
  assert.deepEqual(latinOnly, []);
});

test('client: the dictionaries follow the typography of their languages', () => {
  // French: a no-break space before : ; ! ? and inside the guillemets.
  for (const [key, text] of Object.entries(clientDict('fr'))) {
    assert.ok(!/[^\s\u00a0\u202f][:;!?](\s|$)/.test(text), `fr: a no-break space is missing before the punctuation: ${key}: ${text}`);
    assert.ok(!/\u00ab(?!\u00a0)|(?<!\u00a0)\u00bb/.test(text), `fr: no-break spaces inside the guillemets: ${key}`);
  }
  // Japanese and Chinese use their own quotation marks and full-width punctuation, never the English curly quotes in Japanese.
  for (const [key, text] of Object.entries(clientDict('ja')))
    assert.ok(!/[\u201c\u201d\u00ab\u00bb]/.test(text), `ja: quotation marks: ${key}`);
  for (const lang of ['de', 'pl', 'es', 'fr', 'it', 'ja', 'zh-CN', 'ko', 'cs']) {
    for (const [key, text] of Object.entries(clientDict(lang))) assert.ok(!CYR.test(text), `${lang}: Cyrillic in the text: ${key}`);
  }
});

test('client: code, templates and styles are in English (the only Cyrillic is the language names in lang-meta.ts)', () => {
  const bad: string[] = [];
  for (const p of clientFiles()) {
    if (p.endsWith(path.join('core', 'i18n', 'lang-meta.ts'))) continue; // language names are written in the languages themselves
    fs.readFileSync(p, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (CYR.test(line)) bad.push(`${path.relative(root, p)}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(bad, []);
});
