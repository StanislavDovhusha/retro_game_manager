import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  productName?: string;
  version?: string;
  author?: unknown;
  main?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

test('package.json: the name, version, entry point and desktop scripts are set', () => {
  assert.ok(pkg.productName, 'productName feeds the installer names');
  assert.match(pkg.version ?? '', /^\d+\.\d+\.\d+/);
  assert.equal(pkg.main, 'build/electron/main.js');
  for (const script of ['dev', 'build:win', 'build:mac', 'build:linux', 'build:all']) assert.ok(pkg.scripts[script], `script ${script}`);
  assert.ok(pkg.devDependencies['electron'] && pkg.devDependencies['electron-builder']);
  assert.ok(!JSON.stringify(pkg.author ?? '').includes('@'), 'no personal e-mail address in package.json');
});

test('sharp (cover conversion) is a run-time dependency, unpacked from the asar archive, with both Mac binaries in CI', () => {
  assert.ok(pkg.dependencies['sharp'], 'sharp is a dependency, not a dev dependency');
  const config = read('electron-builder.yml');
  assert.match(config, /asarUnpack:/);
  assert.ok(config.includes('node_modules/sharp/'), 'the module itself');
  assert.ok(config.includes('node_modules/@img/'), 'its prebuilt libvips binaries');
  const workflow = read('.github/workflows/release.yml');
  assert.ok(workflow.includes('for cpu in x64 arm64'), 'both Mac architectures');
  assert.ok(workflow.includes('--os=darwin --cpu="$cpu" "sharp@$version"'), 'the sharp binaries of each one');
});

test('the main process compiles to the file named in package.json', () => {
  assert.ok(fs.existsSync(path.join(root, 'electron/main.ts')));
  assert.ok(read('tsconfig.build.json').includes('electron/**/*.ts'));
  assert.ok(read('tsconfig.json').includes('electron/**/*.ts'));
});

test('electron-builder.yml: formats, icons and packaged files', () => {
  const config = read('electron-builder.yml');
  for (const target of ['nsis', 'portable', 'dmg', 'AppImage', 'deb']) assert.match(config, new RegExp(`target: ${target}\\b`), target);
  assert.match(config, /target: dmg, arch: \[x64, arm64\]/);
  for (const icon of ['resources/icon.ico', 'resources/icon.icns', 'resources/icon.png']) {
    assert.ok(config.includes(icon), `${icon} is referenced`);
    assert.ok(fs.existsSync(path.join(root, icon)), `${icon} exists`);
  }
  // Everything the main process loads at run time has to be in the package.
  for (const entry of ['build/electron/', 'build/src/', 'build/shared/', 'electron/preload.cjs', 'dist/', 'devices/*.json', 'LICENSE.md'])
    assert.ok(config.includes(entry), entry);
  assert.ok(!/^version:/m.test(config), 'the version comes from package.json');
  assert.equal(
    config.match(/^productName: (.+)$/m)?.[1],
    pkg.productName,
    'productName is the same in electron-builder.yml and package.json',
  );
});

test('macOS icon: icon.icns holds every size as PNG, made from the 1024×1024 icon (npm run icons)', async () => {
  const { ICNS_SLOTS, decodeIcns, pngSize } = await import('../../scripts/icns.ts');
  for (const png of ['resources/icon.png', 'resources/icon-mac.png'])
    assert.deepEqual(pngSize(fs.readFileSync(path.join(root, png))), { width: 1024, height: 1024 }, png);
  const entries = decodeIcns(fs.readFileSync(path.join(root, 'resources/icon.icns')));
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ICNS_SLOTS.map((slot) => slot.type),
  );
  for (const [i, slot] of ICNS_SLOTS.entries())
    assert.deepEqual(pngSize(entries[i]!.data), { width: slot.pixels, height: slot.pixels }, slot.slot);
  assert.match(pkg.scripts['icons'] ?? '', /build-mac-icon\.ts/);
});

test("development on macOS: the Dock gets the app icon instead of Electron's", () => {
  const main = read('electron/main.ts');
  assert.match(main, /app\.dock\?\.setIcon\(path\.join\(APP_ROOT, 'resources', 'icon-mac\.png'\)\)/);
  assert.match(main, /Menu\.setApplicationMenu\(Menu\.buildFromTemplate\(macMenuTemplate\(/);
});

test('release workflow: version tags, three systems, files attached to the release', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.match(workflow, /tags:\s*\n\s*- 'v\*'/);
  for (const os of ['windows-latest', 'macos-latest', 'ubuntu-latest']) assert.ok(workflow.includes(os), os);
  for (const script of ['build:win', 'build:mac', 'build:linux']) assert.ok(workflow.includes(script), script);
  assert.ok(workflow.includes('softprops/action-gh-release'));
});

test('the preload script is a CommonJS file (a sandboxed preload cannot be an ES module)', () => {
  const preload = read('electron/preload.cjs');
  assert.ok(preload.includes("require('electron')"));
  assert.ok(!/^\s*import\s/m.test(preload));
});

test('dev: Electron is started as Electron even from a terminal that sets ELECTRON_RUN_AS_NODE (the VS Code terminal does)', () => {
  // With the variable set, `electron .` runs main.js as plain Node: no `app`, no window, an exit with code 0.
  assert.match(pkg.scripts['dev:electron'] ?? '', /cross-env ELECTRON_RUN_AS_NODE= .*electron \./);
});
