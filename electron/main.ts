import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { createDesktopHandlers } from './desktopApi.ts';
import { macMenuTemplate } from './menu.ts';
import { COPYRIGHT, LICENSE_ID, LICENSE_NAME, REPOSITORY_URL } from '../shared/app-info.ts';
import { LEGACY_PRODUCT_NAMES, moveLegacyData, type FolderMove } from '../src/utils/legacyData.ts';
import { createWebPreferences, decideNavigation, isTrustedUrl } from './security.ts';

/**
 * The main process of the desktop application. It starts the same Express server the browser version uses — inside
 * this process, on a free local port — and shows the web client served by it in a locked-down window. When the last
 * window closes, the server is stopped cleanly before the process exits.
 *
 * Development (`npm run dev`): the Angular dev server serves the client (hot reload) and its address arrives in
 * ELECTRON_RENDERER_URL; the embedded server then listens on the fixed port the dev proxy points to.
 */

const APP_ROOT = app.getAppPath(); // the project folder in development, the app.asar archive in a packaged app
const rendererUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const DEV_API_PORT = 3001; // client/proxy.conf.json

// The server reads its configuration from the environment when its modules are loaded, so it is set up first.
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';
process.env.HOST = '127.0.0.1';
process.env.GAME_MANAGER_DESKTOP = '1'; // starting games in an emulator is a desktop-only feature
process.env.APP_VERSION = app.getVersion(); // the version the update check compares with GitHub's latest release
process.env.DATA_DIR = app.getPath('userData'); // settings (last SD card, language), backups, journal, uploads
process.env.LOG_FILE ??= path.join(app.getPath('userData'), 'logs', 'retro-game-manager.log');
if (rendererUrl) process.env.CLIENT_ORIGIN = new URL(rendererUrl).origin;

let mainWindow: BrowserWindow | null = null;
let stopServer: (() => Promise<void>) | null = null;
let isQuitting = false;
let confirmedClose = false;

function showStartupError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  dialog.showErrorBox(app.getName(), `The application could not start.\n\n${message}`);
}

/** Applies the navigation rules to every web contents the application ever creates (windows, frames, popups). */
function lockDownWebContents(trustedOrigins: readonly string[]): void {
  app.on('web-contents-created', (_event, contents) => {
    const guard = (event: { preventDefault(): void; readonly url: string }): void => {
      const decision = decideNavigation(event.url, trustedOrigins);
      if (decision === 'allow') return;
      event.preventDefault();
      if (decision === 'open-externally') void shell.openExternal(event.url);
    };
    contents.on('will-navigate', guard);
    contents.on('will-redirect', guard);
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (decideNavigation(url, trustedOrigins) === 'open-externally') void shell.openExternal(url);
      return { action: 'deny' }; // no new windows inside the application, ever
    });
  });
  // The page asks for nothing the application needs (camera, location, notifications, …).
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

/**
 * macOS: the application menu named after the app, the About panel, and — in development, where the process is the
 * Electron binary with Electron's icon — the app's own Dock icon. The packaged app gets its icon and menu bar title from
 * its bundle (resources/icon.icns and productName, set by electron-builder).
 */
function setUpMacApp(): void {
  if (process.platform !== 'darwin') return;
  const name = app.getName(); // productName of package.json
  // The About window: the version, the copyright, the license and where the source code is.
  app.setAboutPanelOptions({
    applicationName: name,
    applicationVersion: app.getVersion(),
    copyright: COPYRIGHT,
    credits: `License: ${LICENSE_NAME} (${LICENSE_ID})\n${REPOSITORY_URL}`,
    website: REPOSITORY_URL,
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(macMenuTemplate({ name, dev: !app.isPackaged })));
  if (!app.isPackaged) app.dock?.setIcon(path.join(APP_ROOT, 'resources', 'icon-mac.png'));
}

function createWindow(url: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false, // shown when the first frame is ready: no white flash
    backgroundColor: '#0f172a',
    title: app.getName(),
    icon: path.join(APP_ROOT, 'resources', 'icon.png'),
    webPreferences: createWebPreferences({ preloadPath: path.join(APP_ROOT, 'electron', 'preload.cjs'), devTools: !app.isPackaged }),
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    mainWindow = null;
  });
  void window.loadURL(url);
  return window;
}

