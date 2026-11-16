import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { UpdateEntryRequest } from '../../shared/api.ts';
import type { LibraryFile } from '../../shared/models.ts';

type Field = 'name' | 'short' | 'tags';
type Prepared =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; errorKey: string; params?: Record<string, string | number> }
  | { kind: 'save'; request: UpdateEntryRequest };
interface EditLogic {
  initialDraft(game: LibraryFile, field: Field): string;
  prepareEdit(game: LibraryFile, field: Field, draft: string): Prepared;
}

// The client module is loaded by a computed path: it is written for the Angular bundler (aliases, no extensions),
// so the project's type check must not follow it; the shape above is what the test relies on.
const logicFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/app/features/library/entry-edit.logic.ts');
const { initialDraft, prepareEdit } = (await import(pathToFileURL(logicFile).href)) as EditLogic;

const game = (patch: Partial<LibraryFile> = {}): LibraryFile =>
  ({
    rel: 'SFC/Mario.zip',
    title: 'Mario',
    csvName: 'Mario',
    csvShort: 'mario',
    tags: ['rpg', 'snes'],
    inCsv: true,
    ...patch,
  }) as LibraryFile;

test('initialDraft: what the field contains when editing starts', () => {
  assert.equal(initialDraft(game(), 'name'), 'Mario');
  assert.equal(initialDraft(game(), 'short'), 'mario');
  assert.equal(initialDraft(game(), 'tags'), 'rpg snes');
  assert.equal(initialDraft(game({ csvShort: null, tags: [] }), 'short'), '');
  assert.equal(initialDraft(game({ tags: [] }), 'tags'), '');
});

test('name: unchanged (also with spaces around) sends nothing; a new title is a confirmed rename', () => {
  assert.deepEqual(prepareEdit(game(), 'name', '  Mario  '), { kind: 'unchanged' });
  assert.deepEqual(prepareEdit(game(), 'name', 'Super Mario'), {
    kind: 'save',
    request: { rel: 'SFC/Mario.zip', name: 'Super Mario', confirmed: true },
  });
  assert.deepEqual(prepareEdit(game(), 'name', '   '), { kind: 'invalid', errorKey: 'inlineEdit.errors.emptyName' });
});

test('short name: one word', () => {
  assert.deepEqual(prepareEdit(game(), 'short', 'mario'), { kind: 'unchanged' });
  assert.deepEqual(prepareEdit(game(), 'short', ' luigi '), { kind: 'save', request: { rel: 'SFC/Mario.zip', short: 'luigi' } });
  assert.equal(prepareEdit(game(), 'short', 'two words').kind, 'invalid');
  assert.deepEqual(prepareEdit(game(), 'short', ''), { kind: 'invalid', errorKey: 'inlineEdit.errors.emptyShort' });
  // an entry without a short name: typing one is a change
  assert.equal(prepareEdit(game({ csvShort: null }), 'short', 'x').kind, 'save');
});

test('tags: the space separates them; empty ones and duplicates go; the same set is "unchanged"', () => {
  assert.deepEqual(prepareEdit(game(), 'tags', 'rpg   snes'), { kind: 'unchanged' });
  assert.deepEqual(prepareEdit(game(), 'tags', '  snes rpg rpg '), {
    kind: 'save',
    request: { rel: 'SFC/Mario.zip', tags: ['snes', 'rpg'] },
  });
  assert.deepEqual(prepareEdit(game(), 'tags', ''), { kind: 'save', request: { rel: 'SFC/Mario.zip', tags: [] } });
  assert.deepEqual(prepareEdit(game({ tags: [] }), 'tags', '   '), { kind: 'unchanged' });
  const tooLong = prepareEdit(game(), 'tags', `ok ${'x'.repeat(65)}`);
  assert.equal(tooLong.kind, 'invalid');
});

test('"|" separates the fields of the console lists: it is refused in a title and in a short name', () => {
  assert.deepEqual(prepareEdit(game(), 'name', 'Mario | Luigi'), { kind: 'invalid', errorKey: 'inlineEdit.errors.pipe' });
  assert.deepEqual(prepareEdit(game(), 'short', 'mario|luigi'), { kind: 'invalid', errorKey: 'inlineEdit.errors.pipe' });
});

test('titles and short names are English only: other alphabets are refused, Latin, digits, spaces and hyphens pass', () => {
  for (const name of ['Ёжик', 'ドラゴンクエスト', 'Pokémon', 'Mario!']) {
    assert.deepEqual(prepareEdit(game(), 'name', name), { kind: 'invalid', errorKey: 'validation.latinOnly' }, name);
  }
  for (const short of ['ёжик', 'ドラクエ']) {
    assert.deepEqual(prepareEdit(game(), 'short', short), { kind: 'invalid', errorKey: 'validation.latinOnly' }, short);
  }
  assert.equal(prepareEdit(game(), 'name', 'Super Mario-World 2 (USA) [b1]').kind, 'save');
  assert.equal(prepareEdit(game(), 'name', 'Dr. Mario: Tom & Jerry #2').kind, 'save');
  assert.equal(prepareEdit(game(), 'short', 'super_mario-2').kind, 'save');
});

test('an old title in another alphabet has to be fixed before the game can be edited', () => {
  const old = game({ title: 'Ёжик в тумане', csvName: 'Ёжик в тумане' });
  assert.deepEqual(prepareEdit(old, 'name', 'Ёжик в тумане'), { kind: 'invalid', errorKey: 'validation.latinOnly' }, 'not saved as it is');
  assert.deepEqual(prepareEdit(old, 'short', 'hedgehog'), { kind: 'invalid', errorKey: 'inlineEdit.errors.renameFirst' });
  assert.deepEqual(prepareEdit(old, 'tags', 'rpg'), { kind: 'invalid', errorKey: 'inlineEdit.errors.renameFirst' });
  assert.deepEqual(prepareEdit(old, 'name', 'Hedgehog in the Fog'), {
    kind: 'save',
    request: { rel: old.rel, name: 'Hedgehog in the Fog', confirmed: true },
  });
});
