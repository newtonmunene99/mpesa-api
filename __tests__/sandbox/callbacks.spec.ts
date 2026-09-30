/**
 * Redacts and parses callbacks received from the Daraja sandbox. Paste each raw callback body
 * into `__tests__/fixtures/sandbox/callbacks/raw/<name>.json` (gitignored), then run
 * `pnpm test:sandbox`. Each one is redacted into `__tests__/fixtures/sandbox/callbacks/` and
 * must parse with the matching parser.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseC2BNotification, parseResult, parseStkCallback } from '../../src/index';
import { redact } from '../helpers/redact';

const DIR = new URL('../fixtures/sandbox/callbacks/', import.meta.url);
const RAW = new URL('raw/', DIR);
const files = existsSync(RAW) ? readdirSync(RAW).filter((f) => f.endsWith('.json')) : [];
const enabled = process.env.MPESA_SANDBOX === '1' && files.length > 0;

function parserFor(body: Record<string, unknown>): (body: unknown) => unknown {
  if ('Body' in body) return parseStkCallback;
  if ('Result' in body) return parseResult;
  return parseC2BNotification;
}

describe.skipIf(!enabled)('sandbox callbacks', () => {
  test.each(files)('%s is redacted and parses', (file) => {
    const body = JSON.parse(readFileSync(new URL(file, RAW), 'utf8')) as Record<string, unknown>;
    const redacted = redact(body) as Record<string, unknown>;
    writeFileSync(new URL(file, DIR), `${JSON.stringify(redacted, null, 2)}\n`);

    expect(() => parserFor(body)(body)).not.toThrow();
    expect(() => parserFor(redacted)(redacted)).not.toThrow();
  });
});