async function start(): Promise<void> {
  // The data of the versions with an earlier name ("Game Manager", "SF3000 Game Manager") moves to the folder of the
  // current name once — before anything (the single-instance lock, the server) writes there. The outcome goes to the
  // log as soon as the logger is loaded; a failure keeps the old folder.
  const dataMoves: FolderMove[] = await moveLegacyData(
    LEGACY_PRODUCT_NAMES.map((name) => path.join(app.getPath('appData'), name)),
    app.getPath('userData'),
  );
  for (const move of dataMoves) {
    if (move.error) process.stderr.write(`The data of the previous version could not be moved from ${move.from}: ${move.error}\n`);
  }
  if (!app.requestSingleInstanceLock()) {
    app.quit(); // a second copy would share the settings file and the uploads folder with the first
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  await app.whenReady();
  setUpMacApp(); // before the server starts: the Dock icon and the menu appear at once

  // Loaded only now, after the environment above is set.
  const { logDataMoves, startServer } = await import('../src/startServer.ts');
  const { pickFile, pickFolder, setNativeOpenDialog } = await import('../src/services/dialogService.ts');
  const { getSettings } = await import('../src/services/settingsService.ts');
  const { runWithLang, setFallbackLang, t } = await import('../src/i18n/index.ts');
  const { matchLang } = await import('../shared/constants.ts');
  // Until a language is chosen in the settings (`auto`), native dialogs speak the language of the system.
  setFallbackLang(matchLang(app.getPreferredSystemLanguages()));
  const { currentOperation } = await import('../src/utils/lock.ts');
  const { hasIndexHtml } = await import('../src/utils/projectRoot.ts');
  const { logger } = await import('../src/utils/logger.ts');
  logDataMoves(dataMoves, app.getPath('userData'));

  const distDir = path.join(APP_ROOT, 'dist');
  if (!rendererUrl && !(await hasIndexHtml(distDir))) {
    throw new Error('The web client is not built (dist/index.html is missing). Run "npm run build:client" first.');
  }
  const server = await startServer({ distDir, host: '127.0.0.1', port: rendererUrl ? Number(process.env.PORT ?? DEV_API_PORT) : 0 });
  stopServer = () => server.close();
  const trustedOrigins = [server.origin, ...(rendererUrl ? [new URL(rendererUrl).origin] : [])];

  lockDownWebContents(trustedOrigins);
  if (process.platform !== 'darwin' && app.isPackaged) Menu.setApplicationMenu(null); // macOS has its own menu (setUpMacApp)

  // The native dialogs of the whole application (also the ones requested through the HTTP API) are Electron's.
  setNativeOpenDialog(async (options) => {
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  const inUserLanguage = async <T>(task: () => Promise<T>): Promise<T> => runWithLang((await getSettings()).ui.language, task);
  const handlers = createDesktopHandlers({
    pickFolder,
    pickFile: async (kind) => pickFile(kind, (await getSettings()).extensions),
    pickFiles: async (kind) => pickFile(kind, (await getSettings()).extensions, true),
    inUserLanguage,
  });
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      // Only the application's own top-level page may call the main process.
      const fromApp = event.senderFrame === event.sender.mainFrame && isTrustedUrl(event.senderFrame?.url, trustedOrigins);
      if (fromApp) return handler(...args);
      logger.warn({ channel, url: event.senderFrame?.url }, 'Refused a desktop request from an untrusted page');
      return { ok: false, message: 'Untrusted sender' };
    });
  }

  mainWindow = createWindow(rendererUrl ?? server.origin);
  // Closing the window while a file operation (rename, sync, …) runs: wait for the operation instead of cutting it.
  mainWindow.on('close', (event) => {
    const operation = currentOperation();
    if (confirmedClose || operation === null) return;
    event.preventDefault();
    const window = mainWindow;
    if (!window) return;
    void (async () => {
      const lang = (await getSettings()).ui.language;
      const text = runWithLang(lang, () => ({
        message: t('An operation is in progress: “{operation}”', { operation }),
        detail: t('The application will close as soon as it finishes.'),
        confirm: t('Close when finished'),
        cancel: t('Keep working'),
      }));
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        message: text.message,
        detail: text.detail,
        buttons: [text.confirm, text.cancel],
        defaultId: 1,
        cancelId: 1,
      });
      if (response === 0) {
        confirmedClose = true;
        window.close();
      }
    })();
  });
}

// One quit path for everything (window closed, Cmd+Q, system shutdown, Ctrl+C in development):
// stop the server first, then really quit.
app.on('window-all-closed', () => app.quit()); // on macOS too: the application is one window plus its server
app.on('before-quit', (event) => {
  if (isQuitting) return;
  isQuitting = true;
  if (!stopServer) return;
  event.preventDefault();
  void stopServer()
    .catch(() => undefined)
    .finally(() => app.quit());
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => app.quit());

start().catch((err: unknown) => {
  showStartupError(err);
  isQuitting = true;
  app.quit();
});
