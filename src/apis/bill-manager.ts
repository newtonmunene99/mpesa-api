import type { Context } from '../client';
import { str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { formatEatDateTime } from '../core/time';
import { checkInt, checkPhone, checkShortCode, checkUrl, Issues } from '../core/validate';

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

/** One billable line on an invoice. */
export interface BillManagerInvoiceItem {
  /** `itemName`. */
  itemName: string;
  /** Whole shillings, at least 1, sent as a string (`amount`). */
  amount: number;
}

/** An invoice for `billManager.sendInvoice` and `sendInvoices`, sent to the customer by SMS. */
export interface BillManagerInvoice {
  /** Your unique ID for the invoice, used to cancel it later (`externalReference`). */
  externalReference: string;
  /** The customer's name, shown in the SMS (`billedFullName`). */
  billedFullName: string;
  /**
   * The Safaricom number that receives the invoice: `07…`, `01…`, `+254…` or `254…`, sent as
   * `07…`/`01…` (`billedPhoneNumber`).
   */
  billedPhoneNumber: string;
  /** The period billed, for example "August 2021" (`billedPeriod`). */
  billedPeriod: string;
  /** What the customer is billed for, shown in the SMS (`invoiceName`). */
  invoiceName: string;
  /** When payment is due, sent as an East Africa Time `YYYY-MM-DD` (`dueDate`). */
  dueDate: Date;
  /** The account number the customer pays to (`accountReference`). */
  accountReference: string;
  /** The total, whole shillings, at least 1, sent as a string (`amount`). */
  amount: number;
  /** Optional billable lines shown on the invoice (`invoiceItems`). */
  invoiceItems?: BillManagerInvoiceItem[];
}

/** Bill Manager's answer to an invoicing or cancelling call. */
export interface BillManagerResponse {
  /** `Status_Message`, for example "Invoice sent successfully", when Daraja sends one. */
  statusMessage?: string;
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
  /** Sends one invoice to a customer by SMS. Reminders follow if the opt-in enabled them. */
  sendInvoice(invoice: BillManagerInvoice): Promise<BillManagerResponse>;
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

const isFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
const isDate = (value: Date): boolean => value instanceof Date && !Number.isNaN(value.getTime());
const REQUIRED_TEXT = [
  'externalReference',
  'billedFullName',
  'billedPeriod',
  'invoiceName',
  'accountReference',
] as const;

/** Validates the optional invoice lines and returns them as Daraja fields. */
function invoiceItems(
  issues: Issues,
  items: BillManagerInvoiceItem[],
  prefix: string,
): Record<string, string>[] {
  return items.map((item, index) => {
    const at = `${prefix}invoiceItems[${index}]`;
    if (!isFilled(item?.itemName)) issues.add(`${at}.itemName`, 'is required');
    checkInt(issues, `${at}.amount`, item?.amount, { min: 1 });
    return { itemName: item?.itemName, amount: String(item?.amount) };
  });
}

/**
 * Validates one invoice, reporting issues under `prefix` (empty for `sendInvoice`,
 * `invoices[<n>].` for `sendInvoices`), and returns it as Daraja fields.
 */
function invoiceBody(
  issues: Issues,
  invoice: BillManagerInvoice,
  prefix: string,
): Record<string, unknown> {
  for (const field of REQUIRED_TEXT) {
    if (!isFilled(invoice[field])) issues.add(`${prefix}${field}`, 'is required');
  }
  const phone = checkNationalPhone(issues, `${prefix}billedPhoneNumber`, invoice.billedPhoneNumber);
  checkInt(issues, `${prefix}amount`, invoice.amount, { min: 1 });
  const due = isDate(invoice.dueDate);
  if (!due) issues.add(`${prefix}dueDate`, 'must be a valid date');
  const items = invoice.invoiceItems ? invoiceItems(issues, invoice.invoiceItems, prefix) : [];
  return {
    externalReference: invoice.externalReference,
    billedFullName: invoice.billedFullName,
    billedPhoneNumber: phone,
    billedPeriod: invoice.billedPeriod,
    invoiceName: invoice.invoiceName,
    dueDate: due ? formatEatDateTime(invoice.dueDate).slice(0, 10) : '',
    accountReference: invoice.accountReference,
    amount: String(invoice.amount),
    ...(invoice.invoiceItems ? { invoiceItems: items } : {}),
  };
}

/** Maps an invoicing or cancelling answer after checking its `rescode`. */
function response(raw: Record<string, unknown>): BillManagerResponse {
  checkRescode(raw);
  return {
    ...(raw.Status_Message == null ? {} : { statusMessage: str(raw.Status_Message) }),
    message: str(raw.resmsg),
    code: str(raw.rescode),
    raw,
  };
}

async function sendInvoice(
  ctx: Context,
  invoice: BillManagerInvoice,
): Promise<BillManagerResponse> {
  const issues = new Issues();
  const body = invoiceBody(issues, invoice, '');
  issues.throwIfAny('billManager.sendInvoice');
  return response(await ctx.post<Record<string, unknown>>(`${BASE}/single-invoicing`, body));
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
    sendInvoice: (invoice) => sendInvoice(ctx, invoice),
  };
}
