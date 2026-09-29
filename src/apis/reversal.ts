import type { Context } from '../client';
import { checkInt, checkLength, checkUrl, Issues } from '../core/validate';
import { checkParty, type InitiatorResponse, mapInitiatorResponse } from './shared';

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

export interface ReversalApi {
  /**
   * Reverses a C2B transaction; the result arrives at `resultUrl`. B2C payments cannot be
   * reversed through the API.
   */
  request(input: ReversalInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/reversal/v1/request';

async function request(ctx: Context, input: ReversalInput): Promise<InitiatorResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  checkLength(issues, 'transactionId', input.transactionId, 1, 20, true);
  checkInt(issues, 'amount', input.amount, 1);
  checkParty(issues, 'receiverParty', input.receiverParty, 'shortcode');
  checkUrl(issues, 'resultUrl', input.resultUrl, { production });
  checkUrl(issues, 'queueTimeoutUrl', input.queueTimeoutUrl, { production });
  checkLength(issues, 'remarks', input.remarks, 2, 100, true);
  issues.throwIfAny('reversal.request');

  const { name, credential } = await ctx.securityCredential('reversal.request');
  const raw = await ctx.post<Record<string, unknown>>(PATH, {
    Initiator: name,
    SecurityCredential: credential,
    CommandID: 'TransactionReversal',
    TransactionID: input.transactionId,
    Amount: input.amount,
    ReceiverParty: input.receiverParty,
    // Daraja's spelling; the docs fix the value at "11".
    RecieverIdentifierType: '11',
    ResultURL: input.resultUrl,
    QueueTimeOutURL: input.queueTimeoutUrl,
    Remarks: input.remarks,
  });
  return mapInitiatorResponse(raw);
}

/** Transaction reversals. */
export function reversal(ctx: Context): ReversalApi {
  return {
    request: (input) => request(ctx, input),
  };
}
