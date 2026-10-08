import { isRecord, readCents } from '../callbacks/shared';
import type { Context } from '../client';
import { code, str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { checkInt, Issues } from '../core/validate';

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

/**
 * Lipa na Bonga: let customers pay your paybill or till with Safaricom Bonga points. No
 * initiator is needed. A redeemed payment reaches you as an ordinary C2B confirmation, on the
 * URLs registered with `c2b.registerUrls` (see `parseC2BNotification`).
 *
 * Methods throw `ValidationError` before sending when the input is invalid, and
 * `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface BongaApi {
  /** Returns what a number of points is worth in shillings, and the rate used. */
  calculatePoints(input: BongaCalculateInput): Promise<BongaCalculateResponse>;
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

/** Lipa na Bonga. */
export function bonga(ctx: Context): BongaApi {
  return {
    calculatePoints: (input) => calculatePoints(ctx, input),
  };
}
