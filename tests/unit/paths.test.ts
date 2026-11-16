import '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  assertAbsoluteInside,
  assertNotProtected,
  assertSafeRelative,
  hasProtectedSegment,
  isInside,
  normalizeRel,
  safeResolve,
  safeResolveExisting,
} from '../../src/utils/paths.ts';
import { exists, isAppError, write } from '../helpers/fs.ts';
import { work } from '../helpers/env.ts';

const sd = path.join(work, 'SD');
const traversal = isAppError(400, 'PATH_OUTSIDE_ROOT');
const escapes = isAppError(403, 'PATH_OUTSIDE_ROOT');

test('normalizeRel unifies separators and drops leading slashes', () => {
  assert.equal(normalizeRel('\\a\\b//c.gba'), 'a/b/c.gba');
  assert.equal(normalizeRel('./a/b'), 'a/b');
  assert.equal(normalizeRel(undefined), '');
});

test('assertSafeRelative rejects "..", absolute paths and NUL bytes', () => {
  for (const evil of ['../x', 'a/../../x', 'a/..', '..\\x', '..']) assert.throws(() => assertSafeRelative(evil), traversal, evil);
  for (const abs of ['/etc/passwd', 'C:\\Windows', 'C:/Windows', '\\\\server\\share', 'c:foo']) {
    assert.throws(
      () => assertSafeRelative(abs),
      (err: unknown) => err instanceof Error,
      abs,
    );
  }
  assert.throws(() => assertSafeRelative('a\0b'), isAppError(400, 'VALIDATION_ERROR'));
  assert.throws(() => assertSafeRelative(''), isAppError(400, 'VALIDATION_ERROR'));
  assert.throws(() => assertSafeRelative(42), isAppError(400, 'VALIDATION_ERROR'));
  assert.equal(assertSafeRelative('GBA/Mario.gba'), 'GBA/Mario.gba');
  assert.equal(assertSafeRelative('a..b/c..d.gba'), 'a..b/c..d.gba'); // dots inside a name are fine
});

test('safeResolve keeps the result inside the root', () => {
  assert.equal(safeResolve(sd, 'a/b.gba'), path.join(sd, 'a', 'b.gba'));
  assert.throws(() => safeResolve(sd, '../etc/passwd'), traversal);
  assert.throws(() => safeResolve(sd, 'a/../../x'), traversal);
  assert.throws(() => safeResolve(sd, '/etc/passwd'), traversal);
  assert.throws(() => safeResolve('', 'a'), isAppError(400));
});

test('isInside does not treat a sibling with the same prefix as inside', () => {
  assert.equal(isInside('/sd', '/sd/a'), true);
  assert.equal(isInside('/sd', '/sd'), false);
  assert.equal(isInside('/sd', '/sd-evil/a'), false);
  assert.equal(isInside('/sd', '/sd/../etc'), false);
});

test('safeResolveExisting rejects a symlink that leaves the root', async () => {
  const outside = path.join(work, 'outside');
  await write(path.join(outside, 'secret.txt'), 'secret');
  await write(path.join(sd, 'GBA', 'ok.gba'), 'x');
  await fs.symlink(outside, path.join(sd, 'GBA', 'link'));
  assert.equal(await safeResolveExisting(sd, 'GBA/ok.gba'), path.join(sd, 'GBA', 'ok.gba'));
  await assert.rejects(safeResolveExisting(sd, 'GBA/link/secret.txt'), escapes);
  await assert.rejects(safeResolveExisting(sd, 'GBA/missing.gba'), isAppError(404));
  assert.ok(await exists(path.join(outside, 'secret.txt')));
});

test('assertAbsoluteInside: absolute paths only, and inside the SD root when it is known', () => {
  assert.equal(assertAbsoluteInside(path.join(sd, 'GBA'), sd, 'Games folder'), path.join(sd, 'GBA'));
  assert.equal(assertAbsoluteInside(sd, sd, 'Games folder'), sd);
  assert.throws(() => assertAbsoluteInside('GBA', sd, 'Games folder'), isAppError(400, 'VALIDATION_ERROR'));
  assert.throws(() => assertAbsoluteInside(path.join(work, 'elsewhere'), sd, 'Games folder'), escapes);
  assert.throws(() => assertAbsoluteInside(path.join(sd, '..', 'elsewhere'), sd, 'Games folder'), escapes);
  assert.throws(() => assertAbsoluteInside(`${sd}-evil`, sd, 'Games folder'), escapes);
  assert.equal(assertAbsoluteInside(path.join(work, 'elsewhere'), null, 'Games folder'), path.join(work, 'elsewhere'));
});

test('protected folders: rootfs and cubegm', () => {
  assert.equal(hasProtectedSegment('/mnt/SD/rootfs/etc'), true);
  assert.equal(hasProtectedSegment('C:\\SD\\CubeGM\\saves'), true);
  assert.equal(hasProtectedSegment('/mnt/SD/GBA/rootfs-backup'), false);
  assert.throws(() => assertNotProtected('/mnt/SD/rootfs/x'), isAppError(403, 'FORBIDDEN'));
  assert.doesNotThrow(() => assertNotProtected('/mnt/SD/GBA/x'));
});
