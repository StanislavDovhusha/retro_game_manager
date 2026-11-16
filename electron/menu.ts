import type { MenuItemConstructorOptions } from 'electron';

/**
 * The application menu of macOS. Without it macOS shows Electron's default menu, whose first item and its About, Hide
 * and Quit entries are named "Electron" while the app runs from the Electron binary (npm run dev). The packaged app
 * takes the bold menu bar title from its bundle (productName); the entries below carry the name in both cases.
 *
 * Pure (a template, no Electron calls): tested without starting Electron. The Edit menu is not decoration: on macOS
 * the copy, paste and select-all shortcuts of text fields only work through its roles.
 */
export function macMenuTemplate(options: { name: string; dev: boolean }): MenuItemConstructorOptions[] {
  const { name, dev } = options;
  return [
    {
      label: name,
      submenu: [
        { role: 'about', label: `About ${name}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${name}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${name}` },
      ],
    },
    {
      role: 'editMenu',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        ...(dev ? ([{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }] as const) : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
}
