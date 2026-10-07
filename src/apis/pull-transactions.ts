import type { Context } from '../client';
import { isBlank, isRecord, readCents, requireValue } from '../callbacks/shared';
import { str } from '../core/coerce';
import { DarajaApiError } from '../core/errors';
import { formatEatDateTime } from '../core/time';
import { checkInt, checkPhone, checkShortCode, checkUrl, Issues } from '../core/validate';

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
  /** "1000" when registered now, "1001" when it already was (`ResponseStatus`, or `Response Status`). */
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

/** Input for `pullTransactions.query`. Daraja only returns the last 48 hours. */
export interface PullQueryInput {
  /** Your registered paybill or till number, 5 to 7 digits (`ShortCode`). */
  shortCode: number;
  /** Start of the window, sent in EAT (`StartDate`). */
  from: Date;
  /** End of the window, sent in EAT (`EndDate`). Must not be before `from`. */
  to: Date;
  /** How many transactions to skip, for paging (`OffSetValue`). Defaults to 0. */
  offset?: number;
}

/** One C2B transaction from Pull Transactions. */
export interface PullTransaction {
  /** The M-Pesa receipt number. */
  transactionId: string;
  /** When the transaction happened (`trxDate`: an ISO date, read as EAT when it has no zone). */
  date: Date;
  /** The customer's number as Daraja sends it, for example "722000000". */
  msisdn: string;
  /** The customer's name, or the sender as Daraja reports it. */
  sender: string;
  /** For example "c2b-pay-bill-debit" (`transactiontype`). */
  type: string;
  /** The account number the customer entered, when there is one (`billreference`). */
  billReference?: string;
  /** The amount, in cents ("168.00" is 16800). */
  amountCents: number;
  /** `organizationname`. */
  organizationName: string;
}

/** One page of `pullTransactions.query` results. */
export interface PullQueryResponse {
  /** The page's transactions; empty when there are none ("1001"). */
  transactions: PullTransaction[];
  /** Daraja's reference for the request (`ResponseRefID`, or `RequestID` as the sandbox sends it). */
  responseRefId: string;
  /** "1000", or "1001" when there are no transactions. */
  responseCode: string;
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
  /**
   * Returns one page of the C2B transactions to a registered shortcode between `from` and
   * `to`. Daraja only keeps the last 48 hours. Pass `offset` to fetch later pages.
   */
  query(input: PullQueryInput): Promise<PullQueryResponse>;
  /**
   * Yields every C2B transaction between `from` and `to`, calling `query` page by page (each
   * offset after the transactions so far) until a page is shorter than the first, comes back
   * empty, or holds only transactions already yielded (each transaction is yielded once). Invalid input throws
   * `ValidationError` on the first iteration, before any request. An error from any
   * page, including the HTTP 500 Daraja documents for "no transactions", rejects the iteration
   * after the earlier pages were yielded.
   */
  all(input: Omit<PullQueryInput, 'offset'>): AsyncIterable<PullTransaction>;
}

const REGISTER_PATH = '/pulltransactions/v1/register';
const REGISTERED = '1000';
const ALREADY_REGISTERED = '1001';
const QUERY_PATH = '/pulltransactions/v1/query';
const FOUND = '1000';
const NONE_FOUND = '1001';
/** An ISO 8601 date and time, such as `2020-08-05T10:13:00Z`, with an optional zone. */
const ISO_DATE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/;

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
  // The live sandbox spells its keys with spaces ("Response Status"); the portal doesn't.
  const status = str(raw.ResponseStatus ?? raw['Response Status']);
  const description = str(raw.ResponseDescription ?? raw['Response Description']);
  if (status !== REGISTERED && status !== ALREADY_REGISTERED) {
    throw new DarajaApiError({
      status: 200,
      body: raw,
      ...(status ? { errorCode: status } : {}),
      errorMessage: description,
    });
  }
  return {
    responseRefId: str(raw.ResponseRefID),
    status,
    shortCode: str(raw.ShortCode),
    description,
    alreadyRegistered: status === ALREADY_REGISTERED,
    raw,
  };
}

const isDate = (value: Date): boolean => value instanceof Date && !Number.isNaN(value.getTime());

/** Checks a query's input and returns the offset to send. */
function checkQuery(input: PullQueryInput): number {
  const issues = new Issues();
  checkShortCode(issues, 'shortCode', input.shortCode);
  if (!isDate(input.from)) issues.add('from', 'must be a valid date');
  if (!isDate(input.to)) issues.add('to', 'must be a valid date');
  else if (isDate(input.from) && input.to < input.from) issues.add('to', 'must not be before from');
  const offset = input.offset ?? 0;
  checkInt(issues, 'offset', offset, { min: 0 });
  issues.throwIfAny('pullTransactions.query');
  return offset;
}

