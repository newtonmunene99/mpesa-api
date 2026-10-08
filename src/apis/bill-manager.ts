import type { Context } from '../client';
import { str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { checkPhone, checkShortCode, checkUrl, Issues } from '../core/validate';

/** Input for `billManager.optIn`. */
export interface BillManagerOptInInput {
  /** Your paybill or till, 5 to 7 digits (`shortcode`). */
  shortCode: number;
  /** The contact email shown on invoices and receipts (`email`). */
  email: string;
  /**
   * The contact number shown on invoices and receipts: `07…`, `01…`, `+254…` or `254…`, sent
   * as `07…`/`01…` (`officialContact`).
   */
  officialContact: string;
  /** Whether customers get SMS reminders 7 and 3 days before and on the due date. */
  sendReminders: boolean;
  /** Receives payment pushes (`callbackurl`); see `parseBillManagerPayment`. */
  callbackUrl: string;
}

/** Daraja's answer to `billManager.optIn`. */
export interface BillManagerOptInResponse {
  /**
   * The key Daraja issues on opt-in (`app_key`), when it sends one. Keep it secret; pass it as
   * `billManager.appKey` in the client config.
   */
  appKey?: string;
  /** `resmsg`, for example "Success". */
  message: string;
  /** `rescode`: always "200", anything else throws `DarajaApiError`. */
  code: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * Bill Manager: e-invoicing for a paybill. Opt in, send invoices by SMS, cancel them, receive
 * payment pushes and acknowledge them. No initiator is needed.
 *
 * Methods throw `ValidationError` before sending when the input is invalid, and
 * `DarajaApiError`, `AuthError` or `NetworkError` when the request fails. Every call checks
 * Bill Manager's `rescode`, which must be "200".
 */
export interface BillManagerApi {
  /**
   * Opts a shortcode in to Bill Manager, which whitelists it for the other calls. Returns the
   * `app_key` Daraja issues.
   */
  optIn(input: BillManagerOptInInput): Promise<BillManagerOptInResponse>;
}

const BASE = '/v1/billmanager-invoice';
const OK = '200';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A Safaricom number in the national `07…`/`01…` form Bill Manager uses. */
function checkNationalPhone(issues: Issues, path: string, value: string): string {
  const phone = checkPhone(issues, path, value);
  return /^254\d{9}$/.test(phone) ? `0${phone.slice(3)}` : phone;
}

/**
 * Throws `DarajaApiError` unless Bill Manager's `rescode` is "200". Bill Manager answers with
 * `rescode`, `resmsg` and sometimes `Status_Message`, not `ResponseCode`.
 */
function checkRescode(raw: Record<string, unknown>): void {
  const code = str(raw.rescode);
  if (code === OK) return;
  throw new DarajaApiError({
    status: 200,
    body: raw,
    ...(code ? { errorCode: code } : {}),
    errorMessage: str(raw.Status_Message ?? raw.resmsg),
  });
}

/** Validates an opt-in and returns its body. */
function optInBody(ctx: Context, input: BillManagerOptInInput): Record<string, unknown> {
  const issues = new Issues();
  checkShortCode(issues, 'shortCode', input.shortCode);
  if (typeof input.email !== 'string' || !EMAIL.test(input.email)) {
    issues.add('email', 'must be an email address');
  }
  const officialContact = checkNationalPhone(issues, 'officialContact', input.officialContact);
  if (typeof input.sendReminders !== 'boolean') {
    issues.add('sendReminders', 'must be true or false');
  }
  checkUrl(issues, 'callbackUrl', input.callbackUrl, {
    production: ctx.environment === 'production',
  });
  issues.throwIfAny('billManager.optIn');
  return {
    shortcode: String(input.shortCode),
    email: input.email,
    officialContact,
    sendReminders: input.sendReminders ? '1' : '0',
    callbackurl: input.callbackUrl,
  };
}

async function optIn(
  ctx: Context,
  input: BillManagerOptInInput,
): Promise<BillManagerOptInResponse> {
  const raw = await ctx.post<Record<string, unknown>>(`${BASE}/optin`, optInBody(ctx, input));
  checkRescode(raw);
  return {
    ...(raw.app_key == null ? {} : { appKey: str(raw.app_key) }),
    message: str(raw.resmsg),
    code: str(raw.rescode),
    raw,
  };
}

/** Bill Manager. */
export function billManager(ctx: Context): BillManagerApi {
  return {
    optIn: (input) => optIn(ctx, input),
  };
}
