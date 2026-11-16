'use strict';
/**
 * Preload script. It runs in the isolated world of a sandboxed renderer, so it may only use Electron's renderer
 * modules — which is why it is plain CommonJS. It exposes a small, explicit API (window.gameManagerDesktop); the page
 * never gets `ipcRenderer`, `require` or any other Node.js or Electron object.
 * The names below must match shared/desktop.ts (tests/unit/electronBridge.test.ts checks it).
 */
const { contextBridge, ipcRenderer } = require('electron');

const BRIDGE_NAME = 'gameManagerDesktop';
const CHANNELS = {
  pickFolder: 'desktop:pick-folder',
  pickFile: 'desktop:pick-file',
  pickFiles: 'desktop:pick-files',
};

/** Calls the main process and unwraps its reply: `{ ok: true, value }` or `{ ok: false, message }`. */
async function call(channel, ...args) {
  const reply = await ipcRenderer.invoke(channel, ...args);
  if (reply && reply.ok === true) return reply.value;
  throw new Error(reply && typeof reply.message === 'string' ? reply.message : 'The desktop request failed');
}

contextBridge.exposeInMainWorld(
  BRIDGE_NAME,
  Object.freeze({
    isDesktop: true,
    pickFolder: () => call(CHANNELS.pickFolder),
    pickFile: (kind) => call(CHANNELS.pickFile, String(kind)),
    pickFiles: (kind) => call(CHANNELS.pickFiles, String(kind)),
  }),
);
