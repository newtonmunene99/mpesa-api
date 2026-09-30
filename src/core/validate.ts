import { ValidationError, type ValidationIssue } from './errors';

/** Collects validation issues so every problem is reported in a single error. */
export class Issues {
  /** The issues so far, in the order they were added. */
  readonly list: ValidationIssue[] = [];

  /** Records one problem. `path` is the input field's name, `message` completes a sentence after it. */
  add(path: string, message: string): void {
    this.list.push({ path, message });
  }

  /**
   * Throws a `ValidationError` holding every issue so far, if there are any. `context` names
   * the call (`b2c.pay`) and prefixes the error message.
   */
  throwIfAny(context: string): void {
    if (this.list.length > 0) {
      throw new ValidationError(context, this.list);
    }
  }
}

/**
 * Normalises a Kenyan Safaricom number to the 12-digit `2547XXXXXXXX` / `2541XXXXXXXX` form.
 * Accepts `07…`, `01…`, `+254…` and `254…`, ignoring spaces. Returns undefined when invalid.
 */
export function normalisePhone(value: string): string | undefined {
  const digits = value.replace(/\s+/g, '').replace(/^\+/, '');
  const national = /^0[17]\d{8}$/.test(digits) ? `254${digits.slice(1)}` : digits;
  return /^254[17]\d{8}$/.test(national) ? national : undefined;
}

/**
 * Checks a customer phone number and returns it in Daraja's `2547…`/`2541…` form, so callers
 * send the normalised value. An invalid number is recorded and returned unchanged.
 */
export function checkPhone(issues: Issues, path: string, value: string): string {
  const phone = normalisePhone(value);
  if (phone === undefined) {
    issues.add(path, 'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX');
    return value;
  }
  return phone;
}

/**
 * Checks a string's length in characters. `undefined` and `''` count as absent: they pass
 * unless `required` is set, so optional fields can be left empty.
 */
export function checkLength(
  issues: Issues,
  path: string,
  value: string | undefined,
  min: number,
  max: number,
  required = false,
): void {
  if (value === undefined || value === '') {
    if (required) issues.add(path, 'is required');
    return;
  }
  if (value.length < min) issues.add(path, `must be at least ${min} characters`);
  if (value.length > max) issues.add(path, `must be at most ${max} characters`);
}

/**
 * Checks that a number is an integer in `[min, max]`; `max` is optional. A non-integer is
 * reported once, without range messages.
 */
export function checkInt(
  issues: Issues,
  path: string,
  value: number,
  min: number,
  max?: number,
): void {
  if (!Number.isInteger(value)) {
    issues.add(path, 'must be an integer');
    return;
  }
  if (value < min) issues.add(path, `must be at least ${min}`);
  if (max !== undefined && value > max) issues.add(path, `must be at most ${max}`);
}

/**
 * Words Daraja rejects anywhere in a production C2B registration URL, host included. Longer
 * words come first so the message names `m-pesa` or `exec` rather than a substring of them.
 */
const BLOCKED_URL_KEYWORDS = ['m-pesa', 'mpesa', 'safaricom', 'exec', 'exe', 'cmd', 'sql', 'query'];

/**
 * Checks a callback URL: it must be an absolute `http:` or `https:` URL, `https:` in
 * production, and with `blockKeywords` it must not contain any of `BLOCKED_URL_KEYWORDS`.
 * Only C2B registration sets `blockKeywords`, and only in production.
 */
export function checkUrl(
  issues: Issues,
  path: string,
  value: string,
  options: { production: boolean; blockKeywords?: boolean },
): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    issues.add(path, 'must be an absolute URL');
    return;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    issues.add(path, 'must be an http(s) URL');
    return;
  }
  if (options.production && url.protocol !== 'https:') {
    issues.add(path, 'must use https in production');
  }
  if (options.blockKeywords) {
    const lower = value.toLowerCase();
    const keyword = BLOCKED_URL_KEYWORDS.find((k) => lower.includes(k));
    if (keyword) issues.add(path, `must not contain the keyword "${keyword}"`);
  }
}

/** Checks an organisation shortcode (paybill, till or HO number): 5 to 7 digits. */
export function checkShortCode(issues: Issues, path: string, value: number | string): void {
  if (!/^\d{5,7}$/.test(String(value))) {
    issues.add(path, 'must be a 5 to 7 digit shortcode');
  }
}

/** Records `is required` when a value is `undefined`, `null` or `''`. */
export function checkRequired(issues: Issues, path: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    issues.add(path, 'is required');
  }
}
