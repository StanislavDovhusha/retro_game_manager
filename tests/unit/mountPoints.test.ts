import '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { findSdCandidates, mountBases, suggestSdFolder, systemMountEnv } from '../../src/utils/mountPoints.ts';
import type { MountEnv } from '../../src/utils/mountPoints.ts';
import { work } from '../helpers/env.ts';

/** A virtual disk layout: folder → names of its sub-folders. `links` maps a path to what it really points to. */
function fakeEnv(
  platform: NodeJS.Platform,
  tree: Record<string, string[]>,
  extra: Partial<MountEnv> & { links?: Record<string, string> } = {},
): MountEnv {
  const { links = {}, ...rest } = extra;
  return {
    platform,
    userName: 'anna',
    systemDrive: 'C:',
    listDirs: async (dir) => tree[dir] ?? [],
    isDir: async (dir) => dir in tree,
    realPath: async (target) => links[target] ?? target,
    ...rest,
  };
}

test('Windows: every existing drive letter except the system drive is a candidate', async () => {
  const env = fakeEnv('win32', { 'C:\\': ['Windows', 'Users'], 'D:\\': ['Data'], 'E:\\': ['GBA', 'cubegm', 'rootfs'], 'G:\\': [] });
  const found = await findSdCandidates(env);
  assert.deepEqual(
    found.map((candidate) => [candidate.path, candidate.name, candidate.looksLikeCard]),
    [
      ['E:\\', 'E:', true], // recognised by its cubegm/rootfs folders: first
      ['D:\\', 'D:', false],
      ['G:\\', 'G:', false],
    ],
  );
  assert.equal(await suggestSdFolder(env), 'E:\\');
});

test('Windows: the system drive is whatever SystemDrive says, in any letter case', async () => {
  const env = fakeEnv('win32', { 'C:\\': ['Windows'], 'D:\\': ['Windows', 'Users'] }, { systemDrive: 'd:' });
  assert.deepEqual(
    (await findSdCandidates(env)).map((candidate) => candidate.path),
    ['C:\\'],
  );
});

test('Windows: no drive means no suggestion (the system dialog decides)', async () => {
  assert.equal(await suggestSdFolder(fakeEnv('win32', { 'C:\\': [] })), undefined);
  assert.deepEqual(mountBases({ platform: 'win32', userName: 'anna' }), []);
});

test('macOS: volumes from /Volumes, without the boot volume and hidden entries', async () => {
  const env = fakeEnv(
    'darwin',
    {
      '/Volumes': ['Macintosh HD', 'GAMECARD', 'NO NAME', '.timemachine'],
      '/Volumes/GAMECARD': ['Roms', 'cubegm'],
      '/Volumes/NO NAME': ['x'],
    },
    { links: { '/Volumes/Macintosh HD': '/' } },
  );
  const found = await findSdCandidates(env);
  assert.deepEqual(
    found.map((candidate) => [candidate.path, candidate.looksLikeCard]),
    [
      ['/Volumes/GAMECARD', true],
      ['/Volumes/NO NAME', false],
    ],
  );
  assert.equal(await suggestSdFolder(env), '/Volumes/GAMECARD');
});

test('macOS: with no card the dialog opens in /Volumes', async () => {
  const env = fakeEnv('darwin', { '/Volumes': ['Macintosh HD'] }, { links: { '/Volumes/Macintosh HD': '/' } });
  assert.deepEqual(await findSdCandidates(env), []);
  assert.equal(await suggestSdFolder(env), '/Volumes');
});

test('Linux: /media/<user>, /run/media/<user>, /media and /mnt are searched; the user folder itself is not a card', async () => {
  const env = fakeEnv('linux', {
    '/media/anna': ['GAMECARD'],
    '/media/anna/GAMECARD': ['rootfs'],
    '/run/media/anna': ['CARD'],
    '/run/media/anna/CARD': ['Photos'],
    '/media': ['anna', 'usb0'],
    '/mnt': ['backup'],
  });
  const found = await findSdCandidates(env);
  assert.deepEqual(
    found.map((candidate) => candidate.path),
    ['/media/anna/GAMECARD', '/run/media/anna/CARD', '/media/usb0', '/mnt/backup'],
  );
  assert.equal(found[0]?.looksLikeCard, true);
  assert.equal(await suggestSdFolder(env), '/media/anna/GAMECARD');
});

test('Linux: with no card the dialog opens where cards are mounted', async () => {
  assert.equal(await suggestSdFolder(fakeEnv('linux', { '/run/media/anna': [], '/mnt': [] })), '/run/media/anna');
  assert.equal(await suggestSdFolder(fakeEnv('linux', {})), undefined);
});

test('the same drive found under two bases is listed once', async () => {
  const env = fakeEnv('linux', { '/media/anna': ['A'], '/media': ['anna', 'A'] });
  assert.deepEqual(
    (await findSdCandidates(env)).map((candidate) => candidate.path),
    ['/media/anna/A', '/media/A'],
  );
});

test('the real system environment can be queried without throwing', async () => {
  const env = systemMountEnv();
  assert.equal(env.platform, process.platform);
  const folder = path.join(work, 'real');
  await fs.mkdir(path.join(folder, 'sub'), { recursive: true });
  await fs.writeFile(path.join(folder, 'file.txt'), 'x');
  assert.deepEqual(await env.listDirs(folder), ['sub']);
  assert.equal(await env.isDir(folder), true);
  assert.equal(await env.isDir(path.join(folder, 'file.txt')), false);
  assert.deepEqual(await env.listDirs(path.join(folder, 'missing')), []);
  assert.ok(Array.isArray(await findSdCandidates(env)));
});
