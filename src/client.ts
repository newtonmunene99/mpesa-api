import { b2c, type B2CApi } from './apis/b2c';
import { c2b, type C2BApi } from './apis/c2b';
import { stkPush, type StkPushApi } from './apis/stk-push';
import { MemoryTokenStore, TokenManager, type TokenStore } from './core/auth';
import { parseCertificate, type RsaPublicKey } from './core/certificate';
import { encryptPkcs1v15 } from './core/credential';
import { DarajaApiError, ValidationError } from './core/errors';
import { request, type Transport } from './core/http';
import { Issues } from './core/validate';

export type Environment = 'sandbox' | 'production';

/**
 * The API operator ("initiator") used by B2C, Transaction Status, Account Balance and
 * Reversal. Pass either the password plus the Safaricom certificate for the environment
 * (downloaded from the Daraja portal), or a security credential you generated yourself.
 */
export type Initiator =
  | { name: string; password: string; certificate: string | Uint8Array }
  | { name: string; securityCredential: string };

export interface MpesaConfig {
  environment: Environment;
  consumerKey: string;
  consumerSecret: string;
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

/** Shared state the API modules use to talk to Daraja. */
export interface Context {
  readonly environment: Environment;
  readonly config: MpesaConfig;
  /** POSTs with a bearer token, retrying once with a fresh token if Daraja rejects it. */
  post<T>(path: string, body: unknown): Promise<T>;
  /** The initiator name and security credential, computed once. */
  securityCredential(api: string): Promise<{ name: string; credential: string }>;
  /** The current time; injectable for tests. */
  now(): Date;
}

export interface Mpesa {
  readonly environment: Environment;
  /** M-Pesa Express (STK push). */
  readonly stkPush: StkPushApi;
  /** Customer to Business (C2B) payment notifications. */
  readonly c2b: C2BApi;
  /** Business to Customer (B2C) payments. */
  readonly b2c: B2CApi;
}

const BASE_URLS: Record<Environment, string> = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

const TOKEN_ERROR_CODES = new Set(['404.001.03', '400.003.01', '401.002.01']);

const isTokenError = (error: unknown): boolean =>
  error instanceof DarajaApiError &&
  (error.status === 401 || TOKEN_ERROR_CODES.has(error.errorCode ?? ''));

function validateConfig(config: MpesaConfig): RsaPublicKey | undefined {
  const issues = new Issues();
  if (config.environment !== 'sandbox' && config.environment !== 'production') {
    issues.add('environment', "must be 'sandbox' or 'production'");
  }
  if (!config.consumerKey) issues.add('consumerKey', 'is required');
  if (!config.consumerSecret) issues.add('consumerSecret', 'is required');

  const initiator = config.initiator as Record<string, unknown> | undefined;
  let key: RsaPublicKey | undefined;
  if (initiator !== undefined) {
    if (!initiator.name) issues.add('initiator.name', 'is required');
    if ('securityCredential' in initiator) {
      if (!initiator.securityCredential) issues.add('initiator.securityCredential', 'is required');
    } else if (!initiator.password) {
      issues.add('initiator', 'needs either password and certificate, or securityCredential');
    } else if (!initiator.certificate) {
      issues.add('initiator.certificate', 'is required when initiator.password is set');
    }
  }
  issues.throwIfAny('createMpesa');

  if (initiator && 'password' in initiator && initiator.certificate) {
    try {
      key = parseCertificate(initiator.certificate as string | Uint8Array);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError('createMpesa', error.issues);
      }
      throw error;
    }
  }
  return key;
}

/** Builds the shared context. Internal: exported for tests and the API modules. */
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

  const send = <T>(path: string, body: unknown, token: string): Promise<T> =>
    request<T>(transport, {
      method: 'POST',
      path,
      headers: { authorization: `Bearer ${token}` },
      body,
    });

  return {
    environment: config.environment,
    config,
    now: clock,

    async post<T>(path: string, body: unknown): Promise<T> {
      const token = await tokens.get();
      try {
        return await send<T>(path, body, token);
      } catch (error) {
        if (!isTokenError(error)) throw error;
        return send<T>(path, body, await tokens.refresh(token));
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
      })();
      return credential;
    },
  };
}

/** Creates a Daraja client. No network calls are made until an API is called. */
export function createMpesa(config: MpesaConfig): Mpesa {
  const ctx = createContext(config);
  return {
    environment: ctx.environment,
    stkPush: stkPush(ctx),
    c2b: c2b(ctx),
    b2c: b2c(ctx),
  };
}
