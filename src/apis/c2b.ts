import type { Context } from '../client';
import { checkInt, checkPhone, checkShortCode, checkUrl, Issues } from '../core/validate';
import { str } from '../core/coerce';

/** Input for `c2b.registerUrls`. */
export interface C2BRegisterInput {
  /** Paybill or till (store) number (`ShortCode`). */
  shortCode: number;
  /** Receives payment confirmations (`ConfirmationURL`). */
  confirmationUrl: string;
  /** Receives validation requests when external validation is enabled (`ValidationURL`). */
  validationUrl: string;
  /** What M-Pesa does if the validation URL can't be reached in time (`ResponseType`). */
  defaultAction: 'Completed' | 'Cancelled';
}

/** Daraja's acknowledgement of a C2B registration or simulation. */
export interface C2BResponse {
  /** Read from Daraja's misspelled `OriginatorCoversationID`, or the correct spelling. */
  originatorConversationId: string;
  /** "0", or "00000000" for a successful registration. */
  responseCode: string;
  responseDescription: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/** Input for `c2b.simulate`. */
export interface C2BSimulateInput {
  /** Paybill or till number (`ShortCode`). */
  shortCode: number;
  /** `paybill` → CustomerPayBillOnline, `till` → CustomerBuyGoodsOnline (`CommandID`). */
  type: 'paybill' | 'till';
  /** Whole shillings (`Amount`). */
  amount: number;
  /** The paying customer's number (`Msisdn`). */
  phoneNumber: string;
  /** Account number; required for paybill, ignored for till (`BillRefNumber`). */
  billRefNumber?: string;
}

/**
 * Customer to Business (C2B): register the URLs M-Pesa notifies about payments to your
 * shortcode, and simulate a payment in the sandbox. Parse the notifications with
 * `parseC2BNotification`.
 *
 * Methods throw `ValidationError` before sending when the input or client config is invalid,
 * and `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface C2BApi {
  /**
   * Registers the confirmation and validation URLs for a shortcode. In production this is a
   * one-time call: delete existing URLs in the Daraja portal before registering new ones.
   */
  registerUrls(input: C2BRegisterInput): Promise<C2BResponse>;
  /**
   * Simulates a customer payment to a registered shortcode. Sandbox only: in production it
   * throws `ValidationError` without sending.
   */
  simulate(input: C2BSimulateInput): Promise<C2BResponse>;
}

const PATHS = {
  registerUrls: '/mpesa/c2b/v2/registerurl',
  simulate: '/mpesa/c2b/v2/simulate',
} as const;

/** Daraja spells the field `OriginatorCoversationID` in C2B responses; accept both. */
export function mapC2BResponse(raw: Record<string, unknown>): C2BResponse {
  return {
    originatorConversationId: str(raw.OriginatorCoversationID ?? raw.OriginatorConversationID),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    raw,
  };
}

async function registerUrls(ctx: Context, input: C2BRegisterInput): Promise<C2BResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  checkShortCode(issues, 'shortCode', input.shortCode);
  for (const field of ['confirmationUrl', 'validationUrl'] as const) {
    checkUrl(issues, field, input[field], { production, blockKeywords: production });
  }
  if (input.defaultAction !== 'Completed' && input.defaultAction !== 'Cancelled') {
    issues.add('defaultAction', "must be 'Completed' or 'Cancelled'");
  }
  issues.throwIfAny('c2b.registerUrls');

  const raw = await ctx.post<Record<string, unknown>>(PATHS.registerUrls, {
    ShortCode: String(input.shortCode),
    ResponseType: input.defaultAction,
    ConfirmationURL: input.confirmationUrl,
    ValidationURL: input.validationUrl,
  });
  return mapC2BResponse(raw);
}

async function simulate(ctx: Context, input: C2BSimulateInput): Promise<C2BResponse> {
  const issues = new Issues();
  if (ctx.environment !== 'sandbox') {
    issues.add('environment', 'must be sandbox; Daraja does not support simulation in production');
  }
  checkShortCode(issues, 'shortCode', input.shortCode);
  if (input.type !== 'paybill' && input.type !== 'till') {
    issues.add('type', "must be 'paybill' or 'till'");
  }
  checkInt(issues, 'amount', input.amount, 1);
  const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
  if (input.type === 'paybill' && !input.billRefNumber) {
    issues.add('billRefNumber', 'is required for paybill payments');
  }
  issues.throwIfAny('c2b.simulate');

  const raw = await ctx.post<Record<string, unknown>>(PATHS.simulate, {
    ShortCode: input.shortCode,
    CommandID: input.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: input.amount,
    Msisdn: Number(phone),
    BillRefNumber: input.type === 'till' ? null : input.billRefNumber,
  });
  return mapC2BResponse(raw);
}

/** Customer to Business (C2B) payment notifications. */
export function c2b(ctx: Context): C2BApi {
  return {
    registerUrls: (input) => registerUrls(ctx, input),
    simulate: (input) => simulate(ctx, input),
  };
}
