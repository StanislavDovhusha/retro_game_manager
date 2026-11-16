import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebPreferences, decideNavigation, isSafeExternalUrl, isTrustedUrl } from '../../electron/security.ts';

const TRUSTED = ['http://127.0.0.1:41234'];

test('the window is isolated, sandboxed and has no Node.js', () => {
  const prefs = createWebPreferences({ preloadPath: '/app/electron/preload.cjs', devTools: false });
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.webSecurity, true);
  assert.equal(prefs.allowRunningInsecureContent, false);
  assert.equal(prefs.webviewTag, false);
  assert.equal(prefs.nodeIntegrationInWorker, false);
  assert.equal(prefs.nodeIntegrationInSubFrames, false);
  assert.equal(prefs.preload, '/app/electron/preload.cjs');
  assert.equal(prefs.devTools, false);
  assert.equal(createWebPreferences({ preloadPath: 'x', devTools: true }).devTools, true);
});

test('only the application origin is trusted: scheme, host and port must all match', () => {
  assert.equal(isTrustedUrl('http://127.0.0.1:41234/', TRUSTED), true);
  assert.equal(isTrustedUrl('http://127.0.0.1:41234/some/route?x=1#y', TRUSTED), true);
  for (const other of [
    'http://127.0.0.1:41235/',
    'https://127.0.0.1:41234/',
    'http://localhost:41234/',
    'http://127.0.0.1:41234.evil.example/',
    'http://127.0.0.1:41234@evil.example/',
    'file:///etc/passwd',
    'about:blank',
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
    'not a url',
    '',
  ]) {
    assert.equal(isTrustedUrl(other, TRUSTED), false, other);
  }
  assert.equal(isTrustedUrl(undefined, TRUSTED), false);
  assert.equal(isTrustedUrl('http://127.0.0.1:41234/', []), false);
});

test('only http(s) links are handed to the system browser', () => {
  assert.equal(isSafeExternalUrl('https://github.com/example/repo'), true);
  assert.equal(isSafeExternalUrl('http://example.com'), true);
  for (const unsafe of [
    'file:///C:/Windows/System32/calc.exe',
    'javascript:alert(1)',
    'ms-msdt:/id',
    'vscode://open',
    'smb://host/share',
    'data:text/html,x',
    '//example.com',
    'example.com',
    '',
  ]) {
    assert.equal(isSafeExternalUrl(unsafe), false, unsafe);
  }
});

test('navigation: own pages stay in the window, web links open in the browser, the rest is blocked', () => {
  assert.equal(decideNavigation('http://127.0.0.1:41234/settings', TRUSTED), 'allow');
  assert.equal(decideNavigation('https://example.com/docs', TRUSTED), 'open-externally');
  assert.equal(decideNavigation('http://127.0.0.1:9999/', TRUSTED), 'open-externally'); // another local server is not our page
  assert.equal(decideNavigation('file:///etc/passwd', TRUSTED), 'block');
  assert.equal(decideNavigation('javascript:void(0)', TRUSTED), 'block');
});

test('in development the Angular dev server is trusted too', () => {
  const dev = ['http://127.0.0.1:3001', 'http://localhost:5173'];
  assert.equal(decideNavigation('http://localhost:5173/', dev), 'allow');
  assert.equal(decideNavigation('http://localhost:5174/', dev), 'open-externally');
});
