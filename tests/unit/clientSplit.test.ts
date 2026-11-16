import '../helpers/env.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface SplitLogic {
  MIN_FOLDERS_HEIGHT: number;
  MIN_GAMES_HEIGHT: number;
  DEFAULT_SHARE: number;
  clampShare(value: unknown): number;
  shareAfterMove(startFolders: number, delta: number, total: number): number;
}
// Loaded by a computed path: the file belongs to the Angular client, the project's type check does not follow it.
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/app/features/layout/split.logic.ts');
const logic = (await import(pathToFileURL(file).href)) as SplitLogic;

test('clampShare: 0.1…0.9, garbage gives the default', () => {
  assert.equal(logic.clampShare(0.5), 0.5);
  assert.equal(logic.clampShare(0), 0.1);
  assert.equal(logic.clampShare(7), 0.9);
  assert.equal(logic.clampShare(-1), 0.1);
  for (const bad of [undefined, null, 'x', NaN, Infinity]) assert.equal(logic.clampShare(bad), logic.DEFAULT_SHARE);
});

test('shareAfterMove: follows the pointer', () => {
  assert.equal(logic.shareAfterMove(300, 0, 600), 0.5);
  assert.equal(logic.shareAfterMove(300, 60, 600), 0.6);
  assert.equal(logic.shareAfterMove(300, -60, 600), 0.4);
});

test('shareAfterMove: neither block can be squeezed below its minimum height', () => {
  const total = 700;
  const smallest = logic.shareAfterMove(350, -10_000, total);
  const largest = logic.shareAfterMove(350, 10_000, total);
  assert.ok(smallest * total >= logic.MIN_FOLDERS_HEIGHT - 1e-9, `the folders block: ${smallest * total}px`);
  assert.ok((1 - largest) * total >= logic.MIN_GAMES_HEIGHT - 1e-9, `the games block: ${(1 - largest) * total}px`);
  assert.ok(smallest >= 0.1 && largest <= 0.9);
});

test('shareAfterMove: a window too small for both minimums shares the height equally; no height gives the default', () => {
  assert.equal(logic.shareAfterMove(100, 500, 200), 0.5);
  assert.equal(logic.shareAfterMove(100, -500, 200), 0.5);
  assert.equal(logic.shareAfterMove(0, 0, 0), logic.DEFAULT_SHARE);
  assert.equal(logic.shareAfterMove(10, 10, Number.NaN), logic.DEFAULT_SHARE);
});
