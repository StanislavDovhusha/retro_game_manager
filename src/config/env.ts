import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const MIB = 1024 * 1024;
/** FAT32 (the usual SD card format) cannot hold files of 4 GiB or more. */
const FAT32_MAX_FILE_BYTES = 4 * 1024 * MIB - 1;

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/** One `scheme://host[:port]` origin per list item; anything with a path, query or credentials is rejected. */
const originList = z
  .string()
  .transform((raw) =>
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .superRefine((items, ctx) => {
    for (const item of items) {
      let origin: string | null = null;
      try {
        origin = new URL(item).origin;
      } catch {
        /* reported below */
      }
      if (origin !== item) {
        ctx.addIssue({ code: 'custom', message: `"${item}" is not a valid origin (expected e.g. http://localhost:5173)` });
      }
    }
  });

/** Raw environment variables (everything arrives as strings). */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('127.0.0.1'),
  DATA_DIR: z.string().min(1).optional(),
  /** Legacy name of DATA_DIR, still honoured. */
  CLIENT_ORIGIN: originList.prefault('http://localhost:5173,http://127.0.0.1:5173'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** Optional file for the log (JSON lines). Without it the log goes to the standard output. */
  LOG_FILE: z.string().min(1).optional(),
  JSON_BODY_LIMIT: z
    .string()
    .regex(/^\d+(b|kb|mb|gb)$/i, 'expected a size such as 25mb')
    .default('25mb'),
  MAX_IMAGE_BYTES: positiveInt(20 * MIB),
  MAX_GAME_UPLOAD_BYTES: positiveInt(FAT32_MAX_FILE_BYTES),
  UPLOAD_TTL_MINUTES: positiveInt(60),
  /** Set to 1 by the desktop (Electron) shell: features that start programs on this computer (the emulator) are on. */
  GAME_MANAGER_DESKTOP: z.enum(['0', '1']).default('0'),
  /** The application version, set by the desktop shell from app.getVersion(); without it package.json is read. */
  APP_VERSION: z.string().max(64).optional(),
});

/** The data folder when DATA_DIR is not set. */
export const DEFAULT_DATA_DIR = path.join(os.homedir(), '.retro-game-manager');

export type LogLevelName = (typeof LOG_LEVELS)[number];

/** Validated, typed application configuration. */
export interface AppConfig {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly isProduction: boolean;
  readonly port: number;
  readonly host: string;
  /** Folder for settings, backups, the operations journal and staged uploads. */
  readonly dataDir: string;
  /** DATA_DIR is not set: the default folder is used (and the data of older versions is moved into it). */
  readonly dataDirIsDefault: boolean;
  /** Origins allowed to call the API cross-origin (the web client). */
  readonly clientOrigins: readonly string[];
  readonly logLevel: LogLevelName;
  /** Absolute path of the log file, or null to log to the standard output. */
  readonly logFile: string | null;
  readonly jsonBodyLimit: string;
  readonly maxImageBytes: number;
  readonly maxGameUploadBytes: number;
  readonly uploadTtlMs: number;
  /** The server runs inside the desktop application (games can be started in an emulator). */
  readonly desktop: boolean;
  /** The version given by the desktop shell (APP_VERSION), or null: the version of package.json is used. */
  readonly appVersion: string | null;
}

/** Thrown when the environment does not match the schema; the message lists every problem. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Validates an environment (normally `process.env`). Empty values count as "not set". */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): AppConfig {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== ''));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.') || 'environment'}: ${issue.message}`);
    throw new ConfigError(lines.join('\n'));
  }
  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    host: env.HOST,
    dataDir: path.resolve(env.DATA_DIR ?? DEFAULT_DATA_DIR),
    dataDirIsDefault: env.DATA_DIR === undefined,
    clientOrigins: env.CLIENT_ORIGIN,
    logLevel: env.LOG_LEVEL,
    logFile: env.LOG_FILE ? path.resolve(env.LOG_FILE) : null,
    jsonBodyLimit: env.JSON_BODY_LIMIT,
    maxImageBytes: env.MAX_IMAGE_BYTES,
    maxGameUploadBytes: env.MAX_GAME_UPLOAD_BYTES,
    uploadTtlMs: env.UPLOAD_TTL_MINUTES * 60 * 1000,
    desktop: env.GAME_MANAGER_DESKTOP === '1',
    appVersion: env.APP_VERSION ?? null,
  };
}
