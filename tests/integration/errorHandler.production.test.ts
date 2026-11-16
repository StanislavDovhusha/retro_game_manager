import '../helpers/env.ts';
import '../helpers/production.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../../src/config/index.ts';
import { InsufficientStorageError, NotFoundError } from '../../src/utils/errors.ts';
import { startFailingApp } from '../helpers/miniApp.ts';

assert.equal(config.isProduction, true);

const call = await startFailingApp({
  notFound: () => {
    throw new NotFoundError('Game not found');
  },
  boom: () => {
    throw new Error('ENOENT: open /home/secret/path/file.txt');
  },
  disk: () => {
    throw new InsufficientStorageError('Not enough disk space');
  },
  denied: () => {
    throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES', path: '/mnt/sd/GBA' });
  },
});

test('in production a 4xx error keeps its message', async () => {
  assert.deepEqual(await call('/notFound'), { status: 404, body: { error: 'Game not found', code: 'NOT_FOUND' } });
});

test('in production an unexpected error hides its message, stack and internal paths', async () => {
  const res = await call('/boom');
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Internal server error', code: 'INTERNAL_ERROR' });
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes('/home/secret'));
  assert.ok(!('stack' in res.body));
});

test('messages written for the user (disk full) are still shown', async () => {
  const res = await call('/disk');
  assert.equal(res.status, 507);
  assert.equal(res.body.error, 'Not enough disk space');
  assert.ok(!('stack' in res.body));
});

test('a permission error does not leak the stack in production', async () => {
  const res = await call('/denied');
  assert.equal(res.status, 403);
  assert.ok(!('stack' in res.body));
});
