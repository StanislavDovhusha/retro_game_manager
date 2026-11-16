import type { WebPreferences } from 'electron';

/**
 * Rules that keep the application window locked down. They are plain functions (no Electron objects), so they can
 * be tested without Electron; `main.ts` applies them.
 */

/** The origin (`scheme://host:port`) of a URL, or null when it is not a valid absolute URL. */
const originOf = (url: string): string | null => {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
};

/** True when `url` belongs to the application itself (one of the trusted origins). */
export function isTrustedUrl(url: string | undefined, trustedOrigins: readonly string[]): boolean {
  if (!url) return false;
  const origin = originOf(url);
  return origin !== null && trustedOrigins.includes(origin);
}

/** Only web links are handed to the system browser: never `file:`, `javascript:`, custom protocol handlers, … */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** What to do with a navigation or a new-window request. */
export type NavigationDecision = 'allow' | 'open-externally' | 'block';

/** The window may only show the application's own pages; web links go to the system browser; the rest is blocked. */
export function decideNavigation(url: string, trustedOrigins: readonly string[]): NavigationDecision {
  if (isTrustedUrl(url, trustedOrigins)) return 'allow';
  return isSafeExternalUrl(url) ? 'open-externally' : 'block';
}

/** Renderer settings: isolated, sandboxed, no Node.js; the only bridge is the preload script. */
export function createWebPreferences({ preloadPath, devTools }: { preloadPath: string; devTools: boolean }): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    experimentalFeatures: false,
    spellcheck: false,
    devTools,
  };
}
