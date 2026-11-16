import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
interface Logic {
  gridMove(index: number, key: GridKey, columns: number, count: number): number;
  columnsOf(tops: readonly number[]): number;
  isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean;
  isBackKey(event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean;
  isGridKey(key: string): boolean;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const logic = (await import(pathToFileURL(path.join(root, 'client/src/app/features/platforms/platforms.logic.ts')).href)) as Logic;
const { gridMove, columnsOf, isTypingTarget, isBackKey, isGridKey } = logic;

// 7 cards in rows of 3:
//  0 1 2
//  3 4 5
//  6
test('left and right follow the reading order and stop at the ends', () => {
  assert.equal(gridMove(0, 'ArrowLeft', 3, 7), 0);
  assert.equal(gridMove(2, 'ArrowRight', 3, 7), 3);
  assert.equal(gridMove(6, 'ArrowRight', 3, 7), 6);
  assert.equal(gridMove(3, 'ArrowLeft', 3, 7), 2);
});

test('up and down keep the column; down onto a shorter last row lands on its last card', () => {
  assert.equal(gridMove(1, 'ArrowDown', 3, 7), 4);
  assert.equal(gridMove(4, 'ArrowUp', 3, 7), 1);
  assert.equal(gridMove(1, 'ArrowUp', 3, 7), 1);
  assert.equal(gridMove(5, 'ArrowDown', 3, 7), 6);
  assert.equal(gridMove(3, 'ArrowDown', 3, 7), 6);
  assert.equal(gridMove(6, 'ArrowDown', 3, 7), 6);
  assert.equal(gridMove(6, 'ArrowUp', 3, 7), 3);
});

test('Home and End; a single column; no cards', () => {
  assert.equal(gridMove(4, 'Home', 3, 7), 0);
  assert.equal(gridMove(1, 'End', 3, 7), 6);
  assert.equal(gridMove(0, 'ArrowDown', 1, 3), 1);
  assert.equal(gridMove(0, 'ArrowDown', 0, 3), 1, 'a broken column count acts as one column');
  assert.equal(gridMove(0, 'ArrowRight', 3, 0), -1);
});

test('the columns are the cards that share the top edge of the first one', () => {
  assert.equal(columnsOf([10, 10, 10.4, 140, 140]), 3);
  assert.equal(columnsOf([10, 140, 270]), 1);
  assert.equal(columnsOf([]), 1);
});

test('Backspace and Esc go back, but not in text fields or with modifiers', () => {
  const key = (k: string, mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>> = {}) => ({
    key: k,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods,
  });
  assert.ok(isBackKey(key('Backspace')));
  assert.ok(isBackKey(key('Escape')));
  assert.ok(!isBackKey(key('Backspace', { metaKey: true })));
  assert.ok(!isBackKey(key('Enter')));
  assert.ok(isTypingTarget({ tagName: 'INPUT' }));
  assert.ok(isTypingTarget({ tagName: 'textarea' }));
  assert.ok(isTypingTarget({ tagName: 'SELECT' }));
  assert.ok(isTypingTarget({ tagName: 'DIV', isContentEditable: true }));
  assert.ok(!isTypingTarget({ tagName: 'BUTTON' }));
  assert.ok(!isTypingTarget(null));
  assert.ok(isGridKey('ArrowUp') && isGridKey('End') && !isGridKey('Enter'));
});
