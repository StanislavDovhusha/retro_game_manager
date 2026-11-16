import { Injectable } from '@angular/core';
import { DESKTOP_BRIDGE_NAME } from '@shared/desktop';
import type { DesktopBridge } from '@shared/desktop';

const isDesktopBridge = (value: unknown): value is DesktopBridge =>
  typeof value === 'object' &&
  value !== null &&
  (value as { isDesktop?: unknown }).isDesktop === true &&
  ['pickFolder', 'pickFile', 'pickFiles'].every((name) => typeof (value as Record<string, unknown>)[name] === 'function');

/**
 * The link to the desktop (Electron) shell. In the desktop app its preload script puts a small object on `window`
 * (see shared/desktop.ts); in an ordinary browser there is none, and everything goes through the HTTP API.
 */
@Injectable({ providedIn: 'root' })
export class DesktopService {
  /** The bridge of the desktop shell, or `null` when the page runs in a browser. */
  readonly bridge: DesktopBridge | null = this.findBridge();

  get isDesktop(): boolean {
    return this.bridge !== null;
  }

  private findBridge(): DesktopBridge | null {
    const candidate: unknown = Reflect.get(globalThis, DESKTOP_BRIDGE_NAME);
    return isDesktopBridge(candidate) ? candidate : null;
  }
}
