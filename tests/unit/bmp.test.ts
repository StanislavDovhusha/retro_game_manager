import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBmp } from '../../src/services/fs/bmp.ts';
import { makeBmp } from '../helpers/images.ts';

test('decodeBmp: a 24-bit bottom-up BMP (rows padded to 4 bytes) becomes RGBA', () => {
  const image = decodeBmp(makeBmp(3, 2, [10, 20, 30]));
  assert.equal(image.width, 3);
  assert.equal(image.height, 2);
  assert.equal(image.rgba.length, 3 * 2 * 4);
  assert.deepEqual([...image.rgba.subarray(0, 4)], [10, 20, 30, 255]);
  assert.deepEqual([...image.rgba.subarray(-4)], [10, 20, 30, 255]);
});

test('decodeBmp: the pixel order is top-down in the result', () => {
  const bmp = makeBmp(1, 2);
  // bottom-up: the first stored row is the bottom one
  bmp.set([0, 0, 255], 54); // bottom: red (BGR)
  bmp.set([0, 255, 0], 54 + 4); // top: green
  const { rgba } = decodeBmp(bmp);
  assert.deepEqual([...rgba.subarray(0, 4)], [0, 255, 0, 255]);
  assert.deepEqual([...rgba.subarray(4, 8)], [255, 0, 0, 255]);
});

test('decodeBmp: a truncated or foreign file is refused', () => {
  const bmp = makeBmp(4, 4);
  assert.throws(() => decodeBmp(bmp.subarray(0, bmp.length - 10)));
  assert.throws(() => decodeBmp(Buffer.from('not a bmp at all, really')));
});

test('decodeBmp: a huge declared size is refused before any memory is allocated', () => {
  const bmp = makeBmp(2, 2);
  bmp.writeInt32LE(50_000, 18);
  bmp.writeInt32LE(50_000, 22);
  assert.throws(() => decodeBmp(bmp));
});
