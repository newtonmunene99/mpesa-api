import { accountBalance, type AccountBalanceApi } from './apis/account-balance';
import { b2b, type B2BApi } from './apis/b2b';
import { bonga, type BongaApi } from './apis/bonga';
import { b2c, type B2CApi } from './apis/b2c';
import { billManager, type BillManagerApi } from './apis/bill-manager';
import { c2b, type C2BApi } from './apis/c2b';
import { pullTransactions, type PullTransactionsApi } from './apis/pull-transactions';
import { qr, type QrApi } from './apis/qr';
import { ratiba, type RatibaApi } from './apis/ratiba';
import { reversal, type ReversalApi } from './apis/reversal';
import { stkPush, type StkPushApi } from './apis/stk-push';
import { transactionStatus, type TransactionStatusApi } from './apis/transaction-status';
import { MemoryTokenStore, TokenManager, type TokenStore } from './core/auth';
import { parseCertificate, type RsaPublicKey } from './core/certificate';
import { encryptPkcs1v15, maxPlaintextBytes } from './core/credential';
import { DarajaApiError, ValidationError } from './core/errors';
import { request, type Transport } from './core/http';
import { Issues } from './core/validate';

/** Which Daraja deployment to call: `sandbox.safaricom.co.ke` or `api.safaricom.co.ke`. */
export type Environment = 'sandbox' | 'production';

/**
 * The API operator ("initiator") used by B2C, B2B (except Express CheckOut), Business To Pochi,
 * Transaction Status, Account Balance and Reversal. Pass either the password plus Safaricom's
 * certificate for the environment (PEM text or DER bytes), or a security credential generated
 * on the Daraja portal's Test Credentials page.
 */
export type Initiator =
  | { name: string; password: string; certificate: string | Uint8Array }
  | { name: string; securityCredential: string };

/** Configuration for `createMpesa`. Validated when the client is created. */
export interface MpesaConfig {
  environment: Environment;
  /** From your app on the Daraja portal. */
  consumerKey: string;
  /** From your app on the Daraja portal. */
  consumerSecret: string;
  /**
   * Required for B2C, B2B (except Express CheckOut), Business To Pochi, Transaction Status,
   * Account Balance and Reversal.
   */
  initiator?: Initiator;
  /** Lipa na M-Pesa Online passkey. Required for STK push. */
  passkey?: string;
  /** Where access tokens are cached. Defaults to an in-memory store. */
  tokenStore?: TokenStore;
  /** Per-request timeout in milliseconds. Defaults to 30 000. */
  timeoutMs?: number;
  /** The fetch implementation. Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Receives non-fatal warnings, such as an expired certificate. */
  onWarning?: (message: string) => void;
}

/** Per-call options for `Context.post`. */
export interface PostOptions {
  /** Whether a 2xx body's `ResponseCode` means success. Defaults to all zeros. */
  success?: (responseCode: string) => boolean;
  /** Extra request headers, such as an API's own key. They can't replace the bearer token. */
  headers?: Record<string, string>;
}

/** The caller's headers without any `authorization`, which only the token may set. */
const extraHeaders = (headers: Record<string, string> = {}): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'authorization'),
  );

/** Shared state the API modules use to talk to Daraja. */
export interface Context {
  readonly environment: Environment;
  readonly config: MpesaConfig;
  /**
   * POSTs with a bearer token, retrying once with a fresh token if Daraja rejects it.
   * `options.success` overrides which `ResponseCode` values count as success (all zeros by
   * default), for APIs that answer with other codes.
   */
  post<T>(path: string, body: unknown, options?: PostOptions): Promise<T>;
  /**
   * The initiator name and security credential, computed once. `api` names the calling
   * method for the `ValidationError` thrown when no initiator is configured.
   */
  securityCredential(api: string): Promise<{ name: string; credential: string }>;
  /** The current time; injectable for tests. */
  now(): Date;
}

/** A Daraja client from `createMpesa`, with one namespace per API. */
export interface Mpesa {
  readonly environment: Environment;
  /** M-Pesa Express (STK push). */
  readonly stkPush: StkPushApi;
  /** Customer to Business (C2B) payment notifications. */
  readonly c2b: C2BApi;
  /** Business to Customer (B2C) payments, including Business To Pochi. */
  readonly b2c: B2CApi;
  /** Business to Business (B2B) payments: pay bill, buy goods, B2C top up, tax, Express CheckOut. */
  readonly b2b: B2BApi;
  /** Dynamic QR codes customers scan to pay. */
  readonly qr: QrApi;
  /** Pull Transactions: the last 48 hours of C2B payments to a shortcode. */
  readonly pullTransactions: PullTransactionsApi;
  /** M-Pesa Ratiba standing orders. */
  readonly ratiba: RatibaApi;
  /** Lipa na Bonga: payments with Bonga points. */
  readonly bonga: BongaApi;
  /** Bill Manager: e-invoicing for a paybill. */
  readonly billManager: BillManagerApi;
  /** Transaction Status queries. */
  readonly transactionStatus: TransactionStatusApi;
  /** Account Balance queries. */
  readonly accountBalance: AccountBalanceApi;
  /** Transaction reversals. */
  readonly reversal: ReversalApi;
}

const BASE_URLS: Record<Environment, string> = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

/**
 * Error codes Daraja uses for an invalid or expired token, usually without a 401 status.
 * `post` refreshes the token and retries once when it sees one.
 */
const TOKEN_ERROR_CODES = new Set(['404.001.03', '400.003.01', '401.002.01']);

/** True for a rejected token: HTTP 401 or one of `TOKEN_ERROR_CODES`. */
const isTokenError = (error: unknown): boolean =>
  error instanceof DarajaApiError &&
  (error.status === 401 || TOKEN_ERROR_CODES.has(error.errorCode ?? ''));

