import type { Context } from '../client';
import { checkLength } from '../core/validate';
import { initiatorRequest } from './initiator';
import {
  checkIdentifierType,
  checkParty,
  type IdentifierType,
  identifierTypeCode,
  type InitiatorResponse,
} from './shared';

export interface TransactionStatusInput {
  /** The M-Pesa receipt number (`TransactionID`). Give this or `originalConversationId`. */
  transactionId?: string;
  /** The OriginatorConversationID of the request to check (`OriginalConversationID`). */
  originalConversationId?: string;
  /** The shortcode or phone number that received the transaction (`PartyA`). */
  partyA: number | string;
  /** What `partyA` is; defaults to `shortcode` (`IdentifierType` 4, till 2, msisdn 1). */
  identifierType?: IdentifierType;
  /** Receives the status result (`ResultURL`). */
  resultUrl: string;
  /** Receives a notice if the request times out in the queue (`QueueTimeOutURL`). */
  queueTimeoutUrl: string;
  /** Up to 100 characters; defaults to "Transaction status" (`Remarks`). */
  remarks?: string;
  /** Up to 100 characters (`Occasion`). */
  occasion?: string;
}

export interface TransactionStatusApi {
  /** Asks M-Pesa for a transaction's status; the answer arrives at `resultUrl`. */
  query(input: TransactionStatusInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/transactionstatus/v1/query';

function query(ctx: Context, input: TransactionStatusInput): Promise<InitiatorResponse> {
  return initiatorRequest(ctx, {
    api: 'transactionStatus.query',
    path: PATH,
    resultUrl: input.resultUrl,
    queueTimeoutUrl: input.queueTimeoutUrl,
    fields: (issues) => {
      if (!input.transactionId && !input.originalConversationId) {
        issues.add('transactionId', 'or originalConversationId is required');
      }
      checkIdentifierType(issues, input.identifierType);
      const partyA = checkParty(issues, 'partyA', input.partyA, input.identifierType);
      checkLength(issues, 'remarks', input.remarks, 1, 100);
      checkLength(issues, 'occasion', input.occasion, 1, 100);
      return {
        CommandID: 'TransactionStatusQuery',
        ...(input.transactionId ? { TransactionID: input.transactionId } : {}),
        ...(input.originalConversationId
          ? { OriginalConversationID: input.originalConversationId }
          : {}),
        PartyA: partyA,
        IdentifierType: identifierTypeCode(input.identifierType),
        Remarks: input.remarks || 'Transaction status',
        ...(input.occasion ? { Occasion: input.occasion } : {}),
      };
    },
  });
}

/** Transaction Status queries. */
export function transactionStatus(ctx: Context): TransactionStatusApi {
  return {
    query: (input) => query(ctx, input),
  };
}
