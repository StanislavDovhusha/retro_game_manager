import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../../src/config/index.ts';
import { ConflictError, InsufficientStorageError, NotFoundError, ValidationError } from '../../src/utils/errors.ts';
import { startFailingApp } from '../helpers/miniApp.ts';

assert.equal(config.isProduction, false);

const call = await startFailingApp({
  notFound: () => {
    throw new NotFoundError('Game not found');
  },
  conflict: () => {
    throw new ConflictError('Already exists', { details: { name: 'a' } });
  },
  invalid: () => {
    throw new ValidationError('Bad input');
  },
  boom: () => {
    throw new Error('ENOENT: open /home/secret/path/file.txt');
  },
  diskFull: () => {
    throw Object.assign(new Error('write failed'), { code: 'ENOSPC' });
  },
  denied: () => {
    throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES', path: '/mnt/sd/GBA' });
  },
  disk: () => {
    throw new InsufficientStorageError('Not enough disk space');
  },
});

test('application errors use their status, code and message', async () => {
  assert.deepEqual(await call('/notFound'), { status: 404, body: { error: 'Game not found', code: 'NOT_FOUND' } });
  assert.deepEqual(await call('/conflict'), { status: 409, body: { error: 'Already exists', code: 'CONFLICT', details: { name: 'a' } } });
  assert.deepEqual(await call('/invalid'), { status: 400, body: { error: 'Bad input', code: 'VALIDATION_ERROR' } });
});

test('errors thrown asynchronously reach the same handler', async () => {
  assert.equal((await call('/async-notFound')).status, 404);
});

test('outside production an unexpected error shows its message and stack (for development)', async () => {
  const res = await call('/boom');
  assert.equal(res.status, 500);
  assert.equal(res.body.code, 'INTERNAL_ERROR');
  assert.match(String(res.body.error), /ENOENT/);
  assert.equal(typeof res.body.stack, 'string');
});

test('well-known system errors are translated into clear responses', async () => {
  assert.equal((await call('/diskFull')).status, 507);
  const denied = await call('/denied');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'FORBIDDEN');
});

test('the error message follows X-Lang', async () => {
  const res = await call('/async-denied', { 'x-lang': 'ru' });
  assert.match(String(res.body.error), /[Ѐ-ӿ]/);
});
