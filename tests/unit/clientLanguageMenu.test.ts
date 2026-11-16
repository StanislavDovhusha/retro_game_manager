import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

type MenuGroup<T> = readonly T[];
type MenuGridColumn = readonly number[];
interface MenuLogic {
  splitIntoColumns<T>(groups: readonly MenuGroup<T>[], count: number): MenuGroup<T>[][];
  menuGrid(columns: readonly (readonly MenuGroup<unknown>[])[]): MenuGridColumn[];
  menuGridTarget(key: string, index: number, grid: readonly MenuGridColumn[]): number | null;
  menuTypeAhead(key: string, index: number, names: readonly string[]): number | null;
  menuColumnCount(viewportWidth: number, columns: number, minWidth: number): number;
  placeMenu(
    anchor: { left: number; right: number; bottom: number },
    menu: { width: number; height: number },
    viewport: { width: number; height: number },
  ): { left: number; top: number; maxWidth: number; maxHeight: number };
}
interface MenuConfig {
  LANGUAGE_GROUPS: readonly (readonly string[])[];
  MENU_COLUMNS: number;
  TWO_COLUMN_MIN_WIDTH: number;
}
interface LangMetaModule {
  LANG_META: readonly { code: string; name: string; locale: string }[];
}
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/app');
const menuDir = path.join(app, 'features/header/language-switcher');
const logic = (await import(pathToFileURL(path.join(menuDir, 'language-menu.logic.ts')).href)) as MenuLogic;
const { LANGUAGE_GROUPS, MENU_COLUMNS, TWO_COLUMN_MIN_WIDTH } = (await import(
  pathToFileURL(path.join(menuDir, 'language-menu.config.ts')).href
)) as MenuConfig;
const { LANG_META } = (await import(pathToFileURL(path.join(app, 'core/i18n/lang-meta.ts')).href)) as LangMetaModule;
const { splitIntoColumns, menuGrid, menuGridTarget, menuTypeAhead, menuColumnCount, placeMenu } = logic;

const nameOf = (code: string): string => LANG_META.find((lang) => lang.code === code)?.name ?? code;
const groups = LANGUAGE_GROUPS;

test('language menu: the languages are named in their own languages, without flags', () => {
  assert.deepEqual(
    LANG_META.map((lang) => lang.name),
    [
      'English',
      'Українська',
      'Русский',
      'Deutsch',
      'Polski',
      'Español',
      'Français',
      'Italiano',
      '日本語',
      '简体中文',
      '한국어',
      'Čeština',
      'Қазақша',
    ],
  );
  for (const lang of LANG_META) assert.ok(!/\p{Regional_Indicator}/u.test(lang.name), `no flag in ${lang.name}`);
});

test('language menu: every interface language is listed once, with a locale Intl understands', async () => {
  const { LANGS } = await import('../../shared/constants.ts');
  assert.deepEqual(LANG_META.map((lang) => lang.code).sort(), [...LANGS].sort());
  for (const lang of LANG_META) assert.equal(Intl.NumberFormat.supportedLocalesOf(lang.locale).length, 1, lang.locale);
});

test('language menu: the groups of the config, in their order, hold every language exactly once', async () => {
  const { LANGS } = await import('../../shared/constants.ts');
  assert.deepEqual(
    LANGUAGE_GROUPS.map((group) => group.map(nameOf)),
    [
      ['English', 'Deutsch', 'Español', 'Français', 'Italiano'],
      ['Українська', 'Polski', 'Čeština', 'Русский', 'Қазақша'],
      ['日本語', '简体中文', '한국어'],
    ],
  );
  const listed = LANGUAGE_GROUPS.flat();
  assert.deepEqual([...listed].sort(), [...LANGS].sort());
  assert.equal(new Set(listed).size, listed.length);
});

test('language menu: two columns of whole groups in their order, the tallest as short as possible; one in a narrow window', () => {
  const two = splitIntoColumns(groups, MENU_COLUMNS);
  assert.deepEqual(
    two.map((column) => column.flat().map(nameOf)),
    [
      ['English', 'Deutsch', 'Español', 'Français', 'Italiano'],
      ['Українська', 'Polski', 'Čeština', 'Русский', 'Қазақша', '日本語', '简体中文', '한국어'],
    ],
  );
  assert.equal(splitIntoColumns(groups, 1).length, 1);
  assert.equal(splitIntoColumns(groups, 5).length, groups.length, 'never an empty column');
  assert.deepEqual(splitIntoColumns([], 2), []);
  const g = (items: number): MenuGroup<number> => Array.from({ length: items }, (_, i) => i);
  assert.deepEqual(
    splitIntoColumns([g(2), g(2), g(2)], 2).map((column) => column.length),
    [2, 1],
    'on a tie the first column is the taller one',
  );
  assert.equal(menuColumnCount(1280, MENU_COLUMNS, TWO_COLUMN_MIN_WIDTH), 2);
  assert.equal(menuColumnCount(TWO_COLUMN_MIN_WIDTH - 1, MENU_COLUMNS, TWO_COLUMN_MIN_WIDTH), 1);
});

