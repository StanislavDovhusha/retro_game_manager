import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { setNativeOpenDialog } from '../../src/services/dialogService.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();

test('the dialog endpoints use the native dialog the host application registered', async () => {
  setNativeOpenDialog(async ({ properties }) =>
    properties.includes('openDirectory') ? ['/media/anna/GAMECARD'] : ['/a/1.gba', '/a/2.gba'],
  );
  try {
    assert.deepEqual((await api('POST', '/api/dialog/folder')).body, { path: '/media/anna/GAMECARD' });
    assert.deepEqual((await api('POST', '/api/dialog/file', { body: { kind: 'game', multiple: true } })).body, {
      paths: ['/a/1.gba', '/a/2.gba'],
    });
    assert.deepEqual((await api('POST', '/api/dialog/file', { body: { kind: 'csv' } })).body, { path: '/a/1.gba' });
    assert.equal((await api('POST', '/api/dialog/file', { body: { kind: 'exe' } })).status, 400);
  } finally {
    setNativeOpenDialog(null);
  }
});
