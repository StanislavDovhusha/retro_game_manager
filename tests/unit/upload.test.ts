import { work } from '../helpers/env.ts';
import '../helpers/smallLimits.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { assertImageFile, detectImageFormat } from '../../src/services/fs/imageSignature.ts';
import { discardStaged, initStaging, resolveStaged, stageUpload } from '../../src/services/uploadService.ts';
import { exists, isAppError } from '../helpers/fs.ts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const staging = path.join(work, 'data', 'temp', 'uploads');

/** A fake request: a stream with headers. */
const request = (body: Buffer, headers: Record<string, unknown> = {}): Readable & { headers: Record<string, unknown> } =>
  Object.assign(Readable.from([body]), { headers: { 'content-length': String(body.length), ...headers } });

await initStaging();

test('image signatures are recognised by content, not by name', () => {
  assert.equal(detectImageFormat(PNG), 'png');
  assert.equal(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(detectImageFormat(Buffer.from('GIF89a')), 'gif');
  assert.equal(detectImageFormat(Buffer.from('BM123')), 'bmp');
  assert.equal(detectImageFormat(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(detectImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectImageFormat(Buffer.from('MZ\x90\0')), null);
});

test('assertImageFile rejects a non-image file', async () => {
  const good = path.join(work, 'good.png');
  const bad = path.join(work, 'bad.png');
  await fs.writeFile(good, PNG);
  await fs.writeFile(bad, '<html>not an image</html>');
  assert.equal(await assertImageFile(good), 'png');
  await assert.rejects(assertImageFile(bad), isAppError(400, 'VALIDATION_ERROR'));
});

test('an image upload is staged, can be resolved and discarded', async () => {
  const result = await stageUpload(request(PNG), { kind: 'image', name: 'cover.png' });
  assert.equal(result.size, PNG.length);
  assert.equal(result.name, 'cover.png');
  const staged = await resolveStaged(result.id);
  assert.ok(staged.path.startsWith(staging + path.sep), 'staged files live in the staging folder, named by a server-side id');
  assert.deepEqual(await fs.readFile(staged.path), PNG);
  await discardStaged(result.id);
  assert.ok(!(await exists(staged.path)));
  await assert.rejects(resolveStaged(result.id), isAppError(404));
});

test('an upload whose content is not an image is refused and leaves nothing behind', async () => {
  await assert.rejects(
    stageUpload(request(Buffer.from('MZ not an image')), { kind: 'image', name: 'evil.png' }),
    isAppError(400, 'VALIDATION_ERROR'),
  );
  assert.deepEqual(await fs.readdir(staging), []);
});

test('the size limit applies by Content-Length and also by the bytes really received', async () => {
  const big = Buffer.alloc(3000, 1); // the image limit is 2048 in these tests
  await assert.rejects(stageUpload(request(big), { kind: 'image', name: 'big.png' }), isAppError(413, 'PAYLOAD_TOO_LARGE'));
  // A client that lies about the length: the stream is cut when the limit is exceeded.
  await assert.rejects(
    stageUpload(request(big, { 'content-length': '10' }), { kind: 'image', name: 'big.png' }),
    isAppError(413, 'PAYLOAD_TOO_LARGE'),
  );
  assert.deepEqual(await fs.readdir(staging), []);
});

test('game files have their own (larger) limit; an empty file is refused', async () => {
  const ok = await stageUpload(request(Buffer.alloc(3000, 2)), { kind: 'game', name: 'a.gba' });
  assert.equal(ok.size, 3000);
  await discardStaged(ok.id);
  await assert.rejects(stageUpload(request(Buffer.alloc(5000, 2)), { kind: 'game', name: 'a.gba' }), isAppError(413));
  await assert.rejects(stageUpload(request(Buffer.alloc(0)), { kind: 'game', name: 'a.gba' }), isAppError(400, 'VALIDATION_ERROR'));
});

test('resolveStaged knows only server-issued ids (no paths from the client)', async () => {
  for (const evil of ['../../etc/passwd', '/etc/passwd', 'nonexistent']) await assert.rejects(resolveStaged(evil), isAppError(404));
});
