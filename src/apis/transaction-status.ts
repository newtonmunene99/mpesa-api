import type { Context } from '../client';
import { checkLength, checkUrl, Issues } from '../core/validate';
import {
  checkIdentifierType,
  checkParty,
  type IdentifierType,
  identifierTypeCode,
  type InitiatorResponse,
  mapInitiatorResponse,
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

async function query(ctx: Context, input: TransactionStatusInput): Promise<InitiatorResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  if (!input.transactionId && !input.originalConversationId) {
    issues.add('transactionId', 'or originalConversationId is required');
  }
  checkIdentifierType(issues, input.identifierType);
  const partyA = checkParty(issues, 'partyA', input.partyA, input.identifierType);
  checkUrl(issues, 'resultUrl', input.resultUrl, { production });
  checkUrl(issues, 'queueTimeoutUrl', input.queueTimeoutUrl, { production });
  checkLength(issues, 'remarks', input.remarks, 1, 100);
  checkLength(issues, 'occasion', input.occasion, 1, 100);
  issues.throwIfAny('transactionStatus.query');

  const { name, credential } = await ctx.securityCredential('transactionStatus.query');
  const raw = await ctx.post<Record<string, unknown>>(PATH, {
    Initiator: name,
    SecurityCredential: credential,
    CommandID: 'TransactionStatusQuery',
    ...(input.transactionId ? { TransactionID: input.transactionId } : {}),
    ...(input.originalConversationId
      ? { OriginalConversationID: input.originalConversationId }
      : {}),
    PartyA: partyA,
    IdentifierType: identifierTypeCode(input.identifierType),
    ResultURL: input.resultUrl,
    QueueTimeOutURL: input.queueTimeoutUrl,
    Remarks: input.remarks ?? 'Transaction status',
    ...(input.occasion === undefined ? {} : { Occasion: input.occasion }),
  });
  return mapInitiatorResponse(raw);
}

/** Transaction Status queries. */
export function transactionStatus(ctx: Context): TransactionStatusApi {
  return {
    query: (input) => query(ctx, input),
  };
}
