import type { Context } from '../client';
import { formatTimestamp } from '../core/time';
import { code, str } from './shared';
import {
  checkInt,
  checkLength,
  checkPhone,
  checkShortCode,
  checkUrl,
  Issues,
} from '../core/validate';

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

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

export interface StkQueryInput {
  /** The shortcode used for the push (`BusinessShortCode`). */
  shortCode: number;
  /** From the `stkPush.send` response (`CheckoutRequestID`). */
  checkoutRequestId: string;
}

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

export interface StkPushApi {
  /** Sends an M-Pesa Express (STK push) payment prompt to the customer's phone. */
  send(input: StkPushInput): Promise<StkPushResponse>;
  /** Checks the outcome of an STK push. */
  query(input: StkQueryInput): Promise<StkQueryResponse>;
}

const PATHS = {
  send: '/mpesa/stkpush/v1/processrequest',
  query: '/mpesa/stkpushquery/v1/query',
} as const;

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
  checkInt(issues, 'amount', input.amount, 1);
  const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
  if (input.partyB !== undefined) checkShortCode(issues, 'partyB', input.partyB);
  checkUrl(issues, 'callbackUrl', input.callbackUrl, { production });
  checkLength(issues, 'accountReference', input.accountReference, 1, 12, true);
  checkLength(issues, 'description', input.description, 1, 13);
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
  checkLength(issues, 'checkoutRequestId', input.checkoutRequestId, 1, 100, true);
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
