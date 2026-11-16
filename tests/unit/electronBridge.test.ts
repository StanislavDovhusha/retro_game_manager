import '../helpers/env.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDesktopHandlers } from '../../electron/desktopApi.ts';
import type { DesktopApiDeps } from '../../electron/desktopApi.ts';
import { DESKTOP_BRIDGE_NAME, DESKTOP_CHANNELS } from '../../shared/desktop.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function deps(overrides: Partial<DesktopApiDeps> = {}): DesktopApiDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    pickFolder: async () => {
      calls.push('folder');
      return '/media/anna/GAMECARD';
    },
    pickFile: async (kind) => {
      calls.push(`file:${kind}`);
      return '/a/file';
    },
    pickFiles: async (kind) => {
      calls.push(`files:${kind}`);
      return ['/a/1', '/a/2'];
    },
    inUserLanguage: (task) => task(),
    ...overrides,
  };
}

test('the preload script exposes exactly the bridge of shared/desktop.ts', async () => {
  const preload = await fs.readFile(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  assert.ok(preload.includes(`'${DESKTOP_BRIDGE_NAME}'`), 'the global name');
  for (const channel of Object.values(DESKTOP_CHANNELS)) assert.ok(preload.includes(`'${channel}'`), channel);
  const exposed = [...preload.matchAll(/^\s{4}(\w+):/gm)].map((match) => match[1]).sort();
  assert.deepEqual(exposed, ['isDesktop', 'pickFile', 'pickFiles', 'pickFolder']);
});

test('the preload script is a sandbox-safe CommonJS file: it requires only electron and no Node.js module', async () => {
  const preload = await fs.readFile(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  assert.deepEqual(
    [...preload.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
    ['electron'],
  );
  assert.ok(!/\bimport\s|\bexport\s|process\.|__dirname|child_process|\bfs\b/.test(preload.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.ok(!/exposeInMainWorld\([^)]*ipcRenderer/.test(preload), 'ipcRenderer itself must never be exposed');
});

test('every channel has a handler and no other channel exists', () => {
  assert.deepEqual(Object.keys(createDesktopHandlers(deps())).sort(), Object.values(DESKTOP_CHANNELS).sort());
});

test('handlers return { ok, value } and run in the user language', async () => {
  const seen: string[] = [];
  const api = deps({
    inUserLanguage: async (task) => {
      seen.push('language');
      return task();
    },
  });
  const handlers = createDesktopHandlers(api);
  assert.deepEqual(await handlers[DESKTOP_CHANNELS.pickFolder]?.(), { ok: true, value: '/media/anna/GAMECARD' });
  assert.deepEqual(await handlers[DESKTOP_CHANNELS.pickFile]?.('csv'), { ok: true, value: '/a/file' });
  assert.deepEqual(await handlers[DESKTOP_CHANNELS.pickFiles]?.('game'), { ok: true, value: ['/a/1', '/a/2'] });
  assert.equal(seen.length, 3);
  assert.deepEqual(api.calls, ['folder', 'file:csv', 'files:game']);
});

test('arguments from the page are checked before anything runs', async () => {
  const api = deps();
  const handlers = createDesktopHandlers(api);
  for (const bad of ['exe', '', undefined, null, 42, { kind: 'csv' }, ['csv']]) {
    const reply = await handlers[DESKTOP_CHANNELS.pickFile]?.(bad);
    assert.equal(reply?.ok, false, String(bad));
  }
  assert.equal((await handlers[DESKTOP_CHANNELS.pickFiles]?.('image'))?.ok, false, 'several files only for games');
  assert.equal((await handlers[DESKTOP_CHANNELS.pickFiles]?.(undefined))?.ok, false);
  assert.deepEqual(api.calls, [], 'no dialog was opened');
});

test('a failure travels as data, with its message', async () => {
  const handlers = createDesktopHandlers(
    deps({
      pickFolder: async () => {
        throw new Error('The dialog is unavailable');
      },
    }),
  );
  assert.deepEqual(await handlers[DESKTOP_CHANNELS.pickFolder]?.(), { ok: false, message: 'The dialog is unavailable' });
});
