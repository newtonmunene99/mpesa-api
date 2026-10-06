import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vite-plus/test';
import { isPreMode, releaseTag } from '../../scripts/release-tag';

const SCRIPT = fileURLToPath(new URL('../../scripts/release-tag.ts', import.meta.url));

/** Runs the script as the release workflow does, in a temporary repo root. */
function run(branch: string, preJson?: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'release-tag-'));
  if (preJson !== undefined) {
    mkdirSync(join(cwd, '.changeset'));
    writeFileSync(join(cwd, '.changeset', 'pre.json'), preJson);
  }
  const { NODE_OPTIONS: _, ...env } = process.env;
  return spawnSync(process.execPath, [SCRIPT], {
    cwd,
    encoding: 'utf8',
    env: { ...env, GITHUB_REF_NAME: branch },
  });
}

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

  test.each(['next', 'dev', 'feature/x', 'feature/v4.x', 'v.x', 'v4', 'v4.1.x'])(
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

  test('a pre.json in exit mode publishes as stable', () => {
    expect(releaseTag('master', isPreMode('{ "mode": "exit", "tag": "alpha" }'))).toEqual([
      '--tag',
      'latest',
    ]);
  });
});

describe('release-tag.ts run directly', () => {
  test('prints the maintenance tag when there is no pre.json', () => {
    const result = run('v4.x');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('--tag v4-latest');
  });

  test('prints nothing in pre mode', () => {
    const result = run('master', '{ "mode": "pre", "tag": "alpha" }');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('exits 1 for next outside pre mode', () => {
    const result = run('next');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('No npm dist-tag for branch "next"');
  });
});
