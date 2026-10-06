// Fails when the built package depends on Node-only modules or globals, so it keeps running
// on Bun, Deno and edge runtimes.
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';

const dist = new URL('../dist/', import.meta.url);
const builtins = new Set(builtinModules);
const problems = [];

for (const name of readdirSync(dist).filter((f) => f.endsWith('.mjs'))) {
  const code = readFileSync(new URL(name, dist), 'utf8');
  for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) {
    const specifier = m[1];
    if (specifier.startsWith('node:') || builtins.has(specifier)) {
      problems.push(`${name} imports ${specifier}`);
    }
  }
  if (/\brequire\s*\(/.test(code)) problems.push(`${name} calls require()`);
  if (/\b__dirname\b|\b__filename\b/.test(code)) problems.push(`${name} uses __dirname/__filename`);
  if (/\bBuffer\./.test(code)) problems.push(`${name} uses Buffer`);
  if (/\bprocess\.(env|versions|nextTick|platform)\b/.test(code))
    problems.push(`${name} uses process`);
}

if (problems.length > 0) {
  console.error(`dist is not runtime-neutral:\n- ${[...new Set(problems)].join('\n- ')}`);
  process.exit(1);
}
console.log('dist is runtime-neutral');
