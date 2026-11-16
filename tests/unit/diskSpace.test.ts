import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFreeSpace, freeBytes } from '../../src/utils/diskSpace.ts';
import { isAppError } from '../helpers/fs.ts';

test('the free space of a folder is known, and writing more than that is refused with 507', async () => {
  const free = await freeBytes(work);
  assert.ok(free !== null && free > 0);
  await assertFreeSpace(work, 1);
  await assert.rejects(assertFreeSpace(work, Number.MAX_SAFE_INTEGER), isAppError(507, 'INSUFFICIENT_STORAGE'));
});

test('an unknown free space (the folder is gone) does not block the operation', async () => {
  assert.equal(await freeBytes(`${work}/missing/folder`), null);
  await assertFreeSpace(`${work}/missing/folder`, Number.MAX_SAFE_INTEGER);
});
