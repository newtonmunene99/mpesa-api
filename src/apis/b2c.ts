import type { Context } from '../client';
import { checkInt, checkLength, checkPhone, checkShortCode, type Issues } from '../core/validate';
import { initiatorRequest } from './initiator';
import type { InitiatorResponse } from './shared';

/** The kind of B2C payment (`CommandID`). Promotion payments send a congratulatory SMS. */
export type B2CCommand = 'SalaryPayment' | 'BusinessPayment' | 'PromotionPayment';

/** Input for `b2c.pay`. */
export interface B2CInput {
  /**
   * Your unique ID for this payment, used by Daraja to reject duplicates
   * (`OriginatorConversationID`). Defaults to a random UUID; store it to query status later.
   */
  originatorConversationId?: string;
  /** Payment type (`CommandID`). */
  commandId: B2CCommand;
  /** Whole shillings, 10 to 250 000 (`Amount`). */
  amount: number;
  /** The B2C shortcode paying out (`PartyA`). */
  shortCode: number;
  /** The customer's number (`PartyB`). */
  phoneNumber: string;
  /** 2 to 100 characters (`Remarks`). */
  remarks: string;
  /** Receives the payment result (`ResultURL`). */
  resultUrl: string;
  /** Receives a notice if the request times out in the queue (`QueueTimeOutURL`). */
  queueTimeoutUrl: string;
  /** 1 to 100 characters (`Occassion`, Daraja's spelling). */
  occasion?: string;
}

/**
 * Input for `b2c.payToPochi`: the same as `b2c.pay` without `commandId`. `phoneNumber` is the
 * customer whose Pochi la Biashara (business wallet) is credited.
 */
export type B2CPochiInput = Omit<B2CInput, 'commandId'>;

/**
 * Business to Customer (B2C) payments.
 *
 * Methods throw `ValidationError` before sending when the input or client config is invalid,
 * and `DarajaApiError`, `AuthError` or `NetworkError` when the request fails. Errors from the
 * request carry `originatorConversationId`.
 */
export interface B2CApi {
  /**
   * Sends money from a B2C shortcode to a customer. The acknowledgement only confirms receipt;
   * the outcome arrives at `resultUrl` (see `parseResult`). B2C payments cannot be reversed
   * through the API.
   */
  pay(input: B2CInput): Promise<InitiatorResponse>;
  /**
   * Pays a customer's Pochi la Biashara business wallet from a B2C shortcode (Business To
   * Pochi). Same rules and result as `pay`; the outcome arrives at `resultUrl`.
   */
  payToPochi(input: B2CPochiInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/b2c/v3/paymentrequest';
const POCHI_PATH = '/mpesa/b2pochi/v1/paymentrequest';
const COMMANDS: readonly B2CCommand[] = ['SalaryPayment', 'BusinessPayment', 'PromotionPayment'];

/** One B2C-shaped request: B2C itself or Business To Pochi. */
interface B2CSend {
  api: string;
  path: string;
  commandId: string;
  input: B2CPochiInput;
  /** Runs first inside `fields`, so its issues keep their place in the error. */
  check?: (issues: Issues) => void;
}

/** Validates and sends a B2C-shaped request with a generated or given conversation ID. */
function send(ctx: Context, call: B2CSend): Promise<InitiatorResponse> {
  const { input } = call;
  return initiatorRequest(ctx, {
    api: call.api,
    path: call.path,
    resultUrl: input.resultUrl,
    queueTimeoutUrl: input.queueTimeoutUrl,
    initiatorField: 'InitiatorName',
    // An empty ID is reported by the check below; anything else is sent as given.
    originatorConversationId: input.originatorConversationId || crypto.randomUUID(),
    fields: (issues) => {
      call.check?.(issues);
      checkInt(issues, 'amount', input.amount, { min: 10, max: 250_000 });
      checkShortCode(issues, 'shortCode', input.shortCode);
      const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
      checkLength(issues, 'remarks', input.remarks, { min: 2, max: 100, required: true });
      checkLength(issues, 'occasion', input.occasion, { min: 1, max: 100 });
      if (input.originatorConversationId !== undefined) {
        checkLength(issues, 'originatorConversationId', input.originatorConversationId, {
          min: 1,
          max: 100,
          required: true,
        });
      }
      return {
        CommandID: call.commandId,
        Amount: input.amount,
        PartyA: input.shortCode,
        PartyB: phone,
        Remarks: input.remarks,
        ...(input.occasion ? { Occassion: input.occasion } : {}),
      };
    },
  });
}

function pay(ctx: Context, input: B2CInput): Promise<InitiatorResponse> {
  return send(ctx, {
    api: 'b2c.pay',
    path: PATH,
    commandId: input.commandId,
    input,
    check: (issues) => {
      if (!COMMANDS.includes(input.commandId)) {
        issues.add('commandId', "must be 'SalaryPayment', 'BusinessPayment' or 'PromotionPayment'");
      }
    },
  });
}

function payToPochi(ctx: Context, input: B2CPochiInput): Promise<InitiatorResponse> {
  return send(ctx, {
    api: 'b2c.payToPochi',
    path: POCHI_PATH,
    commandId: 'BusinessPayToPochi',
    input,
  });
}

/** Business to Customer (B2C) payments. */
export function b2c(ctx: Context): B2CApi {
  return {
    pay: (input) => pay(ctx, input),
    payToPochi: (input) => payToPochi(ctx, input),
  };
}
