import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config/index.ts';
import { dataPaths } from '../utils/dataPaths.ts';
import { t } from '../i18n/index.ts';
import type { FileKind, StagedFile, UploadResponse } from '../models/index.ts';
import { InsufficientStorageError, NotFoundError, PayloadTooLargeError, ValidationError } from '../utils/errors.ts';
import { errorCode, errorMessage } from '../utils/guards.ts';
import { assertImageFile } from './fs/imageSignature.ts';

/**
 * Files dropped into the window (drag and drop) have no path on disk in the browser, so their content is uploaded
 * to a staging folder and copied from there to the right place when the game is added. The staging folder is
 * emptied on start-up and files older than the configured TTL are swept away.
 */
const STAGING = dataPaths.uploads;
const staged = new Map<string, StagedFile>();

const maxBytes = (kind: FileKind): number => (kind === 'image' ? config.maxImageBytes : config.maxGameUploadBytes);

const tooLarge = (kind: FileKind): PayloadTooLargeError =>
  new PayloadTooLargeError(t('The file is too large (at most {max} MB)', { max: Math.floor(maxBytes(kind) / (1024 * 1024)) }));

export async function initStaging(): Promise<void> {
  await fsp.rm(STAGING, { recursive: true, force: true });
  await fsp.mkdir(STAGING, { recursive: true });
}

async function sweep(): Promise<void> {
  const now = Date.now();
  for (const [id, file] of staged) {
    if (now - file.createdAt > config.uploadTtlMs) await discardStaged(id);
  }
}

/** Receives a raw upload as a stream (never buffered as a whole) and enforces the size and type limits. */
export async function stageUpload(
  req: Readable & { headers: Record<string, unknown> },
  { kind, name }: { kind: FileKind; name: string },
): Promise<UploadResponse> {
  await sweep();
  await fsp.mkdir(STAGING, { recursive: true });
  const max = maxBytes(kind);
  if (Number(req.headers['content-length']) > max) throw tooLarge(kind);

  const id = crypto.randomUUID();
  const file = path.join(STAGING, id);
  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > max) callback(tooLarge(kind));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(req, counter, fs.createWriteStream(file));
  } catch (err) {
    await fsp.rm(file, { force: true });
    if (err instanceof PayloadTooLargeError) throw err;
    if (errorCode(err) === 'ENOSPC') throw new InsufficientStorageError(t('Not enough disk space to upload the file'));
    throw new ValidationError(t('Upload interrupted: {message}', { message: errorMessage(err) }), { cause: err });
  }
  if (size === 0) {
    await fsp.rm(file, { force: true });
    throw new ValidationError(t('The file is empty'));
  }
  if (kind === 'image') {
    try {
      await assertImageFile(file);
    } catch (err) {
      await fsp.rm(file, { force: true });
      throw err;
    }
  }
  staged.set(id, { id, path: file, name, kind, size, createdAt: Date.now() });
  return { id, name, size };
}

/** Details of an uploaded file. The id must be one from our own table; the path is built on the server. */
export async function resolveStaged(id: string): Promise<StagedFile> {
  const file = staged.get(id);
  if (!file) throw new NotFoundError(t('The uploaded file has expired — choose it again'));
  try {
    await fsp.access(file.path);
  } catch {
    staged.delete(file.id);
    throw new NotFoundError(t('The uploaded file has expired — choose it again'));
  }
  return file;
}

export async function discardStaged(id: string): Promise<void> {
  const file = staged.get(id);
  if (!file) return;
  staged.delete(file.id);
  await fsp.rm(file.path, { force: true }).catch(() => undefined);
}
