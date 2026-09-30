import type { Context } from '../client';
import { formatTimestamp } from '../core/time';
import { code, str } from '../core/coerce';
import {
  checkInt,
  checkLength,
  checkPhone,
  checkShortCode,
  checkUrl,
  Issues,
} from '../core/validate';

/** Input for `stkPush.send`. */
export interface StkPushInput {
  /** The paybill or HO/store number that receives the payment (`BusinessShortCode`). */
  shortCode: number;
  /** `paybill` → CustomerPayBillOnline, `till` → CustomerBuyGoodsOnline (`TransactionType`). */
  type: 'paybill' | 'till';
  /** Whole shillings, at least 1 (`Amount`). */
  amount: number;
  /** The customer's number; `07…`, `01…`, `+254…` and `254…` are accepted (`PartyA`, `PhoneNumber`). */
  phoneNumber: string;
  /** Receiving party; defaults to `shortCode`. Set it to the till number for till payments (`PartyB`). */
  partyB?: number;
  /** Where Daraja posts the result (`CallBackURL`). */
  callbackUrl: string;
  /** Shown to the customer, up to 12 characters (`AccountReference`). */
  accountReference: string;
  /** Up to 13 characters; defaults to "Payment" (`TransactionDesc`). */
  description?: string;
}

/** Daraja's acknowledgement of an STK push. The payment's outcome arrives at `callbackUrl`. */
export interface StkPushResponse {
  merchantRequestId: string;
  /** Identifies the push in `stkPush.query` and in the callback. */
  checkoutRequestId: string;
  /** "0" when Daraja accepted the push. */
  responseCode: string;
  responseDescription: string;
  /** A message suitable for showing to the customer. */
  customerMessage: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/** Input for `stkPush.query`. */
export interface StkQueryInput {
  /** The shortcode used for the push (`BusinessShortCode`). */
  shortCode: number;
  /** From the `stkPush.send` response (`CheckoutRequestID`). */
  checkoutRequestId: string;
}

/** The state of an STK push, as reported by `stkPush.query`. */
export interface StkQueryResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  /** 0 means paid; for example 1032 means the customer cancelled. */
  resultCode: number | string;
  resultDesc: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * M-Pesa Express (STK push).
 *
 * Methods throw `ValidationError` before sending when the input or client config is invalid,
 * and `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface StkPushApi {
  /** Sends an M-Pesa Express (STK push) payment prompt to the customer's phone. */
  send(input: StkPushInput): Promise<StkPushResponse>;
  /**
   * Checks the outcome of an STK push. Queried too soon after the push (under about 30
   * seconds in the sandbox), Daraja answers HTTP 500 `500.001.1001` "The transaction does not
   * Exist", which throws `DarajaApiError`; retry later or rely on the callback.
   */
  query(input: StkQueryInput): Promise<StkQueryResponse>;
}

const PATHS = {
  send: '/mpesa/stkpush/v1/processrequest',
  query: '/mpesa/stkpushquery/v1/query',
} as const;

/**
 * The `Password` and `Timestamp` pair both STK calls need: base64 of shortcode, passkey and
 * timestamp. The timestamp is EAT, and Daraja checks the password against it.
 */
function password(
  ctx: Context,
  shortCode: number,
  passkey: string,
): { Password: string; Timestamp: string } {
  const timestamp = formatTimestamp(ctx.now());
  return { Password: btoa(`${shortCode}${passkey}${timestamp}`), Timestamp: timestamp };
}

async function send(ctx: Context, input: StkPushInput): Promise<StkPushResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  const passkey = ctx.config.passkey;
  if (!passkey) issues.add('passkey', 'is required in the client config for stkPush');
  checkShortCode(issues, 'shortCode', input.shortCode);
  if (input.type !== 'paybill' && input.type !== 'till') {
    issues.add('type', "must be 'paybill' or 'till'");
  }
  checkInt(issues, 'amount', input.amount, { min: 1 });
  const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
  if (input.partyB !== undefined) checkShortCode(issues, 'partyB', input.partyB);
  checkUrl(issues, 'callbackUrl', input.callbackUrl, { production });
  checkLength(issues, 'accountReference', input.accountReference, {
    min: 1,
    max: 12,
    required: true,
  });
  checkLength(issues, 'description', input.description, { min: 1, max: 13 });
  issues.throwIfAny('stkPush.send');

  const raw = await ctx.post<Record<string, unknown>>(PATHS.send, {
    BusinessShortCode: input.shortCode,
    ...password(ctx, input.shortCode, passkey!),
    TransactionType: input.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: input.amount,
    PartyA: phone,
    PartyB: input.partyB ?? input.shortCode,
    PhoneNumber: phone,
    CallBackURL: input.callbackUrl,
    AccountReference: input.accountReference,
    TransactionDesc: input.description || 'Payment',
  });

  return {
    merchantRequestId: str(raw.MerchantRequestID),
    checkoutRequestId: str(raw.CheckoutRequestID),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    customerMessage: str(raw.CustomerMessage),
    raw,
  };
}

async function query(ctx: Context, input: StkQueryInput): Promise<StkQueryResponse> {
  const issues = new Issues();
  const passkey = ctx.config.passkey;
  if (!passkey) issues.add('passkey', 'is required in the client config for stkPush');
  checkShortCode(issues, 'shortCode', input.shortCode);
  checkLength(issues, 'checkoutRequestId', input.checkoutRequestId, {
    min: 1,
    max: 100,
    required: true,
  });
  issues.throwIfAny('stkPush.query');

  const raw = await ctx.post<Record<string, unknown>>(PATHS.query, {
    BusinessShortCode: input.shortCode,
    ...password(ctx, input.shortCode, passkey!),
    CheckoutRequestID: input.checkoutRequestId,
  });

  return {
    merchantRequestId: str(raw.MerchantRequestID),
    checkoutRequestId: str(raw.CheckoutRequestID),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    resultCode: code(raw.ResultCode),
    resultDesc: str(raw.ResultDesc),
    raw,
  };
}

/** M-Pesa Express (STK push). */
export function stkPush(ctx: Context): StkPushApi {
  return {
    send: (input) => send(ctx, input),
    query: (input) => query(ctx, input),
  };
}
