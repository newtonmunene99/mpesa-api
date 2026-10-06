import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vite-plus/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const normalise = (line: string): string => line.replace(/\s+/g, ' ').trim();

/** Every Markdown file under `dir`, skipping dot-folders such as `.vitepress`. */
const markdown = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdown(path);
    return name.endsWith('.md') ? [path] : [];
  });

// The docs' code blocks are mirrored in docs-examples.ts, which `vp check` type-checks. This
// fails when a block changes without the mirror, so a broken example can't reach the docs.
test('every docs and README code line is in the type-checked examples file', () => {
  const examples = normalise(readFileSync(join(root, '__tests__/docs-examples.ts'), 'utf8'));
  const missing: string[] = [];
  let scanned = 0;
  for (const file of [join(root, 'README.md'), ...markdown(join(root, 'docs'))]) {
    const text = readFileSync(file, 'utf8');
    // Also matches ```ts [label], ```ts{1,3} and ```typescript fences.
    for (const block of text.matchAll(/```(?:ts|typescript)\b[^\n]*\n([\s\S]*?)```/g)) {
      for (const line of block[1]!.split('\n')) {
        const l = normalise(line);
        if (!l || l.startsWith('import ')) continue;
        scanned++;
        if (!examples.includes(l)) missing.push(`${file.slice(root.length)}: ${l}`);
      }
    }
  }
  // Guards against a pattern that silently matches nothing.
  expect(scanned).toBeGreaterThan(100);
  expect(missing).toEqual([]);
});
