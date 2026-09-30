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

/** Input for `accountBalance.query`. */
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

/**
 * Account Balance queries.
 *
 * Methods throw `ValidationError` before sending when the input or client config is invalid,
 * and `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface AccountBalanceApi {
  /** Requests a shortcode's account balances; they arrive at `resultUrl`. */
  query(input: AccountBalanceInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/accountbalance/v1/query';

function query(ctx: Context, input: AccountBalanceInput): Promise<InitiatorResponse> {
  return initiatorRequest(ctx, {
    api: 'accountBalance.query',
    path: PATH,
    resultUrl: input.resultUrl,
    queueTimeoutUrl: input.queueTimeoutUrl,
    fields: (issues) => {
      checkIdentifierType(issues, input.identifierType);
      const partyA = checkParty(issues, 'partyA', input.partyA, input.identifierType);
      checkLength(issues, 'remarks', input.remarks, 1, 100);
      return {
        CommandID: 'AccountBalance',
        PartyA: partyA,
        IdentifierType: identifierTypeCode(input.identifierType),
        Remarks: input.remarks || 'Account balance',
      };
    },
  });
}

/** Account Balance queries. */
export function accountBalance(ctx: Context): AccountBalanceApi {
  return {
    query: (input) => query(ctx, input),
  };
}
