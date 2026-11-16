import '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Request } from 'express';
import { currentLang, langOf, LANGS, runWithLang, setFallbackLang, t } from '../../src/i18n/index.ts';
import { matchLang } from '../../shared/constants.ts';
import { cs } from '../../src/i18n/cs.ts';
import { de } from '../../src/i18n/de.ts';
import { es } from '../../src/i18n/es.ts';
import { fr } from '../../src/i18n/fr.ts';
import { it } from '../../src/i18n/it.ts';
import { ja } from '../../src/i18n/ja.ts';
import { kk } from '../../src/i18n/kk.ts';
import { ko } from '../../src/i18n/ko.ts';
import { pl } from '../../src/i18n/pl.ts';
import { ru } from '../../src/i18n/ru.ts';
import { uk } from '../../src/i18n/uk.ts';
import { zhCN } from '../../src/i18n/zhCN.ts';

/** Every server dictionary by language code (English has none: the keys are the English texts). */
const DICTIONARIES: Record<string, Readonly<Record<string, string>>> = { uk, ru, de, pl, es, fr, it, ja, 'zh-CN': zhCN, ko, cs, kk };
/** Messages that are the same in another language: a format name, an international word. */
const SAME_AS_ENGLISH: Record<string, readonly string[]> = {
  de: ['Emulator'],
  pl: ['Emulator'],
  fr: ['Images', 'Image', 'Applications', 'tags'],
  it: ['File', '; backup: {backupPath}'],
};

/** Languages written in Cyrillic: every translation of a real sentence must contain it. The others must not. */
const CYRILLIC_LANGS = ['ru', 'uk', 'kk'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The desktop shell (electron/) shows a few server-language messages through the same dictionaries.
const sourceDirs = [path.join(root, 'src'), path.join(root, 'electron')];
const CYR = /[Ѐ-ӿ]/;
const placeholders = (text: string): string => (text.match(/\{(\w+)\}/g) ?? []).sort().join(',');

/** Source files that use the message dictionaries (the server and the desktop shell), except the dictionaries themselves. */
function sources(): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) {
        if (name !== 'i18n') walk(file);
      } else if (file.endsWith('.ts')) out.push(file);
    }
  }
  for (const dir of sourceDirs) walk(dir);
  return out;
}

/** Every key used in `t('…')` calls (keys are single-quoted English texts). */
function usedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of sources()) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*'((?:[^'\\\n]|\\.)*)'/g)) {
      keys.add((match[1] ?? '').replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\n/g, '\n'));
    }
  }
  return keys;
}

test('server: every message key has a translation in every language with the same placeholders', () => {
  const keys = usedKeys();
  assert.ok(keys.size > 100, `keys found: ${keys.size}`);
  for (const key of keys) {
    for (const [name, dictionary] of Object.entries(DICTIONARIES)) {
      const text = dictionary[key];
      assert.ok(text?.trim(), `no ${name} translation: ${key}`);
      assert.equal(placeholders(text ?? ''), placeholders(key), `placeholders in ${name}: ${key}`);
      if (CYRILLIC_LANGS.includes(name)) {
        assert.ok(CYR.test(text ?? '') || !/[A-Za-z]{4}/.test(key), `${name} translation looks untranslated: ${key}`);
      } else {
        assert.ok(!CYR.test(text ?? ''), `Cyrillic in the ${name} translation: ${key}`);
        assert.ok(
          text !== key || !/[A-Za-z]{4}/.test(key) || SAME_AS_ENGLISH[name]?.includes(key),
          `${name} translation looks untranslated: ${key}`,
        );
      }
      // The text takes the place of the key, so the spaces that glue message parts together are kept.
      if (name !== 'ja' && name !== 'zh-CN') assert.equal(/^ /.test(text ?? ''), /^ /.test(key), `leading space in ${name}: ${key}`);
    }
    assert.ok(!CYR.test(key), `the English key contains Cyrillic: ${key}`);
  }
});

test('server: dictionaries have no unused entries', () => {
  const keys = usedKeys();
  for (const [name, dictionary] of Object.entries(DICTIONARIES)) {
    assert.deepEqual(
      Object.keys(dictionary).filter((key) => !keys.has(key)),
      [],
      name,
    );
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(ru).sort(), name);
  }
});

