import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { RELEASES_URL, setUpdateFetcher } from '../../src/services/updateService.ts';
import { startApi } from '../helpers/server.ts';

// GitHub is never asked for real here: every answer comes from this stub.
interface Call {
  url: string;
  headers: Record<string, string>;
  signal: boolean;
}
const calls: Call[] = [];
let answer: () => Response | Promise<Response> = () => new Response('{}', { status: 500 });
setUpdateFetcher(async (url, init) => {
  calls.push({ url, headers: init.headers as Record<string, string>, signal: init.signal instanceof AbortSignal });
  return answer();
});
const release =
  (tag: string, extra: Record<string, unknown> = {}): (() => Response) =>
  () =>
    Response.json({
      tag_name: tag,
      html_url: `https://github.com/StanislavDovhusha/retro_game_manager/releases/tag/${tag}`,
      name: `Release ${tag}`,
      ...extra,
    });

const api = await startApi();
interface Status {
  current: string;
  available: { version: string; url: string; name: string } | null;
  dismissed: boolean;
  check: string;
}
const startup = async (): Promise<Status> => (await api('GET', '/api/update')).body as unknown as Status;
const checkNow = async (): Promise<Status> => (await api('POST', '/api/update/check', { body: {} })).body as unknown as Status;
const settings = async (patch?: unknown): Promise<{ updates: Record<string, unknown> }> =>
  (patch ? await api('PUT', '/api/settings', { body: patch }) : await api('GET', '/api/settings')).body?.settings as {
    updates: Record<string, unknown>;
  };

test('switched off: the start does not ask GitHub', async () => {
  assert.equal((await settings()).updates['checkOnStartup'], true, 'on by default');
  await settings({ updates: { checkOnStartup: false } });
  const status = await startup();
  assert.equal(status.check, 'skipped');
  assert.equal(status.available, null);
  assert.equal(calls.length, 0);
  await settings({ updates: { checkOnStartup: true } });
});

test('a newer release: shown with its version, page and title; the request is the documented one', async () => {
  answer = release('v1.0.1_final');
  const status = await startup();
  assert.equal(status.check, 'checked');
  assert.equal(status.current, '1.0.0', 'the version of package.json');
  assert.deepEqual(status.available, {
    version: '1.0.1',
    url: 'https://github.com/StanislavDovhusha/retro_game_manager/releases/tag/v1.0.1_final',
    name: 'Release v1.0.1_final',
  });
  assert.equal(status.dismissed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, RELEASES_URL);
  assert.equal(calls[0]?.headers['Accept'], 'application/vnd.github+json');
  assert.ok(calls[0]?.signal, 'with a timeout');
  assert.ok(Number((await settings()).updates['lastCheckAt']) > Date.now() - 60_000);
});

test('at most once a day on start: the stored result is used; "Check now" asks at once', async () => {
  const before = calls.length;
  const again = await startup();
  assert.equal(again.check, 'skipped');
  assert.equal(again.available?.version, '1.0.1', 'the result of the last check is kept');
  assert.equal(calls.length, before);
  answer = release('v1.0.2');
  const now = await checkNow();
  assert.equal(now.check, 'checked');
  assert.equal(now.available?.version, '1.0.2');
  assert.equal(calls.length, before + 1);
});

test('a closed notice stays closed for that version and comes back for a newer one', async () => {
  await settings({ updates: { dismissedVersion: '1.0.2' } });
  assert.equal((await startup()).dismissed, true);
  answer = release('v1.0.10');
  const newer = await checkNow();
  assert.equal(newer.available?.version, '1.0.10', '1.0.10 is newer than 1.0.2 (semver, not strings)');
  assert.equal(newer.dismissed, false);
  await settings({ updates: { dismissedVersion: 'garbage' } });
  assert.equal((await settings()).updates['dismissedVersion'], '', 'only a version can be stored as closed');
});

test('no update: the same or an older version, a tag without a version, a draft', async () => {
  for (const tag of ['v1.0.0', 'v0.9.9', 'latest']) {
    answer = release(tag);
    const status = await checkNow();
    assert.equal(status.check, 'checked', tag);
    assert.equal(status.available, null, tag);
  }
  answer = release('v9.0.0', { draft: true });
  assert.equal((await checkNow()).available, null);
});

test('no releases yet (404): nothing to show', async () => {
  answer = () => new Response('{"message":"Not Found"}', { status: 404 });
  const status = await checkNow();
  assert.equal(status.check, 'checked');
  assert.equal(status.available, null);
});

test('limit (403, 429), server error, no connection: failed quietly, the last answer is kept', async () => {
  answer = release('v1.0.5');
  await checkNow();
  const { lastCheckAt } = (await settings()).updates;
  for (const fail of [
    () => new Response('{}', { status: 403 }),
    () => new Response('{}', { status: 429 }),
    () => new Response('oops', { status: 502 }),
    () => {
      throw new TypeError('fetch failed');
    },
    () => new Response('not json', { status: 200 }),
  ]) {
    answer = fail;
    const status = await checkNow();
    assert.equal(status.check, 'failed');
    assert.equal(status.available?.version, '1.0.5', 'the release found before is still known');
  }
  assert.equal((await settings()).updates['lastCheckAt'], lastCheckAt, 'a failed check does not count as a check');
});

test('a release page that is not on github.com is replaced by the releases list', async () => {
  answer = release('v2.0.0', { html_url: 'javascript:alert(1)' });
  assert.equal((await checkNow()).available?.url, 'https://github.com/StanislavDovhusha/retro_game_manager/releases');
  answer = release('v2.0.1', { html_url: 'https://evil.example/x' });
  assert.equal((await checkNow()).available?.url, 'https://github.com/StanislavDovhusha/retro_game_manager/releases');
});
