import type { Context } from '../client';
import { str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { checkPhone, checkShortCode, checkUrl, Issues } from '../core/validate';

/** Input for `pullTransactions.register`. */
export interface PullRegisterInput {
  /** Your paybill or till number, 5 to 7 digits (`ShortCode`). */
  shortCode: number;
  /**
   * The Safaricom number on the shortcode's KYC records, as `07…`, `01…`, `+254…` or `254…`;
   * sent as `254…` (`NominatedNumber`).
   */
  nominatedNumber: string;
  /** Where Daraja may push transactions (`CallBackURL`). */
  callbackUrl: string;
}

/** Daraja's answer to `pullTransactions.register`. */
export interface PullRegisterResponse {
  /** Daraja's reference for the request (`ResponseRefID`). */
  responseRefId: string;
  /** "1000" when registered now, "1001" when it already was (`ResponseStatus`). */
  status: string;
  /** The registered shortcode, as Daraja echoes it. */
  shortCode: string;
  /** `ResponseDescription`. */
  description: string;
  /** True when the shortcode was already registered ("1001"). */
  alreadyRegistered: boolean;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * Pull Transactions: list the C2B payments to your paybill or till from the last 48 hours,
 * including any whose notifications you missed. Register the shortcode once, then query.
 * No initiator is needed.
 *
 * Methods throw `ValidationError` before sending when the input is invalid, and
 * `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface PullTransactionsApi {
  /**
   * Registers a shortcode for Pull Transactions, a one-time step. The shortcode must be live in
   * production. Registering it again is not an error: `alreadyRegistered` is true.
   */
  register(input: PullRegisterInput): Promise<PullRegisterResponse>;
}

const REGISTER_PATH = '/pulltransactions/v1/register';
const REGISTERED = '1000';
const ALREADY_REGISTERED = '1001';

async function register(ctx: Context, input: PullRegisterInput): Promise<PullRegisterResponse> {
  const issues = new Issues();
  checkShortCode(issues, 'shortCode', input.shortCode);
  const nominatedNumber = checkPhone(issues, 'nominatedNumber', input.nominatedNumber);
  checkUrl(issues, 'callbackUrl', input.callbackUrl, {
    production: ctx.environment === 'production',
  });
  issues.throwIfAny('pullTransactions.register');

  const raw = await ctx.post<Record<string, unknown>>(REGISTER_PATH, {
    ShortCode: String(input.shortCode),
    RequestType: 'Pull',
    NominatedNumber: nominatedNumber,
    CallBackURL: input.callbackUrl,
  });
  // Registration answers with ResponseStatus rather than ResponseCode, so it is checked here.
  const status = str(raw.ResponseStatus);
  if (status !== REGISTERED && status !== ALREADY_REGISTERED) {
    throw new DarajaApiError({
      status: 200,
      body: raw,
      ...(status ? { errorCode: status } : {}),
      errorMessage: str(raw.ResponseDescription),
    });
  }
  return {
    responseRefId: str(raw.ResponseRefID),
    status,
    shortCode: str(raw.ShortCode),
    description: str(raw.ResponseDescription),
    alreadyRegistered: status === ALREADY_REGISTERED,
    raw,
  };
}

/** Pull Transactions. */
export function pullTransactions(ctx: Context): PullTransactionsApi {
  return {
    register: (input) => register(ctx, input),
  };
}
