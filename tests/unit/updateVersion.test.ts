import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { isNewer, releaseVersion } from '../../src/services/update/version.ts';

test('release tags: the v prefix and anything after the main version are dropped', () => {
  assert.equal(releaseVersion('v1.0.1'), '1.0.1');
  assert.equal(releaseVersion('v1.0.1-rc.1'), '1.0.1');
  assert.equal(releaseVersion('1.2.3'), '1.2.3');
  assert.equal(releaseVersion('V2.0.0-beta.1'), '2.0.0');
  assert.equal(releaseVersion(' v1.10.0 '), '1.10.0');
});

test('release tags that are not a full version are not read (no update is assumed)', () => {
  for (const tag of ['', 'latest', 'v1.0', 'release-3', 'v1.0.x', 'x1.0.0', 'v1.0.123456789012345678901234567890'])
    assert.equal(releaseVersion(tag), null, tag);
});

test('versions are compared by semver, not as strings', () => {
  assert.equal(isNewer('1.0.10', '1.0.9'), true);
  assert.equal(isNewer('1.0.9', '1.0.10'), false);
  assert.equal(isNewer('2.0.0', '1.99.99'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('1.0.1', 'not a version'), false);
  assert.equal(isNewer('', '1.0.0'), false);
});
