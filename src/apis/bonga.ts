import { isRecord, readCents } from '../callbacks/shared';
import type { Context } from '../client';
import { code, str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { checkInt, checkPhone, checkShortCode, Issues } from '../core/validate';

/** Input for `bonga.calculatePoints`. */
export interface BongaCalculateInput {
  /** Whole Bonga points, at least 1 (`points`). */
  points: number;
}

/** What a number of Bonga points is worth, from `bonga.calculatePoints`. */
export interface BongaCalculateResponse {
  /** What the points are worth, in cents (KES 8 is 800). */
  amountCents: number;
  /** The points converted. */
  points: number;
  /** Shillings per point, for example 0.2. */
  rate: number;
  /** Daraja's ID for the request. */
  requestRefId: string;
  /** Always 200: anything else throws `DarajaApiError`. */
  responseCode: number | string;
  /** Daraja's message for the customer. */
  customerMessage: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/** Input for `bonga.redeem`. Pass the values `calculatePoints` returned. */
export interface BongaRedeemInput {
  /** The customer paying with points: `07…`, `01…`, `+254…` or `254…`, sent as `254…` (`msisdn`). */
  phoneNumber: string;
  /** Your paybill or till, 5 to 7 digits, which is paid (`shortCode`). */
  shortCode: number;
  /** The account number at your paybill (`accountNumber`). */
  accountNumber: string;
  /** Whole points to redeem, at least 1 (`bongaPoints`). */
  points: number;
  /**
   * The shillings the points pay for, at most 2 decimal places (`amount`). `calculatePoints`
   * gives `points × rate`; the SDK doesn't enforce it, Daraja does if it chooses to.
   */
  amount: number;
  /** Shillings per point, as `calculatePoints` returned it (`conversionRate`). */
  rate: number;
}

/** Daraja's acknowledgement of a redemption. */
export interface BongaRedeemResponse {
  /** Daraja's ID for the request. */
  requestRefId: string;
  /** Always 200: anything else throws `DarajaApiError`. */
  responseCode: number | string;
  /** For example "Operation Successfully.". */
  responseMessage: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * Lipa na Bonga: let customers pay your paybill or till with Safaricom Bonga points. No
 * initiator is needed. A redeemed payment reaches you as an ordinary C2B confirmation, on the
 * URLs registered with `c2b.registerUrls` (see `parseC2BNotification`).
 *
 * Methods throw `ValidationError` before sending when the input is invalid, and
 * `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface BongaApi {
  /** Returns what a number of points is worth, in cents (`amountCents`), and the rate used. */
  calculatePoints(input: BongaCalculateInput): Promise<BongaCalculateResponse>;
  /**
   * Asks a customer to pay with Bonga points. Daraja sends them an M-Pesa prompt; once the
   * points are deducted, M-Pesa pays your shortcode and posts a C2B confirmation. The
   * acknowledgement only confirms the request was received.
   */
  redeem(input: BongaRedeemInput): Promise<BongaRedeemResponse>;
}

const BASE = '/v1/lipa/na/bonga';
const OK = 200;
const INTEGER = /^\d+$/;
const DECIMAL = /^\d+(?:\.\d+)?$/;

/**
 * Returns the response `header`, or throws `DarajaApiError` when it is missing or its
 * `responseCode` isn't 200. Bonga answers with `header.responseCode`, not `ResponseCode`.
 */
function checkHeader(raw: Record<string, unknown>): Record<string, unknown> {
  const header = isRecord(raw.header) ? raw.header : {};
  if (code(header.responseCode) !== OK) {
    const responseCode = str(header.responseCode);
    throw new DarajaApiError({
      status: 200,
      body: raw,
      ...(responseCode ? { errorCode: responseCode } : {}),
      errorMessage: str(header.responseMessage),
    });
  }
  return header;
}

/** Reads a whole number sent as a string or a number, recording an issue otherwise. */
function readInteger(issues: Issues, path: string, value: unknown): number {
  const text = str(value);
  if (!INTEGER.test(text)) issues.add(path, 'must be an integer');
  return Number(text);
}

/** Reads a positive decimal sent as a string or a number, recording an issue otherwise. */
function readRate(issues: Issues, path: string, value: unknown): number {
  const text = str(value);
  if (!DECIMAL.test(text) || Number(text) <= 0) issues.add(path, 'must be a positive number');
  return Number(text);
}

async function calculatePoints(
  ctx: Context,
  input: BongaCalculateInput,
): Promise<BongaCalculateResponse> {
  const issues = new Issues();
  checkInt(issues, 'points', input.points, { min: 1 });
  issues.throwIfAny('bonga.calculatePoints');

  const raw = await ctx.post<Record<string, unknown>>(`${BASE}/calculate-points`, {
    points: String(input.points),
  });
  const header = checkHeader(raw);
  const body = isRecord(raw.body) ? raw.body : {};
  const read = new Issues();
  const amountCents = readCents(read, 'body.amount', body.amount);
  if (amountCents !== undefined && amountCents <= 0)
    read.add('body.amount', 'must be a positive number');
  const points = readInteger(read, 'body.points', body.points);
  const rate = readRate(read, 'body.rate', body.rate);
  read.throwIfAny('bonga.calculatePoints');
  return {
    amountCents: amountCents!,
    points,
    rate,
    requestRefId: str(header.requestRefId),
    responseCode: code(header.responseCode),
    customerMessage: str(header.customerMessage),
    raw,
  };
}

const isFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;
const toCents = (shillings: number): number => Math.round(shillings * 100);

/**
 * Checks that `amount` is a positive number of shillings and cents. Whether it matches
 * `points × rate` is left to Daraja: the portal's own sample sends one that doesn't.
 */
function checkAmount(issues: Issues, input: BongaRedeemInput): void {
  if (!isPositive(input.amount)) {
    issues.add('amount', 'must be a positive number');
    return;
  }
  if (Math.abs(toCents(input.amount) - input.amount * 100) > 1e-6) {
    issues.add('amount', 'must have at most 2 decimal places');
  }
}

async function redeem(ctx: Context, input: BongaRedeemInput): Promise<BongaRedeemResponse> {
  const issues = new Issues();
  const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
  checkShortCode(issues, 'shortCode', input.shortCode);
  if (!isFilled(input.accountNumber)) issues.add('accountNumber', 'is required');
  checkInt(issues, 'points', input.points, { min: 1 });
  if (!isPositive(input.rate)) issues.add('rate', 'must be a positive number');
  checkAmount(issues, input);
  issues.throwIfAny('bonga.redeem');

  const raw = await ctx.post<Record<string, unknown>>(`${BASE}/redeem-paybill`, {
    msisdn: phone,
    amount: input.amount,
    bongaPoints: input.points,
    conversionRate: input.rate,
    shortCode: String(input.shortCode),
    accountNumber: input.accountNumber,
  });
  const header = checkHeader(raw);
  return {
    requestRefId: str(header.requestRefId),
    responseCode: code(header.responseCode),
    responseMessage: str(header.responseMessage),
    raw,
  };
}

/** Lipa na Bonga. */
export function bonga(ctx: Context): BongaApi {
  return {
    calculatePoints: (input) => calculatePoints(ctx, input),
    redeem: (input) => redeem(ctx, input),
  };
}
