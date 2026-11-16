import fs from 'node:fs/promises';
import path from 'node:path';
import type { UpdateRelease, UpdateStatusResponse } from '../../shared/api.ts';
import { RELEASES_URL as RELEASES_PAGE_URL } from '../../shared/app-info.ts';
import { config } from '../config/index.ts';
import type { Settings } from '../models/index.ts';
import { errorMessage } from '../utils/guards.ts';
import { logger } from '../utils/logger.ts';
import { findProjectRoot } from '../utils/projectRoot.ts';
import { getSettings, patchInternal } from './settingsService.ts';
import { isNewer, releaseVersion } from './update/version.ts';

/**
 * Is there a newer version of the application? The latest release of the GitHub repository is asked for (drafts and
 * pre-releases are never "latest"), on the server — the browser part never talks to GitHub. On start the client asks
 * for the status, and the check runs only when it is switched on and the last answer is older than a day; "Check now"
 * checks at once. No connection, an error, the API limit (403/429) or a repository without releases (404) are written
 * to the log only: the user sees nothing.
 */

export const RELEASES_URL = 'https://api.github.com/repos/StanislavDovhusha/retro_game_manager/releases/latest';
/** Where the user is sent when the release has no usable page link of its own. */
const RELEASES_PAGE = RELEASES_PAGE_URL;
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const CHECK_TIMEOUT_MS = 5000;

export type UpdateFetcher = (url: string, init: RequestInit) => Promise<Response>;
const realFetch: UpdateFetcher = (url, init) => fetch(url, init);
let fetcher: UpdateFetcher = realFetch;

/** Tests answer instead of GitHub (null: the real network again). */
export function setUpdateFetcher(replacement: UpdateFetcher | null): void {
  fetcher = replacement ?? realFetch;
}

let packageVersion: string | null = null;

/** The version of this application: the desktop shell's app.getVersion(), or package.json. */
export async function currentVersion(): Promise<string> {
  if (config.appVersion) return config.appVersion;
  if (packageVersion === null) {
    try {
      const root = await findProjectRoot(import.meta.url);
      const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as { version?: unknown };
      packageVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    } catch (err) {
      logger.warn({ err: errorMessage(err) }, 'Update check: the application version could not be read');
      packageVersion = '0.0.0';
    }
  }
  return packageVersion;
}

type FetchResult = { ok: true; release: UpdateRelease | null } | { ok: false };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A release page link that is safe to open: an https page on github.com. */
function releasePage(value: unknown): string {
  try {
    const url = new URL(text(value));
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : RELEASES_PAGE;
  } catch {
    return RELEASES_PAGE;
  }
}

/** Asks GitHub. `ok: true` — it answered (with or without a usable release); `ok: false` — no answer worth keeping. */
async function fetchLatest(): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetcher(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'retro-game-manager', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn({ err: errorMessage(err) }, 'Update check: GitHub could not be reached');
    return { ok: false };
  }
  if (response.status === 404) {
    logger.info('Update check: the repository has no releases yet');
    return { ok: true, release: null };
  }
  if (response.status === 403 || response.status === 429) {
    logger.warn({ status: response.status, reset: response.headers.get('x-ratelimit-reset') }, 'Update check: GitHub API limit reached');
    return { ok: false };
  }
  if (!response.ok) {
    logger.warn({ status: response.status }, 'Update check: unexpected answer from GitHub');
    return { ok: false };
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch (err) {
    logger.warn({ err: errorMessage(err) }, 'Update check: the answer of GitHub could not be read');
    return { ok: false };
  }
  if (body['draft'] === true || body['prerelease'] === true) return { ok: true, release: null };
  const tag = text(body['tag_name']);
  const version = releaseVersion(tag);
  if (!version) {
    logger.warn({ tag }, 'Update check: the version of the latest release could not be read from its tag; no update assumed');
    return { ok: true, release: null };
  }
  return { ok: true, release: { version, url: releasePage(body['html_url']), name: text(body['name']).slice(0, 200) } };
}

async function statusOf(settings: Settings, check: UpdateStatusResponse['check']): Promise<UpdateStatusResponse> {
  const current = await currentVersion();
  const { latestVersion, latestUrl, latestName, dismissedVersion } = settings.updates;
  const available = latestVersion && isNewer(latestVersion, current) ? { version: latestVersion, url: latestUrl, name: latestName } : null;
  // A closed notice stays closed for that version and older ones; a newer release shows again.
  const dismissed = available !== null && dismissedVersion !== '' && !isNewer(available.version, dismissedVersion);
  return { current, available, dismissed, check };
}

let running: Promise<UpdateStatusResponse> | null = null;

/** One check at a time: a start-up check and "Check now" at the same moment share the request. */
function runCheck(): Promise<UpdateStatusResponse> {
  running ??= (async () => {
    try {
      const result = await fetchLatest();
      if (!result.ok) return statusOf(await getSettings(), 'failed');
      const saved = await patchInternal((settings) => {
        settings.updates.lastCheckAt = Date.now();
        settings.updates.latestVersion = result.release?.version ?? '';
        settings.updates.latestUrl = result.release?.url ?? '';
        settings.updates.latestName = result.release?.name ?? '';
      });
      const status = await statusOf(saved, 'checked');
      if (status.available)
        logger.info({ current: status.current, latest: status.available.version }, 'Update check: a newer version is available');
      return status;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** The start of the application: checks when it is switched on and the last answer is more than a day old. */
export async function updateStatus(): Promise<UpdateStatusResponse> {
  const settings = await getSettings();
  const { checkOnStartup, lastCheckAt } = settings.updates;
  const due = checkOnStartup && (Date.now() - lastCheckAt >= CHECK_INTERVAL_MS || lastCheckAt > Date.now());
  return due ? runCheck() : statusOf(settings, 'skipped');
}

/** "Check now": at once, whatever the switch and the time of the last check. */
export const checkForUpdates = (): Promise<UpdateStatusResponse> => runCheck();
