import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGS } from '../../shared/constants.ts';

type Side = 'top' | 'bottom' | 'left' | 'right';
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Logic {
  placeTooltip(
    target: Box | null,
    tip: { width: number; height: number },
    view: { width: number; height: number },
    side: Side,
  ): { side: string; x: number; y: number };
  spotlight(target: Box, view: { width: number; height: number }): Box | null;
  blockers(hole: Box | null, view: { width: number; height: number }): Box[];
  tourKey(key: string): string | null;
  intersect(a: Box, b: Box): Box | null;
  TOUR_MARGIN: number;
}
interface Config {
  TOUR_STEPS: readonly { id: string; targets: readonly string[]; needsCard: boolean; side: Side }[];
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tourDir = path.join(root, 'client/src/app/features/tour');
const logic = (await import(pathToFileURL(path.join(tourDir, 'tour.logic.ts')).href)) as Logic;
const { TOUR_STEPS } = (await import(pathToFileURL(path.join(tourDir, 'tour.config.ts')).href)) as Config;
const view = { width: 1200, height: 800 };
const tip = { width: 320, height: 160 };

test('tour steps: the six steps in order; only the first works without a card', () => {
  assert.deepEqual(
    TOUR_STEPS.map((step) => step.id),
    ['sdCard', 'platform', 'addGame', 'edit', 'delete', 'search'],
  );
  assert.deepEqual(
    TOUR_STEPS.map((step) => step.needsCard),
    [false, true, true, true, true, true],
  );
});

test('tour steps: every target exists in the templates, every text in the three dictionaries', () => {
  const templates: string[] = [];
  (function walk(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (name.endsWith('.html')) templates.push(fs.readFileSync(file, 'utf8'));
    }
  })(path.join(root, 'client/src/app'));
  const html = templates.join('\n');
  for (const step of TOUR_STEPS) {
    const first = step.targets[0] ?? '';
    const attr = /data-tour="([^"]+)"/.exec(first)?.[1];
    if (attr) assert.ok(html.includes(`data-tour="${attr}"`), `${step.id}: no element with data-tour="${attr}"`);
    else assert.ok(html.includes(`<${first.split(' ').pop()}`), `${step.id}: ${first}`);
  }
  for (const lang of LANGS) {
    const tour = (
      JSON.parse(fs.readFileSync(path.join(root, `client/public/i18n/${lang}.json`), 'utf8')) as {
        tour: { steps: Record<string, Record<string, string>> };
      }
    ).tour;
    for (const step of TOUR_STEPS) assert.ok(tour.steps[step.id]?.['title'] && tour.steps[step.id]?.['text'], `${lang}: ${step.id}`);
  }
});

test('tour texts do not promise that deleting a game deletes its cover or saves (it does not)', () => {
  const en = JSON.parse(fs.readFileSync(path.join(root, 'client/public/i18n/en.json'), 'utf8')) as {
    tour: { steps: { delete: { text: string } } };
  };
  assert.match(en.tour.steps.delete.text, /cover and the saves are kept/);
});

test('tooltip: on the preferred side when it fits, else the opposite one, else another; centred without a target', () => {
  const button = { x: 500, y: 20, width: 120, height: 32 };
  assert.equal(logic.placeTooltip(button, tip, view, 'bottom').side, 'bottom');
  assert.equal(logic.placeTooltip(button, tip, view, 'top').side, 'bottom', 'no room above: below');
  const low = { x: 500, y: 700, width: 120, height: 32 };
  assert.equal(logic.placeTooltip(low, tip, view, 'bottom').side, 'top', 'no room below: above');
  const panel = { x: 0, y: 60, width: 320, height: 700 };
  assert.equal(logic.placeTooltip(panel, tip, view, 'right').side, 'right');
  const whole = { x: 0, y: 0, width: 1200, height: 800 };
  assert.equal(logic.placeTooltip(whole, tip, view, 'bottom').side, 'center', 'covers the window: centred');
  const centred = logic.placeTooltip(null, tip, view, 'bottom');
  assert.deepEqual(centred, { side: 'center', x: 440, y: 320 });
});

test('tooltip: never outside the window, also near the edges and in a tiny window', () => {
  const corner = logic.placeTooltip({ x: 1150, y: 10, width: 40, height: 30 }, tip, view, 'bottom');
  assert.ok(corner.x >= logic.TOUR_MARGIN && corner.x + tip.width <= view.width - logic.TOUR_MARGIN, JSON.stringify(corner));
  const small = { width: 300, height: 200 };
  const placed = logic.placeTooltip({ x: 10, y: 10, width: 50, height: 20 }, tip, small, 'bottom');
  assert.ok(placed.x >= logic.TOUR_MARGIN && placed.y >= logic.TOUR_MARGIN, JSON.stringify(placed));
});

test('spotlight and blockers: padded, cut to the window; the four blockers leave exactly the hole open', () => {
  assert.deepEqual(logic.spotlight({ x: 2, y: 100, width: 50, height: 20 }, view), { x: 0, y: 94, width: 58, height: 32 });
  assert.equal(logic.spotlight({ x: -500, y: 100, width: 50, height: 20 }, view), null, 'off screen');
  const hole = { x: 100, y: 100, width: 200, height: 50 };
  const parts = logic.blockers(hole, view);
  assert.equal(parts.length, 4);
  const area = parts.reduce((sum, b) => sum + b.width * b.height, 0);
  assert.equal(area, view.width * view.height - hole.width * hole.height);
  assert.deepEqual(logic.blockers(null, view), [{ x: 0, y: 0, ...view }]);
});

test('intersect: the visible part of an element inside a clipping container', () => {
  const row = { x: 314, y: 118, width: 1200, height: 46 };
  const table = { x: 320, y: 90, width: 636, height: 700 };
  assert.deepEqual(logic.intersect(row, table), { x: 320, y: 118, width: 636, height: 46 });
  assert.equal(logic.intersect(row, { x: 0, y: 0, width: 100, height: 100 }), null);
});

test('keys: ← back, → next, Esc exits', () => {
  assert.equal(logic.tourKey('ArrowRight'), 'next');
  assert.equal(logic.tourKey('ArrowLeft'), 'back');
  assert.equal(logic.tourKey('Escape'), 'exit');
  assert.equal(logic.tourKey('Enter'), null);
});
