import '../helpers/env.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, parseEnv } from '../../src/config/env.ts';

test('defaults', () => {
  const c = parseEnv({ DATA_DIR: '/tmp/x' });
  assert.equal(c.port, 3001);
  assert.equal(c.host, '127.0.0.1');
  assert.equal(c.isProduction, false);
  assert.deepEqual(c.clientOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
  assert.equal(c.dataDir, path.resolve('/tmp/x'));
  assert.equal(c.maxGameUploadBytes, 4 * 1024 ** 3 - 1);
  assert.equal(c.uploadTtlMs, 3_600_000);
});

test('values are read and converted', () => {
  const c = parseEnv({
    NODE_ENV: 'production',
    PORT: '8080',
    CLIENT_ORIGIN: 'https://a.example, http://localhost:4200',
    LOG_LEVEL: 'warn',
    MAX_IMAGE_BYTES: '1000',
    UPLOAD_TTL_MINUTES: '5',
  });
  assert.equal(c.isProduction, true);
  assert.equal(c.port, 8080);
  assert.deepEqual(c.clientOrigins, ['https://a.example', 'http://localhost:4200']);
  assert.equal(c.logLevel, 'warn');
  assert.equal(c.maxImageBytes, 1000);
  assert.equal(c.uploadTtlMs, 300_000);
});

test('LOG_FILE is optional and resolved to an absolute path', () => {
  assert.equal(parseEnv({}).logFile, null);
  assert.equal(parseEnv({ LOG_FILE: '/tmp/logs/app.log' }).logFile, path.resolve('/tmp/logs/app.log'));
});

test('DATA_DIR sets the data folder; without it the default ~/.retro-game-manager is used', () => {
  assert.equal(parseEnv({ DATA_DIR: '/tmp/new' }).dataDir, path.resolve('/tmp/new'));
  assert.equal(parseEnv({ DATA_DIR: '/tmp/new' }).dataDirIsDefault, false);
  const fallback = parseEnv({});
  assert.equal(path.basename(fallback.dataDir), '.retro-game-manager');
  assert.equal(fallback.dataDirIsDefault, true);
});

test('empty values count as not set', () => {
  assert.equal(parseEnv({ PORT: '', LOG_LEVEL: '' }).port, 3001);
});

test('invalid configuration is rejected with every problem listed', () => {
  assert.throws(
    () => parseEnv({ PORT: 'abc', LOG_LEVEL: 'loud', CLIENT_ORIGIN: 'http://x.example/path', MAX_IMAGE_BYTES: '-1' }),
    (err: unknown) =>
      err instanceof ConfigError && ['PORT', 'LOG_LEVEL', 'CLIENT_ORIGIN', 'MAX_IMAGE_BYTES'].every((name) => err.message.includes(name)),
  );
  assert.throws(() => parseEnv({ PORT: '70000' }), ConfigError);
  assert.throws(() => parseEnv({ NODE_ENV: 'staging' }), ConfigError);
  assert.throws(() => parseEnv({ JSON_BODY_LIMIT: 'lots' }), ConfigError);
});
