import type { Context } from '../client';
import { checkInt, checkLength } from '../core/validate';
import { initiatorRequest } from './initiator';
import { checkParty, type InitiatorResponse } from './shared';

/** Input for `reversal.request`. */
export interface ReversalInput {
  /** The M-Pesa receipt number of the C2B transaction to reverse (`TransactionID`). */
  transactionId: string;
  /** The amount to reverse, in whole shillings (`Amount`). */
  amount: number;
  /** Your organisation's shortcode (`ReceiverParty`). */
  receiverParty: number;
  /** 2 to 100 characters (`Remarks`). */
  remarks: string;
  /** Receives the reversal result (`ResultURL`). */
  resultUrl: string;
  /** Receives a notice if the request times out in the queue (`QueueTimeOutURL`). */
  queueTimeoutUrl: string;
}

/**
 * Transaction reversals.
 *
 * Methods throw `ValidationError` before sending when the input or client config is invalid,
 * and `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface ReversalApi {
  /**
   * Reverses a C2B transaction; the result arrives at `resultUrl`. B2C payments cannot be
   * reversed through the API.
   */
  request(input: ReversalInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/reversal/v1/request';

function request(ctx: Context, input: ReversalInput): Promise<InitiatorResponse> {
  return initiatorRequest(ctx, {
    api: 'reversal.request',
    path: PATH,
    resultUrl: input.resultUrl,
    queueTimeoutUrl: input.queueTimeoutUrl,
    fields: (issues) => {
      checkLength(issues, 'transactionId', input.transactionId, {
        min: 1,
        max: 20,
        required: true,
      });
      checkInt(issues, 'amount', input.amount, { min: 1 });
      checkParty(issues, 'receiverParty', input.receiverParty, 'shortcode');
      checkLength(issues, 'remarks', input.remarks, { min: 2, max: 100, required: true });
      return {
        CommandID: 'TransactionReversal',
        TransactionID: input.transactionId,
        Amount: input.amount,
        ReceiverParty: input.receiverParty,
        // Daraja's spelling; the docs fix the value at "11".
        RecieverIdentifierType: '11',
        Remarks: input.remarks,
      };
    },
  });
}

/** Transaction reversals. */
export function reversal(ctx: Context): ReversalApi {
  return {
    request: (input) => request(ctx, input),
  };
}
