import { parseTimestamp } from '../core/time';
import type { Issues } from '../core/validate';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Daraja sends a one-element list either as an array or as the bare object. */
export const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

/**
 * Flattens `[{ Name, Value }]` / `[{ Key, Value }]` lists into an object. Entries without a
 * `Value` (Daraja sends `{ Key: 'TransactionReason' }` and `{ Name: 'Balance' }`) are skipped.
 */
export function flatten(list: unknown, nameKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const item of asList(list)) {
    if (!isRecord(item) || typeof item[nameKey] !== 'string') continue;
    if (item.Value === undefined || item.Value === null) continue;
    out[item[nameKey]] = item.Value;
  }
  return out;
}

/** Reads a number sent as a number or a numeric string. */
export function readNumber(issues: Issues, path: string, value: unknown): number | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) {
    issues.add(path, 'must be a number');
    return undefined;
  }
  return n;
}

/** Reads an EAT `YYYYMMDDHHmmss` timestamp sent as a string or a number. */
export function readTimestamp(issues: Issues, path: string, value: unknown): Date | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    try {
      return parseTimestamp(value);
    } catch {
      // Reported below.
    }
  }
  issues.add(path, 'must be a YYYYMMDDHHmmss timestamp');
  return undefined;
}

/** Adds an issue when a required key is absent or empty. */
export function requireKey(
  issues: Issues,
  path: string,
  record: Record<string, unknown>,
  key: string,
): void {
  const value = record[key];
  if (value === undefined || value === null || value === '') {
    issues.add(`${path}.${key}`, 'is required');
  }
}
