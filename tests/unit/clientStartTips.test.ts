import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface TipLink {
  name: string;
  url: string;
}
interface Links {
  TIP_LINKS: Record<string, TipLink>;
  tipLinks(...ids: string[]): TipLink[];
  pageLink(url: string): TipLink | null;
  linkedText(text: string, links: Record<string, TipLink | null>): { text?: string; link?: TipLink }[];
}
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/app/features/start-tips/start-tips.links.ts');
const { TIP_LINKS, tipLinks, pageLink, linkedText } = (await import(pathToFileURL(file).href)) as Links;

test('start tips: every link has a name and is https (or empty, which hides it)', () => {
  for (const [id, link] of Object.entries(TIP_LINKS)) {
    assert.ok(link.name.trim(), `${id}: no name`);
    if (link.url) assert.equal(new URL(link.url).protocol, 'https:', `${id}: ${link.url}`);
  }
  assert.equal(TIP_LINKS['stockFirmware'], undefined, 'console pages live in the device profiles');
});

test('start tips: tipLinks keeps the order asked for and leaves out empty links', () => {
  assert.deepEqual(
    tipLinks('photoRec', 'testDisk').map((link) => link.name),
    ['PhotoRec', 'TestDisk'],
  );
});

test('start tips: a link of a device profile is named by its address without the scheme and the closing slash', () => {
  assert.deepEqual(pageLink('https://r36sx-hub.neocities.org/'), {
    name: 'r36sx-hub.neocities.org',
    url: 'https://r36sx-hub.neocities.org/',
  });
  assert.deepEqual(pageLink('https://handhelds.wiki/SF3000'), { name: 'handhelds.wiki/SF3000', url: 'https://handhelds.wiki/SF3000' });
  assert.equal(pageLink(''), null);
  assert.equal(pageLink('not a url'), null);
});

test('start tips: a translated text is split at its link placeholders, wherever the translation puts them', () => {
  const wiki = { name: 'handhelds.wiki/SF3000', url: 'https://handhelds.wiki/SF3000' };
  assert.deepEqual(linkedText('Info at {{firmwareLink}}. Back up the card.', { firmwareLink: wiki }), [
    { text: 'Info at ' },
    { link: wiki },
    { text: '. Back up the card.' },
  ]);
  assert.deepEqual(linkedText('{{firmwareLink}}에서 볼 수 있어요', { firmwareLink: wiki }), [
    { link: wiki },
    { text: '에서 볼 수 있어요' },
  ]);
  assert.deepEqual(linkedText('社区资源：{{ communityLink }}', { communityLink: wiki }), [{ text: '社区资源：' }, { link: wiki }]);
  assert.deepEqual(linkedText('No link: {{other}}', { firmwareLink: wiki, other: null }), [{ text: 'No link: {{other}}' }]);
});
