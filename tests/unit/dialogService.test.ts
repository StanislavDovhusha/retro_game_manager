import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { runWithLang } from '../../src/i18n/index.ts';
import { pickFile, pickFolder, setNativeOpenDialog } from '../../src/services/dialogService.ts';
import type { NativeOpenDialogOptions } from '../../src/services/dialogService.ts';
import { isAppError } from '../helpers/fs.ts';

afterEach(() => setNativeOpenDialog(null));

/** Registers a fake native dialog that records its options and answers with `answer`. */
function fakeDialog(answer: string[]): NativeOpenDialogOptions[] {
  const calls: NativeOpenDialogOptions[] = [];
  setNativeOpenDialog(async (options) => {
    calls.push(options);
    return answer;
  });
  return calls;
}

test('the folder dialog is a native directory picker with a translated title', async () => {
  const calls = fakeDialog(['/Volumes/GAMECARD/']);
  assert.equal(await pickFolder(), '/Volumes/GAMECARD', 'a trailing separator is dropped');
  assert.deepEqual(calls[0]?.properties, ['openDirectory']);
  assert.equal(calls[0]?.title, 'Choose a folder');
  const ukrainian = await runWithLang('uk', async () => {
    await pickFolder();
    return calls[1]?.title;
  });
  assert.notEqual(ukrainian, 'Choose a folder');
});

test('a root is kept as it is, and a cancelled dialog gives null', async () => {
  fakeDialog(['E:\\']);
  assert.equal(await pickFolder(), 'E:\\');
  fakeDialog(['/']);
  assert.equal(await pickFolder(), '/');
  fakeDialog([]);
  assert.equal(await pickFolder(), null);
});

test('file dialogs: filters per kind, single and multiple selection', async () => {
  const calls = fakeDialog(['/a/file.csv']);
  assert.equal(await pickFile('csv', []), '/a/file.csv');
  assert.deepEqual(calls[0]?.properties, ['openFile']);
  assert.deepEqual(calls[0]?.filters[0]?.extensions, ['csv', 'txt']);
  assert.deepEqual(calls[0]?.filters.at(-1)?.extensions, ['*'], 'there is always an "All files" filter');

  await pickFile('image', []);
  assert.ok(calls[1]?.filters[0]?.extensions.includes('png'));

  fakeDialog([]);
  assert.equal(await pickFile('image', []), null);
});

test('game dialog: the extensions of the settings (unsafe ones dropped) plus disc image parts; several files', async () => {
  const calls = fakeDialog(['/g/a.gba', '/g/b.gba']);
  assert.deepEqual(await pickFile('game', ['gba', 'z..ip', '*', 'zip'], true), ['/g/a.gba', '/g/b.gba']);
  assert.deepEqual(calls[0]?.properties, ['openFile', 'multiSelections']);
  // .cue, .ccd, .sub and .ecm are offered too: they are selected together with the image they belong to.
  assert.deepEqual(calls[0]?.filters[0]?.extensions, ['gba', 'zip', 'bin', 'cue', 'img', 'ccd', 'sub', 'ecm']);
  assert.equal((await pickFile('game', [], true)).length, 2);
  assert.equal(calls[1]?.filters.length, 1, 'no extensions configured: only "All files"');
});

test('an unknown file kind is rejected before any dialog opens', async () => {
  const calls = fakeDialog(['/x']);
  await assert.rejects(pickFile('exe' as never, []), isAppError(400, 'VALIDATION_ERROR'));
  assert.equal(calls.length, 0);
});