/** Reads an ISO date, recording an issue when it isn't one. */
function readIsoDate(issues: Issues, path: string, value: unknown): Date | undefined {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
  // A date without a zone is read as EAT, Daraja's time zone, never the host's. A `+0300`
  // offset becomes `+03:00`, the form every engine's Date parses.
  const zone = match?.[2]?.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2') ?? '+03:00';
  const date = match ? new Date(`${match[1]}${zone}`) : undefined;
  if (date && isDate(date)) return date;
  issues.add(path, 'must be an ISO date');
  return undefined;
}

/** Reads one transaction, recording issues under `transactions[index]`. */
function readTransaction(
  issues: Issues,
  item: unknown,
  index: number,
): PullTransaction | undefined {
  const at = `transactions[${index}]`;
  if (!isRecord(item)) {
    issues.add(at, 'must be an object');
    return undefined;
  }
  requireValue(issues, `${at}.transactionId`, item.transactionId);
  const date = requireValue(issues, `${at}.trxDate`, item.trxDate)
    ? readIsoDate(issues, `${at}.trxDate`, item.trxDate)
    : undefined;
  const amountCents = requireValue(issues, `${at}.amount`, item.amount)
    ? readCents(issues, `${at}.amount`, item.amount)
    : undefined;
  if (date === undefined || amountCents === undefined) return undefined;
  return {
    transactionId: str(item.transactionId),
    date,
    msisdn: str(item.msisdn),
    sender: str(item.sender),
    type: str(item.transactiontype),
    ...(isBlank(item.billreference) ? {} : { billReference: str(item.billreference) }),
    amountCents,
    organizationName: str(item.organizationname),
  };
}

/**
 * Reads the nested `Response` list (or `Transaction`, as the portal shows for "1001"). A
 * string such as `"[[]]"`, or the "1001" code, means no transactions.
 */
function readTransactions(raw: Record<string, unknown>): PullTransaction[] {
  const list = raw.Response ?? raw.Transaction;
  if (str(raw.ResponseCode) === NONE_FOUND || !Array.isArray(list)) return [];
  const issues = new Issues();
  const transactions = list
    .flat()
    .map((item, index) => readTransaction(issues, item, index))
    .filter((t): t is PullTransaction => t !== undefined);
  issues.throwIfAny('pullTransactions.query');
  return transactions;
}

async function query(ctx: Context, input: PullQueryInput): Promise<PullQueryResponse> {
  const offset = checkQuery(input);
  const raw = await ctx.post<Record<string, unknown>>(
    QUERY_PATH,
    {
      ShortCode: String(input.shortCode),
      StartDate: formatEatDateTime(input.from),
      EndDate: formatEatDateTime(input.to),
      OffSetValue: String(offset),
    },
    { success: (code) => code === FOUND || code === NONE_FOUND },
  );
  return {
    transactions: readTransactions(raw),
    // The portal sample says ResponseRefID; the live sandbox sends RequestID.
    responseRefId: str(raw.ResponseRefID ?? raw.RequestID),
    responseCode: str(raw.ResponseCode),
    raw,
  };
}

async function* all(
  ctx: Context,
  input: Omit<PullQueryInput, 'offset'>,
): AsyncGenerator<PullTransaction> {
  const { shortCode, from, to } = input;
  // Guards against a page being served again (an ignored offset), which would loop forever.
  const seen = new Set<string>();
  let pageSize = 0;
  let offset = 0;
  for (;;) {
    const { transactions } = await query(ctx, { shortCode, from, to, offset });
    const fresh: PullTransaction[] = [];
    for (const t of transactions) {
      if (seen.has(t.transactionId)) continue;
      seen.add(t.transactionId);
      fresh.push(t);
    }
    if (fresh.length === 0) return;
    yield* fresh;
    // A page shorter than the first is the last one, so no request is made for an empty page.
    pageSize ||= transactions.length;
    if (transactions.length < pageSize) return;
    offset += transactions.length;
  }
}

/** Pull Transactions. */
export function pullTransactions(ctx: Context): PullTransactionsApi {
  return {
    register: (input) => register(ctx, input),
    query: (input) => query(ctx, input),
    all: (input) => all(ctx, input),
  };
}
