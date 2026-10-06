import { readFileSync } from 'node:fs';

/** Reads a redacted sandbox capture: `{ status, response }` as Daraja sent it. */
export function sandboxCapture(name: string): { status: number; response: unknown } {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/sandbox/${name}.json`, import.meta.url), 'utf8'),
  ) as { status: number; response: unknown };
}
