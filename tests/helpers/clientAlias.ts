import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const withTs = (file: string): string | null =>
  [`${file}.ts`, path.join(file, 'index.ts')].find((candidate) => fs.existsSync(candidate)) ?? null;

/**
 * The client is written for a bundler: `@shared/...` is a path alias and relative imports have no extension. This
 * teaches Node the same two rules, so the pure logic of the client (no Angular in it) can be tested like any other
 * module. Import this file first, then load the client module with a dynamic import.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@shared/')) {
      return nextResolve(pathToFileURL(path.join(root, 'shared', `${specifier.slice('@shared/'.length)}.ts`)).href, context);
    }
    // `./text.utils` has no real extension either: only a known module extension counts as one.
    if (specifier.startsWith('.') && !/\.(?:[cm]?[jt]s|json)$/.test(specifier) && context.parentURL?.startsWith('file:')) {
      const found = withTs(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (found) return nextResolve(pathToFileURL(found).href, context);
    }
    return nextResolve(specifier, context);
  },
});
