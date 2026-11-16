import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { t } from '../../i18n/index.ts';
import { assertNotProtected } from '../../utils/paths.ts';
import { ecmDecoder } from './ecm.ts';

/** Big chunks keep the disk busy without loading a whole disc image into memory. */
const CHUNK_BYTES = 4 * 1024 * 1024;

/** The hidden temporary file a result is written to before it gets its real name. */
export const tmpName = (dest: string): string => path.join(path.dirname(dest), `.${path.basename(dest)}.part-${process.pid}`);

async function finish(tmp: string, dest: string, expectedSize: number): Promise<void> {
  const st = await fsp.stat(tmp);
  if (st.size !== expectedSize) {
    throw new Error(t('the result size ({size}) does not match the expected size ({expectedSize})', { size: st.size, expectedSize }));
  }
  await fsp.rename(tmp, dest);
}

/**
 * Copies a file as a stream through a temporary hidden file and checks the size: no truncated files are ever left
 * in the games folder. The file is never loaded into memory as a whole.
 */
export async function copyAtomic(src: string, dest: string, expectedSize: number, onProgress?: (written: number) => void): Promise<void> {
  assertNotProtected(dest);
  const tmp = tmpName(dest);
  let written = 0;
  const count = async function* (chunks: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
    for await (const chunk of chunks) {
      written += chunk.length;
      onProgress?.(written);
      yield chunk;
    }
  };
  try {
    await pipeline(fs.createReadStream(src, { highWaterMark: CHUNK_BYTES }), count, fs.createWriteStream(tmp, { flags: 'wx' }));
    await finish(tmp, dest, expectedSize);
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

/** A source of the file being built: a plain file copied as it is, or an ECM archive unpacked on the fly. */
export interface BuildSource {
  path: string;
  /** Name for error messages. */
  name?: string;
  ecm?: boolean;
}

/** Progress of `buildAtomic`: bytes written so far and the index of the source being written. */
export type BuildProgress = (written: number, source: number) => void;

/**
 * Writes the sources one after another into `out` (which stays open): plain files as they are, ECM archives unpacked
 * while they are read. `onChunk` sees every piece of the resulting data. Returns the number of bytes written.
 */
export async function writeSources(
  sources: BuildSource[],
  out: Writable,
  onChunk?: (chunk: Buffer, written: number, source: number) => void,
): Promise<number> {
  let written = 0;
  for (const [index, source] of sources.entries()) {
    const input = fs.createReadStream(source.path, { highWaterMark: CHUNK_BYTES });
    const count = async function* (chunks: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
      for await (const chunk of chunks) {
        written += chunk.length;
        onChunk?.(chunk, written, index);
        yield chunk;
      }
    };
    if (source.ecm) await pipeline(input, ecmDecoder(source.name ?? path.basename(source.path)), count, out, { end: false });
    else await pipeline(input, count, out, { end: false });
  }
  return written;
}

/**
 * Builds one file from several sources (in the given order) as a stream, through a temporary file: plain files are
 * appended as they are, ECM archives are unpacked while they are read. Nothing is loaded into memory as a whole, and
 * when anything fails (a damaged archive, a full disk, a wrong size) the temporary file is removed.
 */
export async function buildAtomic(sources: BuildSource[], dest: string, expectedSize: number, onProgress?: BuildProgress): Promise<void> {
  assertNotProtected(dest);
  const tmp = tmpName(dest);
  const out = fs.createWriteStream(tmp, { flags: 'wx' });
  try {
    await writeSources(sources, out, (_chunk, written, index) => onProgress?.(written, index));
    await new Promise<void>((resolve, reject) => {
      out.once('error', reject);
      out.end(() => resolve());
    });
    await finish(tmp, dest, expectedSize);
  } catch (err) {
    out.destroy();
    await fsp.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

/** Concatenates several files into one (in the given order) as a stream, also through a temporary file. */
export const concatAtomic = (sources: string[], dest: string, expectedSize: number): Promise<void> =>
  buildAtomic(
    sources.map((source) => ({ path: source })),
    dest,
    expectedSize,
  );
