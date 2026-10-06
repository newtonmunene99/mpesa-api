import { describe, expect, test } from 'vite-plus/test';
import { isPreMode, releaseTag } from '../../scripts/release-tag';

describe('releaseTag', () => {
  test('passes no tag in pre mode, so Changesets uses the pre tag', () => {
    expect(releaseTag('master', true)).toEqual([]);
    expect(releaseTag('v4.x', true)).toEqual([]);
  });

  test('publishes master to latest', () => {
    expect(releaseTag('master', false)).toEqual(['--tag', 'latest']);
  });

  test('publishes a maintenance line to v<N>-latest', () => {
    expect(releaseTag('v4.x', false)).toEqual(['--tag', 'v4-latest']);
    expect(releaseTag('v12.x', false)).toEqual(['--tag', 'v12-latest']);
  });

  test.each(['next', 'dev', 'feature/x', 'v4', 'v4.1.x'])(
    'refuses to publish %s outside pre mode',
    (branch) => {
      expect(() => releaseTag(branch, false)).toThrow(
        `No npm dist-tag for branch "${branch}" outside pre mode`,
      );
    },
  );
});

describe('isPreMode', () => {
  test('is true only while pre.json is in pre mode', () => {
    expect(isPreMode('{ "mode": "pre", "tag": "alpha" }')).toBe(true);
    expect(isPreMode('{ "mode": "exit", "tag": "alpha" }')).toBe(false);
    expect(isPreMode(undefined)).toBe(false);
  });
});
