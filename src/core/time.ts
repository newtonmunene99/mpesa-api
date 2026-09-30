import { ValidationError } from './errors';

/** East Africa Time is UTC+3 all year (no daylight saving). */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** Formats a date as Daraja's `YYYYMMDDHHmmss` timestamp in East Africa Time. */
export function formatTimestamp(date: Date): string {
  const eat = new Date(date.getTime() + EAT_OFFSET_MS);
  return (
    pad(eat.getUTCFullYear(), 4) +
    pad(eat.getUTCMonth() + 1) +
    pad(eat.getUTCDate()) +
    pad(eat.getUTCHours()) +
    pad(eat.getUTCMinutes()) +
    pad(eat.getUTCSeconds())
  );
}

function fromEatParts(
  value: string,
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
): Date {
  const utc = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    throw new ValidationError('timestamp', [
      { path: 'value', message: `invalid timestamp "${value}"` },
    ]);
  }
  return new Date(utc - EAT_OFFSET_MS);
}

/** Parses Daraja's `YYYYMMDDHHmmss` (EAT), sent as a string or a number. */
export function parseTimestamp(value: string | number): Date {
  const text = String(value);
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text);
  if (!m) {
    throw new ValidationError('timestamp', [
      { path: 'value', message: `invalid timestamp "${text}"` },
    ]);
  }
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return fromEatParts(text, y!, mo!, d!, h!, mi!, s!);
}

/** Parses B2C's `dd.MM.yyyy HH:mm:ss` (EAT), as in TransactionCompletedDateTime. */
export function parseB2CDateTime(value: string): Date {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!m) {
    throw new ValidationError('timestamp', [
      { path: 'value', message: `invalid timestamp "${value}"` },
    ]);
  }
  const [, d, mo, y, h, mi, s] = m.map(Number);
  return fromEatParts(value, y!, mo!, d!, h!, mi!, s!);
}
