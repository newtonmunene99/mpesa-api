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

export interface AccountBalanceInput {
  /** The shortcode whose balance to query (`PartyA`). */
  partyA: number | string;
  /** Defaults to `shortcode` (`IdentifierType` 4). */
  identifierType?: IdentifierType;
  /** Receives the balances (`ResultURL`); parse them with `parseResult` and `parseBalances`. */
  resultUrl: string;
  /** Receives a notice if the request times out in the queue (`QueueTimeOutURL`). */
  queueTimeoutUrl: string;
  /** Up to 100 characters; defaults to "Account balance" (`Remarks`). */
  remarks?: string;
}

export interface AccountBalanceApi {
  /** Requests a shortcode's account balances; they arrive at `resultUrl`. */
  query(input: AccountBalanceInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/accountbalance/v1/query';

async function query(ctx: Context, input: AccountBalanceInput): Promise<InitiatorResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  checkIdentifierType(issues, input.identifierType);
  const partyA = checkParty(issues, 'partyA', input.partyA, input.identifierType);
  checkUrl(issues, 'resultUrl', input.resultUrl, { production });
  checkUrl(issues, 'queueTimeoutUrl', input.queueTimeoutUrl, { production });
  checkLength(issues, 'remarks', input.remarks, 1, 100);
  issues.throwIfAny('accountBalance.query');

  const { name, credential } = await ctx.securityCredential('accountBalance.query');
  const raw = await ctx.post<Record<string, unknown>>(PATH, {
    Initiator: name,
    SecurityCredential: credential,
    CommandID: 'AccountBalance',
    PartyA: partyA,
    IdentifierType: identifierTypeCode(input.identifierType),
    Remarks: input.remarks ?? 'Account balance',
    QueueTimeOutURL: input.queueTimeoutUrl,
    ResultURL: input.resultUrl,
  });
  return mapInitiatorResponse(raw);
}

/** Account Balance queries. */
export function accountBalance(ctx: Context): AccountBalanceApi {
  return {
    query: (input) => query(ctx, input),
  };
}