test('server: source code is in English (no Cyrillic outside the dictionaries)', () => {
  const bad: string[] = [];
  for (const file of sources()) {
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (CYR.test(line)) bad.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(bad, []);
});

test('the default language is English; the language of a request is visible through the async chain', async () => {
  assert.deepEqual(LANGS, ['en', 'uk', 'ru', 'de', 'pl', 'es', 'fr', 'it', 'ja', 'zh-CN', 'ko', 'cs', 'kk']);
  assert.deepEqual(Object.keys(DICTIONARIES).sort(), LANGS.filter((lang) => lang !== 'en').sort());
  assert.equal(currentLang(), 'en');
  assert.equal(t('No file selected'), 'No file selected');
  await runWithLang('uk', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(t('No file selected'), 'Файл не вибрано');
  });
  runWithLang('ru', () => assert.equal(t('No file selected'), 'Файл не выбран'));
  runWithLang('de', () => assert.equal(t('No file selected'), 'Keine Datei ausgewählt'));
  runWithLang('zh-CN', () => assert.equal(t('No file selected'), '未选择文件'));
  runWithLang('cs', () => assert.equal(t('No file selected'), 'Není vybrán žádný soubor'));
  runWithLang('kk', () => assert.equal(t('No file selected'), 'Файл таңдалмаған'));
  runWithLang('xx', () => assert.equal(currentLang(), 'en')); // an unknown language falls back to the default
  runWithLang('auto', () => assert.equal(currentLang(), 'en')); // nothing chosen yet: the fallback language
});

test('placeholders are filled, unknown ones are left as they are', () => {
  runWithLang('en', () =>
    assert.equal(
      t('Platform “{name}” was not found on the memory card', { name: 'GBA' }),
      'Platform “GBA” was not found on the memory card',
    ),
  );
  runWithLang('uk', () => assert.ok(t('Platform “{name}” was not found on the memory card', { name: 'GBA' }).includes('GBA')));
  assert.equal(t('Hello {who}', { other: 1 }), 'Hello {who}');
});

test('langOf takes the language from the X-Lang header', () => {
  const of = (header: string | undefined): string => langOf({ headers: header ? { 'x-lang': header } : {} } as unknown as Request);
  assert.equal(of('uk'), 'uk');
  assert.equal(of('RU'), 'ru');
  assert.equal(of('de'), 'de');
  assert.equal(of('zh-cn'), 'zh-CN', 'header values are matched without regard to case');
  assert.equal(of('ZH-CN'), 'zh-CN');
  assert.equal(of('KK'), 'kk');
  assert.equal(of('cs'), 'cs');
  assert.equal(of('xx'), 'en');
  assert.equal(of(undefined), 'en');
  setFallbackLang('en');
});

test('matchLang picks the first preferred system language that has a dictionary, otherwise English', () => {
  assert.equal(matchLang(['de-AT', 'en-US']), 'de');
  assert.equal(matchLang(['pt-BR', 'fr-CA', 'en']), 'fr', 'an unsupported language is skipped');
  assert.equal(matchLang(['ja']), 'ja');
  assert.equal(matchLang(['ko_KR']), 'ko', 'POSIX spelling');
  assert.equal(matchLang(['zh-CN']), 'zh-CN');
  assert.equal(matchLang(['zh']), 'zh-CN');
  assert.equal(matchLang(['zh-Hans-SG']), 'zh-CN');
  assert.equal(matchLang(['zh-TW', 'en']), 'en', 'Traditional Chinese is not served by the Simplified dictionary');
  assert.equal(matchLang(['zh-Hant-HK']), 'en');
  assert.equal(matchLang(['uk-UA', 'ru-RU']), 'uk');
  assert.equal(matchLang(['kk-KZ', 'ru-RU']), 'kk', 'Kazakh system: Kazakh on the first start');
  assert.equal(matchLang(['kk_KZ']), 'kk');
  assert.equal(matchLang(['cs-CZ', 'en']), 'cs', 'Czech system: Czech on the first start');
  assert.equal(matchLang(['cs']), 'cs');
  assert.equal(matchLang(['sk-SK', 'en']), 'en', 'Slovak is not served by the Czech dictionary');
  assert.equal(matchLang(['en-GB', 'de']), 'en', 'English first stays English');
  assert.equal(matchLang(['pt-BR']), 'en');
  assert.equal(matchLang([]), 'en');
  assert.equal(matchLang(['', 'it']), 'it');
});
