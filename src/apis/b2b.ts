import type { Context } from '../client';
import { str } from '../core/coerce';
import {
  checkInt,
  checkLength,
  checkPhone,
  checkShortCode,
  checkUrl,
  Issues,
} from '../core/validate';
import { initiatorRequest } from './initiator';
import type { InitiatorResponse } from './shared';

/** Fields shared by every Business to Business (B2B) payment. */
interface B2BCommon {
  /** Whole shillings, at least 1 (`Amount`). */
  amount: number;
  /** Your shortcode, 5 to 7 digits, which is debited (`PartyA`). */
  shortCode: number;
  /** 1 to 100 characters (`Remarks`). */
  remarks: string;
  /** Receives the payment result (`ResultURL`). */
  resultUrl: string;
  /** Receives a notice if the request times out in the queue (`QueueTimeOutURL`). */
  queueTimeoutUrl: string;
}

/** Input for `b2b.payBill`. */
export interface B2BPayBillInput extends B2BCommon {
  /** The paybill credited, 5 to 7 digits (`PartyB`). */
  partyB: number;
  /** The account number at the paybill, 1 to 13 characters (`AccountReference`). */
  accountReference: string;
  /**
   * Optional. The customer you are paying for, as `07…`, `01…`, `+254…` or `254…`; sent as
   * `254…` (`Requester`).
   */
  requester?: string;
  /** Optional. 1 to 100 characters (`Occassion`, Daraja's spelling). */
  occasion?: string;
}

/** Input for `b2b.buyGoods`. */
export interface B2BBuyGoodsInput extends B2BCommon {
  /** The till, merchant store or head office credited, 5 to 7 digits (`PartyB`). */
  partyB: number;
  /** Optional. 1 to 13 characters (`AccountReference`). */
  accountReference?: string;
  /**
   * Optional. The customer you are paying for, as `07…`, `01…`, `+254…` or `254…`; sent as
   * `254…` (`Requester`).
   */
  requester?: string;
  /** Optional. 1 to 100 characters (`Occassion`, Daraja's spelling). */
  occasion?: string;
}

/** Input for `b2b.topUpB2C`. */
export interface B2BTopUpInput extends B2BCommon {
  /** The B2C shortcode whose utility account is credited, 5 to 7 digits (`PartyB`). */
  partyB: number;
  /** Optional. 1 to 13 characters (`AccountReference`). */
  accountReference?: string;
  /**
   * Optional. The customer you are paying for, as `07…`, `01…`, `+254…` or `254…`; sent as
   * `254…` (`Requester`).
   */
  requester?: string;
}

/** Input for `b2b.remitTax`. The tax always goes to KRA's shortcode, 572572 (`PartyB`). */
export interface B2BTaxInput extends B2BCommon {
  /** KRA's payment registration number (PRN), 1 to 13 characters (`AccountReference`). */
  accountReference: string;
}

/** Input for `b2b.expressCheckout`. */
export interface B2BExpressCheckoutInput {
  /** Your paybill, 5 to 7 digits, which is credited (`receiverShortCode`). */
  shortCode: number;
  /** The merchant's till, 5 to 7 digits, which is debited (`primaryShortCode`). */
  merchantTill: number;
  /** Whole shillings, at least 1 (`amount`). */
  amount: number;
  /** Shown to the merchant in the USSD prompt (`paymentRef`). */
  paymentReference: string;
  /** Your name as the merchant knows it, shown in the prompt (`partnerName`). */
  partnerName: string;
  /** Receives the result of the push (`callbackUrl`); see `parseExpressCheckoutCallback`. */
  callbackUrl: string;
  /** Your unique ID for this push (`RequestRefID`). Defaults to a random UUID. */
  requestRefId?: string;
}

