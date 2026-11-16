import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { systemSpawner } from '../../src/services/emulatorService.ts';

test('starting an emulator: an immediate failure is reported with its error output', async () => {
  await assert.rejects(systemSpawner(process.execPath, ['-e', 'console.error("core not found"); process.exit(3)']), /core not found/);
  await assert.rejects(systemSpawner('/nonexistent/retroarch', []), /ENOENT/);
});

test('starting an emulator: a program that keeps running counts as started and is left running on its own', async () => {
  const started = Date.now();
  await systemSpawner(process.execPath, ['-e', 'setTimeout(() => {}, 2500)']);
  assert.ok(Date.now() - started >= 1400, 'it waited a moment for an early failure');
});

test('starting an emulator: a launcher that exits cleanly at once (open -a) counts as started', async () => {
  await systemSpawner(process.execPath, ['-e', 'process.exit(0)']);
});
