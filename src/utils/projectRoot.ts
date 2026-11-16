import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Project root (the folder with package.json). The code runs both from sources (`src/`) and from the build
 * (`build/src/`), so the root is found by walking up from the given module URL.
 */
export async function findProjectRoot(fromUrl: string): Promise<string> {
  const start = path.dirname(fileURLToPath(fromUrl));
  let dir = start;
  for (;;) {
    const found = await fs.access(path.join(dir, 'package.json')).then(
      () => true,
      () => false,
    );
    if (found) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

/** True if the folder holds a built web client (an index.html). */
export const hasIndexHtml = (dir: string): Promise<boolean> =>
  fs.access(path.join(dir, 'index.html')).then(
    () => true,
    () => false,
  );