/**
 * Checks the config and parses the initiator certificate up front, so a bad key or
 * certificate fails at `createMpesa` rather than on the first payment. Returns the parsed
 * key, if there is one. Throws `ValidationError` listing every problem.
 */
function validateConfig(config: MpesaConfig): RsaPublicKey | undefined {
  const issues = new Issues();
  if (config.environment !== 'sandbox' && config.environment !== 'production') {
    issues.add('environment', "must be 'sandbox' or 'production'");
  }
  if (!config.consumerKey) issues.add('consumerKey', 'is required');
  if (!config.consumerSecret) issues.add('consumerSecret', 'is required');
  const initiator = config.initiator as Record<string, unknown> | undefined;
  if (initiator !== undefined) checkInitiator(issues, initiator);
  issues.throwIfAny('createMpesa');

  if (initiator && 'password' in initiator && initiator.certificate) {
    return loadInitiatorKey(
      initiator.certificate as string | Uint8Array,
      String(initiator.password),
    );
  }
  return undefined;
}

/** Reports a missing name, and an initiator with neither a password and certificate nor a credential. */
function checkInitiator(issues: Issues, initiator: Record<string, unknown>): void {
  if (!initiator.name) issues.add('initiator.name', 'is required');
  if ('securityCredential' in initiator) {
    if (!initiator.securityCredential) issues.add('initiator.securityCredential', 'is required');
  } else if (!initiator.password) {
    issues.add('initiator', 'needs either password and certificate, or securityCredential');
  } else if (!initiator.certificate) {
    issues.add('initiator.certificate', 'is required when initiator.password is set');
  }
}

/**
 * Parses the initiator's certificate and checks the password fits its key. Certificate errors
 * are rethrown with the `createMpesa` context.
 */
function loadInitiatorKey(certificate: string | Uint8Array, password: string): RsaPublicKey {
  let key: RsaPublicKey;
  try {
    key = parseCertificate(certificate);
  } catch (error) {
    if (error instanceof ValidationError) throw new ValidationError('createMpesa', error.issues);
    throw error;
  }
  const limit = maxPlaintextBytes(key);
  if (new TextEncoder().encode(password).length > limit) {
    throw new ValidationError('createMpesa', [
      {
        path: 'initiator.password',
        message: `must be at most ${limit} bytes for this certificate`,
      },
    ]);
  }
  return key;
}

/**
 * Builds the shared context behind `createMpesa`. Internal: exported so tests can drive an
 * API module with a fake `fetch` and clock. Throws `ValidationError` for an invalid config.
 */
export function createContext(config: MpesaConfig, clock: () => Date = () => new Date()): Context {
  const key = validateConfig(config);
  const transport: Transport = {
    baseUrl: BASE_URLS[config.environment],
    fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    timeoutMs: config.timeoutMs ?? 30_000,
  };
  const tokens = new TokenManager({
    transport,
    consumerKey: config.consumerKey,
    consumerSecret: config.consumerSecret,
    environment: config.environment,
    store: config.tokenStore ?? new MemoryTokenStore(),
    ...(config.onWarning ? { onWarning: config.onWarning } : {}),
  });

  let credential: Promise<{ name: string; credential: string }> | undefined;

  const send = <T>(path: string, body: unknown, token: string, options: PostOptions): Promise<T> =>
    request<T>(transport, {
      method: 'POST',
      path,
      headers: { ...extraHeaders(options.headers), authorization: `Bearer ${token}` },
      body,
      ...(options.success ? { success: options.success } : {}),
    });

  return {
    environment: config.environment,
    config,
    now: clock,

    async post<T>(path: string, body: unknown, options: PostOptions = {}): Promise<T> {
      const token = await tokens.get();
      try {
        return await send<T>(path, body, token, options);
      } catch (error) {
        if (!isTokenError(error)) throw error;
        return send<T>(path, body, await tokens.refresh(token), options);
      }
    },

    securityCredential(api: string) {
      const initiator = config.initiator;
      if (!initiator) {
        return Promise.reject(
          new ValidationError(api, [{ path: 'initiator', message: 'is required' }]),
        );
      }
      credential ??= (async () => {
        if ('securityCredential' in initiator) {
          return { name: initiator.name, credential: initiator.securityCredential };
        }
        if (key?.notAfter && key.notAfter.getTime() < clock().getTime()) {
          try {
            config.onWarning?.(
              `The initiator certificate expired on ${key.notAfter.toISOString()}; download the current certificate from the Daraja portal.`,
            );
          } catch {
            // A failing warning hook must not break the request.
          }
        }
        return { name: initiator.name, credential: encryptPkcs1v15(key!, initiator.password) };
      })().catch((error: unknown) => {
        credential = undefined;
        throw error;
      });
      return credential;
    },
  };
}

/**
 * Creates a Daraja client. No network calls are made until an API is called. Throws
 * `ValidationError` listing every problem with the config, including an unreadable
 * certificate or a password too long for its key.
 */
export function createMpesa(config: MpesaConfig): Mpesa {
  const ctx = createContext(config);
  return {
    environment: ctx.environment,
    stkPush: stkPush(ctx),
    c2b: c2b(ctx),
    b2c: b2c(ctx),
    b2b: b2b(ctx),
    qr: qr(ctx),
    pullTransactions: pullTransactions(ctx),
    ratiba: ratiba(ctx),
    bonga: bonga(ctx),
    billManager: billManager(ctx),
    transactionStatus: transactionStatus(ctx),
    accountBalance: accountBalance(ctx),
    reversal: reversal(ctx),
  };
}
