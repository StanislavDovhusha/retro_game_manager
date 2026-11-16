import semver from 'semver';

/**
 * The version of a release tag: the `v` prefix and anything after the main version are dropped
 * (`v1.0.1` → `1.0.1`, `v1.0.1_final` → `1.0.1`, `1.2.3-beta.1` → `1.2.3`). Null when the tag does not start with a
 * full `major.minor.patch` version (`latest`, `v1.0`, `release-3`): such a tag is not treated as an update.
 */
export function releaseVersion(tag: string): string | null {
  const match = /^v?(\d+\.\d+\.\d+)(?!\d)/i.exec(tag.trim());
  return match?.[1] ? semver.valid(match[1]) : null;
}

/** `candidate` is newer than `current` by the rules of semver (1.0.10 is newer than 1.0.9). Invalid input: false. */
export function isNewer(candidate: string, current: string): boolean {
  const a = semver.valid(candidate);
  const b = semver.valid(current);
  return a !== null && b !== null && semver.gt(a, b);
}
