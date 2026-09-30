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
 * A plain decimal amount with at most two decimal places, such as `5`, `5.00` or `-1540.00`.
 * Stricter than `Number()`, which would also accept `0x10`, `1e3`, `' 1 '` and `''` from an
 * untrusted body.
 */
const AMOUNT = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Reads a money amount as integer cents, so sums stay exact. Daraja sends amounts as numbers
 * (`1.0`) or decimal strings (`"5.00"`). A number is read through its shortest string form,
 * so `4.35` becomes 435 rather than `4.35 * 100` = 434.99999999999994. Records an issue and
 * returns `undefined` for anything else, including more than two decimal places.
 */
export function readCents(issues: Issues, path: string, value: unknown): number | undefined {
  const text = typeof value === 'number' ? String(value) : value;
  const m = typeof text === 'string' ? AMOUNT.exec(text) : null;
  if (!m) {
    issues.add(path, 'must be a number');
    return undefined;
  }
  const [, sign, whole, fraction = ''] = m;
  if (fraction.length > 2) {
    issues.add(path, 'must have at most 2 decimal places');
    return undefined;
  }
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) {
    issues.add(path, 'must be a number');
    return undefined;
  }
  return sign === '-' ? -cents : cents;
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
