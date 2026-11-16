import { work } from '../helpers/env.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { write } from '../helpers/fs.ts';
import { startApi } from '../helpers/server.ts';

const api = await startApi();
interface Devices {
  devices: { id: string; name: string }[];
  active: {
    id: string;
    name: string;
    platforms: { folder: string; name: string }[];
    tips: { cpu: string; firmwareLink: string; communityLink: string };
  };
}
const devices = async (): Promise<Devices> => (await api('GET', '/api/devices')).body as unknown as Devices;
const setDevice = async (device: string): Promise<string> =>
  ((await api('PUT', '/api/settings', { body: { device } })).body?.settings as { device: string }).device;

const card = path.join(work, 'CARD');
await write(path.join(card, 'cubegm', 'saves', 'x.sav'), 's');
await write(path.join(card, 'rootfs', 'x'), 'r');
await write(path.join(card, 'GBA', 'Mario.gba'), 'rom');
await write(path.join(card, 'Photo', 'a.jpg'), 'jpg');
const plain = path.join(work, 'PLAIN');
await write(path.join(plain, 'roms', 'Mario.gba'), 'rom');

test('the models and the active profile; the default model is SF3000', async () => {
  const response = await devices();
  assert.deepEqual(
    response.devices.map((device) => device.name),
    ['SF3000', 'SF3000 HD', 'SF3000 HD (no HDMI)', 'SF3100', 'SF3500'],
  );
  assert.equal(response.active.id, 'sf3000');
  assert.equal(response.active.platforms.find((platform) => platform.folder === 'GBA')?.name, 'Game Boy Advance');
  assert.deepEqual(
    [response.active.tips.firmwareLink, response.active.tips.communityLink],
    ['https://handhelds.wiki/SF3000', 'https://r36sx-hub.neocities.org/'],
  );
});

test('the model is chosen in the settings; an unknown id falls back to the default', async () => {
  assert.equal(await setDevice('sf3500'), 'sf3500');
  const sf3500 = (await devices()).active;
  assert.equal(sf3500.name, 'SF3500');
  assert.deepEqual(
    [sf3500.tips.firmwareLink, sf3500.tips.communityLink],
    ['', 'https://r36sx-hub.neocities.org/'],
    'no stock firmware page of its own; the community page of the base profile',
  );
  assert.equal(sf3500.tips.cpu, 'MIPS', 'the rest of the tips is inherited');
  assert.equal(await setDevice('no-such-console'), 'sf3000');
});

test('choosing a card: a card of the family is recognized and the chosen model of the same layout stays', async () => {
  await setDevice('sf3100');
  const res = await api('PUT', '/api/sd/root', { body: { root: card } });
  assert.equal(res.status, 200);
  const body = res.body as unknown as {
    detected: { device: { id: string }; changed: boolean } | null;
    platforms: { name: string; label: string | null }[];
  };
  assert.deepEqual(body.detected, { device: { id: 'sf3100', name: 'SF3100' }, changed: false });
  assert.deepEqual(
    body.platforms.map((platform) => [platform.name, platform.label]),
    [['GBA', 'Game Boy Advance']],
    'system and media folders of the profile are not platforms',
  );
  const tree = (await api('GET', '/api/sd/tree?rel=')).body as unknown as { nodes: { name: string; kind: string; label: string | null }[] };
  assert.deepEqual(
    tree.nodes.map((node) => [node.name, node.kind, node.label]),
    [
      ['cubegm', 'system', null],
      ['GBA', 'platform', 'Game Boy Advance'],
      ['Photo', 'media', null],
      ['rootfs', 'system', null],
    ],
  );
});

test('a card without the markers of any model keeps the model of the settings', async () => {
  const res = await api('PUT', '/api/sd/root', { body: { root: plain } });
  assert.equal((res.body as unknown as { detected: unknown }).detected, null);
  assert.equal((await devices()).active.id, 'sf3100');
});
