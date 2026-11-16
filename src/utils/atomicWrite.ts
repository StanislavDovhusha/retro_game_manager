import fs from 'node:fs/promises';

/** Writes through a temporary file and then replaces the target, so the original is never left half-written. */
export async function atomicWrite(target: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}
