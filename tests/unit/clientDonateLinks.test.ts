import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGS } from '../../shared/constants.ts';

interface Config {
  DONATE_LINKS: readonly { id: string; url: string; icon: string }[];
  DONATE_CRYPTO: readonly unknown[];
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configFile = path.join(root, 'client/src/app/features/donate/donate.config.ts');
const config = (await import(pathToFileURL(configFile).href)) as Config;

test('support links: Ko-fi and GitHub, https only', () => {
  assert.deepEqual(
    config.DONATE_LINKS.map((link) => [link.id, link.url]),
    [
      ['kofi', 'https://ko-fi.com/stanislav31259'],
      ['github', 'https://github.com/StanislavDovhusha/retro_game_manager'],
    ],
  );
  for (const link of config.DONATE_LINKS) assert.equal(new URL(link.url).protocol, 'https:');
  assert.ok(config.DONATE_CRYPTO.length > 0, 'the crypto slider stays');
});

test('card, Monobank and PayPal are gone from the config and the popup', () => {
  const sources = [
    fs.readFileSync(configFile, 'utf8'),
    fs.readFileSync(path.join(root, 'client/src/app/features/donate/donate-popup/donate-popup.component.html'), 'utf8'),
  ].join('\n');
  assert.ok(!/monobank|paypal|DONATE_REQUISITES|requisites\./i.test(sources));
});

test('the popup has no "Don’t show again": automatic shows are switched only in the settings', () => {
  const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
  const popup = read('client/src/app/features/donate/donate-popup/donate-popup.component.html');
  assert.ok(!/dontShowAgain|disableAutomatic/.test(popup + read('client/src/app/features/dialogs/dialog-host/dialog-host.component.html')));
  for (const lang of LANGS) {
    const donate = (JSON.parse(read(`client/public/i18n/${lang}.json`)) as { donate: Record<string, unknown> }).donate;
    assert.equal(donate['dontShowAgain'], undefined, lang);
    assert.equal(donate['autoOff'], undefined, lang);
  }
  assert.match(read('client/src/app/features/dialogs/settings-dialog/settings-dialog.component.html'), /setDonateAutoShow/);
});

test('the support button and the popup use the SVG coffee/beer icon; reduced motion keeps a still coffee cup', () => {
  const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
  const footer = read('client/src/app/features/status/status-bar/status-bar.component.html');
  assert.match(footer, /<app-donate-icon/);
  assert.ok(!footer.includes('☕'), 'no coffee emoji any more');
  assert.match(read('client/src/app/features/donate/donate-popup/donate-popup.component.html'), /<app-donate-icon/);
  assert.match(read('client/src/app/features/donate/donate-icon/donate-icon.component.html'), /stroke="currentColor"/);
  const scss = read('client/src/app/features/donate/donate-icon/donate-icon.component.scss');
  const reduced = scss.slice(scss.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /animation: none/);
  assert.match(reduced, /\.beer \{\s*display: none;/);
  assert.ok(
    !/:not\(:hover\)/.test(read('client/src/app/features/status/status-bar/status-bar.component.scss')),
    'hovering does not stop the animation',
  );
});
