import { parseTimestamp } from '../core/time';
import type { Issues } from '../core/validate';

/** A plain object, not `null` or an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Absent, null, or a string of only whitespace. */
export const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** Daraja sends a one-element list either as an array or as the bare object. */
export const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

/**
 * Sets an own, enumerable property. Unlike `obj[key] = value`, a `__proto__` key from an
 * untrusted body becomes a plain property instead of replacing the prototype.
 */
export function setOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * Flattens `[{ Name, Value }]` / `[{ Key, Value }]` lists into an object with no prototype.
 * Entries without a `Value`, or with a null or blank one (Daraja sends
 * `{ Key: 'TransactionReason' }` and `{ Name: 'Balance' }`), are skipped. When a name
 * repeats, the last entry wins.
 */
export function flatten(list: unknown, nameKey: string): Record<string, unknown> {
  const out = Object.create(null) as Record<string, unknown>;
  for (const item of asList(list)) {
    if (!isRecord(item) || typeof item[nameKey] !== 'string') continue;
    if (isBlank(item.Value)) continue;
    out[item[nameKey]] = item.Value;
  }
  return out;
}

/**
 * A plain decimal such as `5`, `5.00` or `-1540.00`. Stricter than `Number()`, which would
 * also accept `0x10`, `1e3`, `' 1 '` and `''` from an untrusted body.
 */
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Reads a finite number sent as a number or a plain decimal string such as "5.00". */
export function readNumber(issues: Issues, path: string, value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && DECIMAL.test(value)
        ? Number(value)
        : NaN;
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

/**
 * Checks that a required value is present and is a string or number. Returns whether it is
 * usable, so callers can skip further checks on a value that is already reported.
 */
export function requireValue(issues: Issues, path: string, value: unknown): boolean {
  if (isBlank(value)) {
    issues.add(path, 'is required');
    return false;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    issues.add(path, 'must be a string or number');
    return false;
  }
  return true;
}
