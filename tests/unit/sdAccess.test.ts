import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { accessProblem, checkSdAccess, type SdAccessFs } from '../../src/services/sdAccess.ts';

const root = path.join(work, 'sd-access');
await fs.mkdir(path.join(root, 'GBA'), { recursive: true });

/** Permission bits mean nothing on Windows and to root: those runs skip the permission cases. */
const noPermissionTests = process.platform === 'win32' || process.getuid?.() === 0;

test('an existing card folder is available', async () => {
  assert.deepEqual(await checkSdAccess(root), { ok: true });
});

test('a missing path (card removed, another drive letter) is "missing"', async () => {
  const result = await checkSdAccess(path.join(work, 'no-such-card'));
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === 'missing' && result.code === 'ENOENT');
});

test('a file instead of a folder is "missing"', async () => {
  const file = path.join(work, 'card-file');
  await fs.writeFile(file, 'x');
  const result = await checkSdAccess(file);
  assert.ok(!result.ok && result.reason === 'missing');
});

test('a folder that cannot be read is "noRead"', { skip: noPermissionTests }, async () => {
  const locked = path.join(work, 'locked-read');
  await fs.mkdir(locked, { recursive: true });
  await fs.chmod(locked, 0o000);
  try {
    const result = await checkSdAccess(locked);
    assert.ok(!result.ok && result.reason === 'noRead' && result.code === 'EACCES', JSON.stringify(result));
    assert.equal(!result.ok && result.systemDenied, false, 'plain file permissions are not the macOS privacy settings');
  } finally {
    await fs.chmod(locked, 0o755);
  }
});

test('a folder that can be read but not written is "noWrite"', { skip: noPermissionTests }, async () => {
  const locked = path.join(work, 'locked-write');
  await fs.mkdir(locked, { recursive: true });
  await fs.chmod(locked, 0o555);
  try {
    const result = await checkSdAccess(locked);
    assert.ok(!result.ok && result.reason === 'noWrite', JSON.stringify(result));
  } finally {
    await fs.chmod(locked, 0o755);
  }
});

test('a drive that does not answer gives up after the timeout', async () => {
  const hanging: SdAccessFs = {
    stat: () => new Promise(() => undefined),
    readdir: () => Promise.resolve([]),
    access: () => Promise.resolve(),
  };
  const started = Date.now();
  const result = await checkSdAccess('/Volumes/NETWORK', { timeoutMs: 50, fs: hanging });
  assert.deepEqual(result, { ok: false, reason: 'timeout', code: '', systemDenied: false });
  assert.ok(Date.now() - started < 2000, 'the check does not wait for the hanging call');
});

test('the default timeout is 3 seconds', async () => {
  const { SD_ACCESS_TIMEOUT_MS } = await import('../../src/services/sdAccess.ts');
  assert.equal(SD_ACCESS_TIMEOUT_MS, 3000);
});

test('macOS privacy settings (EPERM) are told apart from file permissions (EACCES)', () => {
  assert.deepEqual(accessProblem('read', 'EPERM', 'darwin'), { ok: false, reason: 'noRead', code: 'EPERM', systemDenied: true });
  assert.deepEqual(accessProblem('stat', 'EPERM', 'darwin'), { ok: false, reason: 'noRead', code: 'EPERM', systemDenied: true });
  assert.equal(accessProblem('read', 'EACCES', 'darwin').systemDenied, false);
  assert.equal(accessProblem('read', 'EPERM', 'win32').systemDenied, false);
  assert.equal(accessProblem('write', 'EROFS', 'linux').reason, 'noWrite');
  assert.equal(accessProblem('write', 'EACCES', 'linux').reason, 'noWrite');
  assert.equal(accessProblem('stat', 'ENOENT', 'win32').reason, 'missing');
  assert.equal(accessProblem('stat', 'EIO', 'linux').reason, 'missing');
});

test('every step is checked in order: stat, read, write', async () => {
  const fail = (code: string) => () => Promise.reject(Object.assign(new Error(code), { code }));
  const ok: SdAccessFs = {
    stat: () => Promise.resolve({ isDirectory: () => true }),
    readdir: () => Promise.resolve([]),
    access: () => Promise.resolve(),
  };
  const readDenied = await checkSdAccess('/card', { fs: { ...ok, readdir: fail('EPERM') }, platform: 'darwin' });
  assert.deepEqual(readDenied, { ok: false, reason: 'noRead', code: 'EPERM', systemDenied: true });
  const writeDenied = await checkSdAccess('/card', { fs: { ...ok, access: fail('EACCES') }, platform: 'linux' });
  assert.deepEqual(writeDenied, { ok: false, reason: 'noWrite', code: 'EACCES', systemDenied: false });
});