/** Daraja's acknowledgement of a B2B Express CheckOut push. */
export interface B2BExpressCheckoutResponse {
  /** "0" when the USSD prompt was sent. */
  code: string;
  /** For example "USSD Initiated Successfully". */
  status: string;
  /** The `RequestRefID` sent, generated or given. */
  requestRefId: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * Business to Business (B2B) payments. `payBill`, `buyGoods`, `topUpB2C` and `remitTax` pay from
 * your shortcode and need the initiator to hold the product's org API role on M-Pesa;
 * `expressCheckout` needs no initiator.
 *
 * Methods throw `ValidationError` before sending when the input or client config is invalid,
 * and `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface B2BApi {
  /**
   * Pays a paybill from your shortcode's working account (Business Pay Bill), for yourself or
   * for a customer. The outcome arrives at `resultUrl` (see `parseResult`).
   */
  payBill(input: B2BPayBillInput): Promise<InitiatorResponse>;
  /**
   * Pays a till or merchant from your shortcode's working account (Business Buy Goods), for
   * yourself or for a customer. The outcome arrives at `resultUrl` (see `parseResult`).
   */
  buyGoods(input: B2BBuyGoodsInput): Promise<InitiatorResponse>;
  /**
   * Moves money from your shortcode's working account to a B2C shortcode's utility account,
   * ready for disbursement (B2C Account Top Up). The outcome arrives at `resultUrl`.
   */
  topUpB2C(input: B2BTopUpInput): Promise<InitiatorResponse>;
  /**
   * Pays tax to the Kenya Revenue Authority against a payment registration number (Tax
   * Remittance). Needs prior integration with KRA to generate the PRN. The outcome arrives at
   * `resultUrl`.
   */
  remitTax(input: B2BTaxInput): Promise<InitiatorResponse>;
  /**
   * Sends a USSD prompt to a merchant's nominated operator to pay your paybill from the
   * merchant's till (B2B Express CheckOut). No initiator is needed. The acknowledgement only
   * confirms the prompt was sent; the outcome arrives at `callbackUrl` (see
   * `parseExpressCheckoutCallback`).
   */
  expressCheckout(input: B2BExpressCheckoutInput): Promise<B2BExpressCheckoutResponse>;
}

const PAYMENT_PATH = '/mpesa/b2b/v1/paymentrequest';
const TAX_PATH = '/mpesa/b2b/v1/remittax';
const EXPRESS_PATH = '/v1/ussdpush/get-msisdn';
/** KRA's shortcode, the only `PartyB` Tax Remittance accepts. */
const KRA_SHORTCODE = 572572;

/** One B2B request: its `CommandID`, path and the fields only it sends. */
interface B2BCall {
  api: string;
  path: string;
  commandId: string;
  input: B2BCommon;
  partyB: number;
  /** Validates the product's own fields and returns them as Daraja fields. */
  extra(issues: Issues): Record<string, unknown>;
}

/** Validates and sends a B2B request through the initiator. */
function b2bRequest(ctx: Context, call: B2BCall): Promise<InitiatorResponse> {
  const { input } = call;
  return initiatorRequest(ctx, {
    api: call.api,
    path: call.path,
    resultUrl: input.resultUrl,
    queueTimeoutUrl: input.queueTimeoutUrl,
    fields: (issues) => {
      checkInt(issues, 'amount', input.amount, { min: 1 });
      checkShortCode(issues, 'shortCode', input.shortCode);
      checkShortCode(issues, 'partyB', call.partyB);
      checkLength(issues, 'remarks', input.remarks, { min: 1, max: 100, required: true });
      return {
        CommandID: call.commandId,
        SenderIdentifierType: '4',
        RecieverIdentifierType: '4', // Daraja's spelling
        Amount: input.amount,
        PartyA: input.shortCode,
        PartyB: call.partyB,
        ...call.extra(issues),
        Remarks: input.remarks,
      };
    },
  });
}

/** The optional and per-product fields some B2B products send. */
interface ExtraInput {
  accountReference?: string;
  requester?: string;
  occasion?: string;
}

/**
 * Validates `AccountReference`, `Requester` and `Occassion` and returns those that are set.
 * The account reference is required where `requireAccount` is true.
 */
function extraFields(
  issues: Issues,
  input: ExtraInput,
  requireAccount: boolean,
): Record<string, unknown> {
  checkLength(issues, 'accountReference', input.accountReference, {
    min: 1,
    max: 13,
    required: requireAccount,
  });
  checkLength(issues, 'occasion', input.occasion, { min: 1, max: 100 });
  const requester = input.requester ? checkPhone(issues, 'requester', input.requester) : '';
  return {
    ...(input.accountReference ? { AccountReference: input.accountReference } : {}),
    ...(requester ? { Requester: requester } : {}),
    ...(input.occasion ? { Occassion: input.occasion } : {}),
  };
}

function payBill(ctx: Context, input: B2BPayBillInput): Promise<InitiatorResponse> {
  return b2bRequest(ctx, {
    api: 'b2b.payBill',
    path: PAYMENT_PATH,
    commandId: 'BusinessPayBill',
    input,
    partyB: input.partyB,
    extra: (issues) => extraFields(issues, input, true),
  });
}

function buyGoods(ctx: Context, input: B2BBuyGoodsInput): Promise<InitiatorResponse> {
  return b2bRequest(ctx, {
    api: 'b2b.buyGoods',
    path: PAYMENT_PATH,
    commandId: 'BusinessBuyGoods',
    input,
    partyB: input.partyB,
    extra: (issues) => extraFields(issues, input, false),
  });
}

function topUpB2C(ctx: Context, input: B2BTopUpInput): Promise<InitiatorResponse> {
  // Top Up takes no Occassion, so only the account reference and requester are passed on.
  const { accountReference, requester } = input;
  return b2bRequest(ctx, {
    api: 'b2b.topUpB2C',
    path: PAYMENT_PATH,
    commandId: 'BusinessPayToBulk',
    input,
    partyB: input.partyB,
    extra: (issues) => extraFields(issues, { accountReference, requester }, false),
  });
}

function remitTax(ctx: Context, input: B2BTaxInput): Promise<InitiatorResponse> {
  // Only the PRN is passed on: Tax Remittance takes no Requester or Occassion.
  const { accountReference } = input;
  return b2bRequest(ctx, {
    api: 'b2b.remitTax',
    path: TAX_PATH,
    commandId: 'PayTaxToKRA',
    input,
    partyB: KRA_SHORTCODE,
    extra: (issues) => extraFields(issues, { accountReference }, true),
  });
}

/** A string with something other than whitespace in it. */
const isFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

/** Validates an Express CheckOut push and returns the request ID to send. */
function checkExpressCheckout(ctx: Context, input: B2BExpressCheckoutInput): string {
  const issues = new Issues();
  checkInt(issues, 'amount', input.amount, { min: 1 });
  checkShortCode(issues, 'shortCode', input.shortCode);
  checkShortCode(issues, 'merchantTill', input.merchantTill);
  if (!isFilled(input.paymentReference)) issues.add('paymentReference', 'is required');
  if (!isFilled(input.partnerName)) issues.add('partnerName', 'is required');
  checkUrl(issues, 'callbackUrl', input.callbackUrl, {
    production: ctx.environment === 'production',
  });
  if (input.requestRefId !== undefined && !isFilled(input.requestRefId)) {
    issues.add('requestRefId', 'is required');
  }
  issues.throwIfAny('b2b.expressCheckout');
  return input.requestRefId ?? crypto.randomUUID();
}

async function expressCheckout(
  ctx: Context,
  input: B2BExpressCheckoutInput,
): Promise<B2BExpressCheckoutResponse> {
  const requestRefId = checkExpressCheckout(ctx, input);
  // Shortcodes and the amount are sent as strings, as in the portal's sample. The
  // acknowledgement carries `code`, not `ResponseCode`, so a non-zero code is returned as is.
  const raw = await ctx.post<Record<string, unknown>>(EXPRESS_PATH, {
    primaryShortCode: String(input.merchantTill),
    receiverShortCode: String(input.shortCode),
    amount: String(input.amount),
    paymentRef: input.paymentReference,
    callbackUrl: input.callbackUrl,
    partnerName: input.partnerName,
    RequestRefID: requestRefId,
  });
  return { code: str(raw.code), status: str(raw.status), requestRefId, raw };
}

/** Business to Business (B2B) payments. */
export function b2b(ctx: Context): B2BApi {
  return {
    payBill: (input) => payBill(ctx, input),
    buyGoods: (input) => buyGoods(ctx, input),
    topUpB2C: (input) => topUpB2C(ctx, input),
    remitTax: (input) => remitTax(ctx, input),
    expressCheckout: (input) => expressCheckout(ctx, input),
  };
}
