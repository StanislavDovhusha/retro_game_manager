import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LANGS } from '../../shared/constants.ts';
import {
  DONATE_KINDS,
  DONATE_TEXTS_PER_KIND,
  DONATE_THRESHOLD_MAX,
  DONATE_THRESHOLD_MIN,
  advanceCursor,
  DONATE_LAUNCH_INTERVAL_MS,
  DONATE_LAUNCH_MIN_DAYS,
  afterShown,
  countActions,
  defaultDonate,
  donateTextKey,
  localDay,
  normalizeDonate,
  pickThreshold,
  randomInt,
  registerLaunch,
  startCursor,
  type DonateCursor,
  type Random,
} from '../../shared/donate.ts';

/** A random source that returns the given values one after another. */
const sequence =
  (...values: number[]): Random =>
  () =>
    values.shift() ?? 0;

test('threshold: always from 8 to 10, every value is possible', () => {
  assert.equal(
    pickThreshold(() => 0),
    DONATE_THRESHOLD_MIN,
  );
  assert.equal(
    pickThreshold(() => 0.999999),
    DONATE_THRESHOLD_MAX,
  );
  assert.equal(
    randomInt(() => 1, 8, 10),
    10,
    'a random source that returns exactly 1 stays inside the range',
  );
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i += 1) seen.add(pickThreshold(Math.random));
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [8, 9, 10],
  );
});

test('counting: the popup is due when the chosen threshold is reached, not earlier', () => {
  let state = { ...defaultDonate(), threshold: 9 };
  for (let done = 1; done <= 8; done += 1) {
    const result = countActions(state, 1, () => 0);
    state = result.state;
    assert.equal(result.due, false, `after ${done} actions`);
    assert.equal(state.counter, done);
  }
  const ninth = countActions(state, 1, () => 0);
  assert.equal(ninth.due, true);
  assert.equal(ninth.state.counter, 9);
});

test('counting: the first count chooses a threshold in range and keeps it', () => {
  const first = countActions(defaultDonate(), 1, sequence(0.5));
  assert.equal(first.state.threshold, 9);
  assert.equal(first.due, false);
  const second = countActions(first.state, 1, () => 0);
  assert.equal(second.state.threshold, 9, 'the threshold does not change between actions');
});

test('a batch counts every game but asks for the popup once; showing resets the counter and picks a new threshold', () => {
  const state = { ...defaultDonate(), counter: 3, threshold: 8 };
  const batch = countActions(state, 12, () => 0);
  assert.equal(batch.state.counter, 15, 'every game of the batch is counted');
  assert.equal(batch.due, true, 'and the popup is due (one boolean: one popup)');
  const after = afterShown(batch.state, sequence(0.99), 1234);
  assert.deepEqual(after, { ...defaultDonate(), counter: 0, threshold: 10, lastShownAt: 1234 });
  assert.equal(countActions(after, 1, () => 0).due, false);
});

test('while the automatic popup is switched off nothing is counted and nothing is due', () => {
  const off = { ...defaultDonate(), autoShow: false, counter: 2, threshold: 8 };
  const result = countActions(off, 10, () => 0);
  assert.equal(result.due, false);
  assert.deepEqual(result.state, off);
  assert.equal(countActions(defaultDonate(), 0, () => 0).due, false);
  assert.equal(countActions(defaultDonate(), -3, () => 0).due, false);
  assert.equal(countActions(defaultDonate(), Number.NaN, () => 0).due, false);
});

test('normalizeDonate repairs damaged settings and keeps good ones', () => {
  assert.deepEqual(normalizeDonate(undefined), defaultDonate());
  assert.deepEqual(normalizeDonate('x'), defaultDonate());
  const d = defaultDonate();
  assert.deepEqual(normalizeDonate({ autoShow: false, counter: 3, threshold: 9 }), { ...d, autoShow: false, counter: 3, threshold: 9 });
  // A threshold saved by an older version (4–8 added games) is out of range: a new one is chosen at the next count.
  assert.deepEqual(normalizeDonate({ autoShow: true, counter: 2, threshold: 5 }), { ...d, autoShow: true, counter: 2, threshold: 0 });
  assert.deepEqual(normalizeDonate({ autoShow: 'yes', counter: -4, threshold: 99 }), { ...d, autoShow: true, counter: 0, threshold: 0 });
  assert.deepEqual(normalizeDonate({ counter: 2.7, threshold: 4.5 }), { ...d, autoShow: true, counter: 2, threshold: 0 });
  const kept = { firstLaunch: '2026-11-01', usageDays: 5, lastUsageDay: '2026-11-10', lastShownAt: 1_700_000_000_000 };
  assert.deepEqual(normalizeDonate(kept), { ...d, ...kept });
  assert.deepEqual(normalizeDonate({ firstLaunch: 'yesterday', usageDays: -2, lastUsageDay: 5, lastShownAt: 'x' }), d);
  assert.equal(normalizeDonate({ counter: Number.POSITIVE_INFINITY }).counter, 0);
});

const at = (day: string, hour = 12): Date => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const off = (): ReturnType<typeof defaultDonate> => ({ ...defaultDonate(), autoShow: false });