test('language menu: the grid numbers the items in reading order, with nothing between the groups', () => {
  const grid = menuGrid(splitIntoColumns(groups, 2));
  assert.deepEqual(grid, [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9, 10, 11, 12],
  ]);
});

test('language menu: ↑/↓ stay in the column, ←/→ go to the nearest row of the other column', () => {
  const grid = menuGrid(splitIntoColumns(groups, 2));
  // Column 1: English 0 … Italiano 4. Column 2: Українська 5 … Қазақша 9, then 日本語 10, 简体中文 11, 한국어 12.
  assert.equal(menuGridTarget('ArrowDown', 0, grid), 1);
  assert.equal(menuGridTarget('ArrowDown', 4, grid), 0, 'wraps around within the column');
  assert.equal(menuGridTarget('ArrowUp', 0, grid), 4);
  assert.equal(menuGridTarget('ArrowDown', 9, grid), 10, 'from one group into the next');
  assert.equal(menuGridTarget('ArrowUp', 10, grid), 9);
  assert.equal(menuGridTarget('ArrowDown', 12, grid), 5);
  assert.equal(menuGridTarget('ArrowRight', 0, grid), 5, 'the same row');
  assert.equal(menuGridTarget('ArrowRight', 4, grid), 9);
  assert.equal(menuGridTarget('ArrowLeft', 7, grid), 2);
  assert.equal(menuGridTarget('ArrowLeft', 11, grid), 4, 'below the shorter column: its last item');
  assert.equal(menuGridTarget('ArrowRight', 12, grid), 4, 'wraps around to the first column');
  assert.equal(menuGridTarget('Home', 11, grid), 5, 'Home: the first item of the column');
  assert.equal(menuGridTarget('End', 5, grid), 12);
  assert.equal(menuGridTarget('PageDown', 1, grid), 4);
  assert.equal(menuGridTarget('ArrowDown', -1, grid), 0, 'nothing focused yet');
  assert.equal(menuGridTarget('ArrowUp', -1, grid), 12);
  assert.equal(menuGridTarget('Enter', 3, grid), null, 'Enter clicks the focused button');
  assert.equal(menuGridTarget('a', 3, grid), null);
  assert.equal(menuGridTarget('ArrowDown', 0, []), null);
});

test('language menu: one column — ←/→ do nothing, ↓ goes through every group', () => {
  const grid = menuGrid(splitIntoColumns(groups, 1));
  assert.equal(menuGridTarget('ArrowRight', 3, grid), null);
  assert.equal(menuGridTarget('ArrowLeft', 3, grid), null);
  assert.equal(menuGridTarget('ArrowDown', 4, grid), 5);
  assert.equal(menuGridTarget('ArrowDown', 12, grid), 0);
  assert.equal(menuGridTarget('End', 0, grid), 12);
});

test('language menu: a typed letter jumps to the next language starting with it', () => {
  const names = splitIntoColumns(groups, 2).flatMap((column) => column.flat().map(nameOf));
  assert.deepEqual(names.slice(0, 3), ['English', 'Deutsch', 'Español']);
  assert.equal(menuTypeAhead('e', 0, names), 2, 'the next one after the focused item');
  assert.equal(menuTypeAhead('e', 2, names), 0, 'wraps around');
  assert.equal(menuTypeAhead('č', 0, names), 7);
  assert.equal(menuTypeAhead('Қ', 0, names), 9, 'case-insensitive, in any script');
  assert.equal(menuTypeAhead('р', 0, names), 8);
  assert.equal(menuTypeAhead('日', 0, names), 10);
  assert.equal(menuTypeAhead('z', 0, names), null);
  assert.equal(menuTypeAhead('Shift', 0, names), null);
  assert.equal(menuTypeAhead(' ', 0, names), null);
});

test('language menu: it opens under the button by its right edge and is moved and shrunk to stay inside the window', () => {
  const view = { width: 1280, height: 800 };
  assert.deepEqual(placeMenu({ left: 1000, right: 1120, bottom: 40 }, { width: 360, height: 300 }, view), {
    left: 760,
    top: 44,
    maxWidth: 1264,
    maxHeight: 748,
  });
  assert.equal(placeMenu({ left: 20, right: 140, bottom: 40 }, { width: 360, height: 300 }, view).left, 8, 'kept off the left edge');
  assert.equal(placeMenu({ left: 1250, right: 1300, bottom: 40 }, { width: 360, height: 300 }, view).left, 912, 'kept off the right edge');
  const narrow = placeMenu({ left: 100, right: 220, bottom: 40 }, { width: 400, height: 300 }, { width: 320, height: 200 });
  assert.deepEqual(narrow, { left: 8, top: 44, maxWidth: 304, maxHeight: 148 }, 'a narrow, short window: smaller maximum size');
});
