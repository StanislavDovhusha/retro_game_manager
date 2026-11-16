import { ConfigError, parseEnv } from './env.ts';
import type { AppConfig } from './env.ts';

export { ConfigError, parseEnv } from './env.ts';
export type { AppConfig } from './env.ts';

/**
 * Loads the configuration once, at start-up. Variables come from the real environment; the npm scripts also load
 * `.env` (via `node --env-file-if-exists=.env`), and real variables win over the file. An invalid value stops the
 * process with a readable message instead of failing later in the middle of a request.
 */
function load(): AppConfig {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`Invalid configuration (see .env.example):\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

export const config: AppConfig = load();