test('launches: the first start and each calendar day of use are recorded once', () => {
  assert.equal(localDay(at('2026-01-05', 0)), '2026-01-05', 'the local day, not UTC');
  let state = registerLaunch(defaultDonate(), at('2026-03-01', 9)).state;
  assert.deepEqual([state.firstLaunch, state.usageDays, state.lastUsageDay], ['2026-03-01', 1, '2026-03-01']);
  const again = registerLaunch(state, at('2026-03-01', 23));
  assert.equal(again.state, state, 'a second start on the same day changes nothing');
  state = registerLaunch(state, at('2026-03-05', 8)).state;
  assert.deepEqual(
    [state.firstLaunch, state.usageDays, state.lastUsageDay],
    ['2026-03-01', 2, '2026-03-05'],
    'days without a start do not count',
  );
});

test('launch reminder: only with the automatic popup off, after more than 3 days of use, at most once in 24 hours', () => {
  assert.equal(DONATE_LAUNCH_MIN_DAYS, 3);
  let state = off();
  const dues: boolean[] = [];
  for (const day of ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04']) {
    const result = registerLaunch(state, at(day));
    state = result.state;
    dues.push(result.due);
  }
  assert.deepEqual(dues, [false, false, false, true], 'the reminder starts on the 4th day of use');

  const shownAt = at('2026-04-04').getTime();
  state = afterShown(state, () => 0, shownAt);
  assert.equal(registerLaunch(state, at('2026-04-04', 18)).due, false, 'not again the same day');
  assert.equal(registerLaunch(state, new Date(shownAt + DONATE_LAUNCH_INTERVAL_MS - 60_000)).due, false, 'not within 24 hours');
  assert.equal(registerLaunch(state, new Date(shownAt + DONATE_LAUNCH_INTERVAL_MS)).due, true, 'again after 24 hours');
  assert.equal(
    registerLaunch({ ...state, lastShownAt: shownAt * 2 }, at('2026-04-06')).due,
    true,
    'a last show in the future does not block it',
  );

  assert.equal(
    registerLaunch({ ...state, autoShow: true }, at('2026-04-09')).due,
    false,
    'with the automatic popup on, the action counter decides',
  );
});

test('texts: random start, then the kinds alternate beer → development → beer …', () => {
  const kinds = (random: Random, steps: number): string[] => {
    let cursor = startCursor(random);
    const out = [cursor.kind];
    for (let i = 1; i < steps; i += 1) {
      cursor = advanceCursor(cursor);
      out.push(cursor.kind);
    }
    return out;
  };
  assert.deepEqual(kinds(sequence(0, 0, 0), 5), ['beer', 'dev', 'beer', 'dev', 'beer']);
  assert.deepEqual(kinds(sequence(0.99, 0, 0), 4), ['dev', 'beer', 'dev', 'beer']);
});

test('texts: every start is random over all eight texts, and none is skipped or repeated within a cycle', () => {
  const starts = new Set<string>();
  for (let i = 0; i < 3000; i += 1) starts.add(donateTextKey(startCursor(Math.random)));
  assert.equal(starts.size, DONATE_KINDS.length * DONATE_TEXTS_PER_KIND);

  const random = sequence(0, 0.5, 0.25); // starts with beer text #3, the development texts start at #2
  let cursor: DonateCursor = startCursor(random);
  const keys = [donateTextKey(cursor)];
  for (let i = 0; i < 7; i += 1) {
    cursor = advanceCursor(cursor);
    keys.push(donateTextKey(cursor));
  }
  assert.deepEqual(keys, [
    'donate.beer.3',
    'donate.dev.2',
    'donate.beer.4',
    'donate.dev.3',
    'donate.beer.1',
    'donate.dev.4',
    'donate.beer.2',
    'donate.dev.1',
  ]);
  assert.equal(new Set(keys).size, 8, 'all eight texts appear before any repeats');
});

test('the client dictionaries have all eight texts and the labels in every language (no placeholders, all are translated)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dict = (lang: string): { donate: Record<string, unknown> } =>
    JSON.parse(fs.readFileSync(path.join(root, `client/public/i18n/${lang}.json`), 'utf8'));
  for (const lang of LANGS) {
    const donate = dict(lang).donate as Record<string, Record<string, string>>;
    for (const kind of DONATE_KINDS) {
      assert.deepEqual(Object.keys(donate[kind] ?? {}).sort(), ['1', '2', '3', '4'], `${lang}: ${kind}`);
      assert.ok(donate['kinds']?.[kind], `${lang}: kind label ${kind}`);
    }
    for (const id of ['kofi', 'github']) assert.ok(donate['links']?.[id], `${lang}: label ${id}`);
    assert.equal(donate['requisites'], undefined, `${lang}: card, Monobank and PayPal are gone`);
  }
  const en = dict('en').donate as Record<string, Record<string, string>>;
  for (const lang of LANGS.filter((code) => code !== 'en')) {
    const other = dict(lang).donate as Record<string, Record<string, string>>;
    for (const kind of DONATE_KINDS)
      for (const n of ['1', '2', '3', '4']) assert.notEqual(other[kind]?.[n], en[kind]?.[n], `${lang}: ${kind}.${n} is not translated`);
  }
});
