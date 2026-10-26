import { isRecord } from '../callbacks/shared';
import type { Context } from '../client';
import { str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { formatEatDate } from '../core/time';
import {
  checkInt,
  checkLength,
  checkPhone,
  checkShortCode,
  checkUrl,
  Issues,
} from '../core/validate';

/** How often a standing order runs (`Frequency` 1 to 9). */
export type RatibaFrequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'halfYearly'
  | 'yearly';

/** Input for `ratiba.createStandingOrder`. */
export interface RatibaStandingOrderInput {
  /**
   * The order's name, unique among the customer's standing orders (`StandingOrderName`). A
   * duplicate is refused in the callback with result code 1050, not here.
   */
  name: string;
  /**
   * Whether `shortCode` is a paybill or a till. Sets `ReceiverPartyIdentifierType` (`"4"` or
   * `"2"`) and the matching `TransactionType`.
   */
  type: 'paybill' | 'till';
  /** Your paybill or till, 5 to 7 digits, which is paid (`BusinessShortCode`). */
  shortCode: number;
  /** The customer who pays: `07…`, `01…`, `+254…` or `254…`, sent as `254…` (`PartyA`). */
  phoneNumber: string;
  /** Whole shillings per payment, at least 1 (`Amount`). */
  amount: number;
  /** The first day the order runs, sent as an East Africa Time date (`StartDate`). */
  startDate: Date;
  /** The last day the order runs; not before `startDate`'s day in EAT (`EndDate`). */
  endDate: Date;
  /** How often it runs (`Frequency`). */
  frequency: RatibaFrequency;
  /** The account number at your paybill, 1 to 12 characters (`AccountReference`). */
  accountReference: string;
  /** 1 to 13 characters (`TransactionDesc`). */
  description: string;
  /** Receives the result (`CallBackURL`); see `parseRatibaCallback`. */
  callbackUrl: string;
  /** Your unique ID for this request (`CustomStoId`). Defaults to a random UUID. */
  requestRefId?: string;
}

/** Daraja's acknowledgement of a standing order request. */
export interface RatibaResponse {
  /** Daraja's ID for the request (`responseRefID`). */
  responseRefId: string;
  /** Always "200": anything else throws `DarajaApiError`. */
  responseCode: string;
  responseDescription: string;
  /** The `CustomStoId` sent, generated or given. */
  requestRefId: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * M-Pesa Ratiba: standing orders that collect from a customer's M-Pesa on a schedule. A
 * commercial API: going live needs a signed agreement with Safaricom. No initiator is needed.
 *
 * Methods throw `ValidationError` before sending when the input is invalid, and
 * `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface RatibaApi {
  /**
   * Asks a customer to set up a standing order. Daraja sends them an M-Pesa prompt for consent,
   * creates the order, then posts the result to `callbackUrl` (see `parseRatibaCallback`). The
   * acknowledgement only confirms the request was accepted.
   */
  createStandingOrder(input: RatibaStandingOrderInput): Promise<RatibaResponse>;
}

const PATH = '/standingorder/v1/createStandingOrderExternal';
const ACCEPTED = '200';
const TYPES = {
  paybill: { identifier: '4', transactionType: 'Standing Order Pay Bill Ext-Third Party' },
  till: { identifier: '2', transactionType: 'Standing Order Merchant Payment Ext-Third Party' },
} as const;
const FREQUENCIES: Record<RatibaFrequency, string> = {
  once: '1',
  daily: '2',
  weekly: '3',
  biweekly: '4',
  monthly: '5',
  bimonthly: '6',
  quarterly: '7',
  halfYearly: '8',
  yearly: '9',
};

const isDate = (value: Date): boolean => value instanceof Date && !Number.isNaN(value.getTime());
const isFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

/** Checks the start and end dates. */
function checkDates(issues: Issues, input: RatibaStandingOrderInput): void {
  const start = isDate(input.startDate);
  if (!start) issues.add('startDate', 'must be a valid date');
  if (!isDate(input.endDate)) issues.add('endDate', 'must be a valid date');
  // Compared as the EAT days sent, so a one-day order can end earlier in the day it starts.
  else if (start && formatEatDate(input.endDate) < formatEatDate(input.startDate)) {
    issues.add('endDate', 'must not be before startDate');
  }
}

/** Checks `type` and `frequency`, which must be own keys of their tables. */
function checkChoices(issues: Issues, input: RatibaStandingOrderInput): void {
  if (!Object.hasOwn(TYPES, input.type)) issues.add('type', "must be 'paybill' or 'till'");
  if (!Object.hasOwn(FREQUENCIES, input.frequency)) {
    issues.add(
      'frequency',
      "must be 'once', 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'halfYearly' or 'yearly'",
    );
  }
}

/** Validates the input and returns the phone number and request ID to send. */
function check(ctx: Context, input: RatibaStandingOrderInput): { phone: string; ref: string } {
  const issues = new Issues();
  if (!isFilled(input.name)) issues.add('name', 'is required');
  checkInt(issues, 'amount', input.amount, { min: 1 });
  checkShortCode(issues, 'shortCode', input.shortCode);
  const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
  checkLength(issues, 'accountReference', input.accountReference, {
    min: 1,
    max: 12,
    required: true,
  });
  checkLength(issues, 'description', input.description, { min: 1, max: 13, required: true });
  checkDates(issues, input);
  checkChoices(issues, input);
  checkUrl(issues, 'callbackUrl', input.callbackUrl, {
    production: ctx.environment === 'production',
  });
  if (input.requestRefId !== undefined && !isFilled(input.requestRefId)) {
    issues.add('requestRefId', 'is required');
  }
  issues.throwIfAny('ratiba.createStandingOrder');
  return { phone, ref: input.requestRefId ?? crypto.randomUUID() };
}

async function createStandingOrder(
  ctx: Context,
  input: RatibaStandingOrderInput,
): Promise<RatibaResponse> {
  const { phone, ref } = check(ctx, input);
  const type = TYPES[input.type];
  // Every value is sent as a string, as in the portal's sample.
  const raw = await ctx.post<Record<string, unknown>>(PATH, {
    StandingOrderName: input.name,
    ReceiverPartyIdentifierType: type.identifier,
    TransactionType: type.transactionType,
    BusinessShortCode: String(input.shortCode),
    PartyA: phone,
    Amount: String(input.amount),
    StartDate: formatEatDate(input.startDate),
    EndDate: formatEatDate(input.endDate),
    Frequency: FREQUENCIES[input.frequency],
    CustomStoId: ref,
    AccountReference: input.accountReference,
    TransactionDesc: input.description,
    CallBackURL: input.callbackUrl,
  });
  // The acknowledgement carries `ResponseHeader.responseCode` "200", not `ResponseCode`.
  const header = isRecord(raw.ResponseHeader) ? raw.ResponseHeader : {};
  const responseCode = str(header.responseCode);
  if (responseCode !== ACCEPTED) {
    throw new DarajaApiError({
      status: 200,
      body: raw,
      ...(responseCode ? { errorCode: responseCode } : {}),
      errorMessage: str(header.responseDescription),
    });
  }
  return {
    responseRefId: str(header.responseRefID),
    responseCode,
    responseDescription: str(header.responseDescription),
    requestRefId: ref,
    raw,
  };
}

/** M-Pesa Ratiba standing orders. */
export function ratiba(ctx: Context): RatibaApi {
  return {
    createStandingOrder: (input) => createStandingOrder(ctx, input),
  };
}
