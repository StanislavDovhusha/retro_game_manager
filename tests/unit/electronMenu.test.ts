import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { MenuItemConstructorOptions } from 'electron';
import { macMenuTemplate } from '../../electron/menu.ts';

const items = (menu: MenuItemConstructorOptions | undefined): MenuItemConstructorOptions[] =>
  Array.isArray(menu?.submenu) ? (menu.submenu as MenuItemConstructorOptions[]) : [];

test('macOS menu: the first menu is named after the app, and so are About, Hide and Quit', () => {
  const [appMenu] = macMenuTemplate({ name: 'Retro Game Manager', dev: false });
  assert.equal(appMenu?.label, 'Retro Game Manager');
  const byRole = new Map(items(appMenu).map((item) => [item.role, item.label]));
  assert.equal(byRole.get('about'), 'About Retro Game Manager');
  assert.equal(byRole.get('hide'), 'Hide Retro Game Manager');
  assert.equal(byRole.get('quit'), 'Quit Retro Game Manager');
  assert.ok(!JSON.stringify(macMenuTemplate({ name: 'X', dev: true })).includes('Electron'));
});

test('macOS menu: the Edit roles that make copy and paste work in text fields; developer tools only in development', () => {
  const roles = (dev: boolean): string[] =>
    macMenuTemplate({ name: 'X', dev }).flatMap((menu) => items(menu).map((item) => item.role ?? ''));
  for (const role of ['copy', 'paste', 'cut', 'selectAll', 'undo', 'redo']) assert.ok(roles(false).includes(role), role);
  assert.ok(!roles(false).includes('toggleDevTools'));
  assert.ok(roles(true).includes('toggleDevTools'));
});
