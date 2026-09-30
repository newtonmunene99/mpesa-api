import type { Context } from '../client';
import { checkInt, checkLength, checkPhone, checkShortCode } from '../core/validate';
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
}

const PATH = '/mpesa/b2c/v3/paymentrequest';
const COMMANDS: readonly B2CCommand[] = ['SalaryPayment', 'BusinessPayment', 'PromotionPayment'];

function pay(ctx: Context, input: B2CInput): Promise<InitiatorResponse> {
  return initiatorRequest(ctx, {
    api: 'b2c.pay',
    path: PATH,
    resultUrl: input.resultUrl,
    queueTimeoutUrl: input.queueTimeoutUrl,
    initiatorField: 'InitiatorName',
    // An empty ID is reported by the check below; anything else is sent as given.
    originatorConversationId: input.originatorConversationId || crypto.randomUUID(),
    fields: (issues) => {
      if (!COMMANDS.includes(input.commandId)) {
        issues.add('commandId', "must be 'SalaryPayment', 'BusinessPayment' or 'PromotionPayment'");
      }
      checkInt(issues, 'amount', input.amount, 10, 250_000);
      checkShortCode(issues, 'shortCode', input.shortCode);
      const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
      checkLength(issues, 'remarks', input.remarks, 2, 100, true);
      checkLength(issues, 'occasion', input.occasion, 1, 100);
      if (input.originatorConversationId !== undefined) {
        checkLength(
          issues,
          'originatorConversationId',
          input.originatorConversationId,
          1,
          100,
          true,
        );
      }
      return {
        CommandID: input.commandId,
        Amount: input.amount,
        PartyA: input.shortCode,
        PartyB: phone,
        Remarks: input.remarks,
        ...(input.occasion ? { Occassion: input.occasion } : {}),
      };
    },
  });
}

/** Business to Customer (B2C) payments. */
export function b2c(ctx: Context): B2CApi {
  return {
    pay: (input) => pay(ctx, input),
  };
}
