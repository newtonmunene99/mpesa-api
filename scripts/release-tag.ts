// Picks the npm dist-tag for `changeset publish` in the release workflow. In pre mode,
// Changesets publishes under the pre tag itself, so no --tag is passed. A maintenance line
// must never publish to `latest`, which would replace the current major.
// Run directly with Node 24 (`node scripts/release-tag.ts`), which strips the types.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The arguments to append to `changeset publish` for this branch: none in pre mode, `latest`
 * on `master`, `v<N>-latest` on a `v<N>.x` branch. Throws for any other branch, so `next`
 * outside pre mode can never publish to `latest`.
 */
export function releaseTag(branch: string, preMode: boolean): string[] {
  if (preMode) return [];
  if (branch === 'master') return ['--tag', 'latest'];
  const line = /^v(\d+)\.x$/.exec(branch);
  if (line) return ['--tag', `v${line[1]}-latest`];
  throw new Error(`No npm dist-tag for branch "${branch}" outside pre mode`);
}

/**
 * True while `.changeset/pre.json` is in pre mode. After `changeset pre exit` the file stays,
 * in "exit" mode, until the next version PR consumes it; that counts as a stable release.
 */
export function isPreMode(preJson: string | undefined): boolean {
  if (preJson === undefined) return false;
  return (JSON.parse(preJson) as { mode?: string }).mode === 'pre';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const pre = existsSync('.changeset/pre.json')
      ? readFileSync('.changeset/pre.json', 'utf8')
      : undefined;
    const args = releaseTag(process.env.GITHUB_REF_NAME ?? '', isPreMode(pre));
    console.log(args.join(' '));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
