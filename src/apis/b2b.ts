import type { Context } from '../client';
import { checkInt, checkLength, checkPhone, checkShortCode, type Issues } from '../core/validate';
import { initiatorRequest } from './initiator';
import type { InitiatorResponse } from './shared';

/** Fields shared by every Business to Business (B2B) payment. */
interface B2BCommon {
  /** Whole shillings, at least 1 (`Amount`). */
  amount: number;
  /** Your shortcode, which is debited (`PartyA`). */
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
  /** The paybill credited (`PartyB`). */
  partyB: number;
  /** The account number at the paybill, 1 to 13 characters (`AccountReference`). */
  accountReference: string;
  /** Optional. The customer you are paying for (`Requester`). */
  requester?: string;
  /** Optional. 1 to 100 characters (`Occassion`, Daraja's spelling). */
  occasion?: string;
}

/** Input for `b2b.buyGoods`. */
export interface B2BBuyGoodsInput extends B2BCommon {
  /** The till, merchant store or merchant head office credited (`PartyB`). */
  partyB: number;
  /** Optional. 1 to 13 characters (`AccountReference`). */
  accountReference?: string;
  /** Optional. The customer you are paying for (`Requester`). */
  requester?: string;
  /** Optional. 1 to 100 characters (`Occassion`, Daraja's spelling). */
  occasion?: string;
}

/** Input for `b2b.topUpB2C`. */
export interface B2BTopUpInput extends B2BCommon {
  /** The B2C shortcode whose utility account is credited (`PartyB`). */
  partyB: number;
  /** Optional. 1 to 13 characters (`AccountReference`). */
  accountReference?: string;
  /** Optional. The customer you are paying for (`Requester`). */
  requester?: string;
}

/**
 * Business to Business (B2B) payments from your shortcode. Each needs the initiator to hold the
 * product's org API role on M-Pesa.
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
}

const PAYMENT_PATH = '/mpesa/b2b/v1/paymentrequest';

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

/** Business to Business (B2B) payments. */
export function b2b(ctx: Context): B2BApi {
  return {
    payBill: (input) => payBill(ctx, input),
    buyGoods: (input) => buyGoods(ctx, input),
    topUpB2C: (input) => topUpB2C(ctx, input),
  };
}
