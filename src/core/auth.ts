import { AuthError, DarajaApiError, MpesaError } from './errors';
import { request, type Transport } from './http';

export interface CachedToken {
  accessToken: string;
  /** Expiry as epoch milliseconds. */
  expiresAt: number;
}

/**
 * Where access tokens are cached. Daraja invalidates the previous token whenever a new one is
 * issued, so apps running several instances should share one store (Redis, KV, …).
 */
export interface TokenStore {
  get(key: string): Promise<CachedToken | undefined>;
  set(key: string, token: CachedToken): Promise<void>;
}

/** Default in-process token store. */
export class MemoryTokenStore implements TokenStore {
  readonly #tokens = new Map<string, CachedToken>();

  async get(key: string): Promise<CachedToken | undefined> {
    return this.#tokens.get(key);
  }

  async set(key: string, token: CachedToken): Promise<void> {
    this.#tokens.set(key, token);
  }
}

export interface TokenManagerOptions {
  transport: Transport;
  consumerKey: string;
  consumerSecret: string;
  environment: 'sandbox' | 'production';
  store: TokenStore;
  now?: () => number;
}

/** Tokens are refreshed when fewer than this many milliseconds remain. */
const REFRESH_MARGIN_MS = 60_000;

const TOKEN_PATH = '/oauth/v1/generate?grant_type=client_credentials';

async function storeKey(environment: string, consumerKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(consumerKey));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `mpesa:${environment}:${hex.slice(0, 16)}`;
}

export class TokenManager {
  readonly #options: TokenManagerOptions;
  readonly #now: () => number;
  #key: Promise<string> | undefined;
  #inFlight: Promise<string> | undefined;

  constructor(options: TokenManagerOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
  }

  /** Returns a cached token, fetching a new one when missing or about to expire. */
  async get(): Promise<string> {
    const key = await this.#storeKey();
    const cached = await this.#options.store.get(key);
    if (cached && cached.expiresAt - this.#now() > REFRESH_MARGIN_MS) {
      return cached.accessToken;
    }
    return this.#fetchOnce(key);
  }

  /** Fetches a new token regardless of the cache (used after Daraja rejects a token). */
  async refresh(): Promise<string> {
    return this.#fetchOnce(await this.#storeKey());
  }

  #storeKey(): Promise<string> {
    this.#key ??= storeKey(this.#options.environment, this.#options.consumerKey);
    return this.#key;
  }

  #fetchOnce(key: string): Promise<string> {
    this.#inFlight ??= this.#fetch(key).finally(() => {
      this.#inFlight = undefined;
    });
    return this.#inFlight;
  }

  async #fetch(key: string): Promise<string> {
    const { consumerKey, consumerSecret, transport, store } = this.#options;
    let body: unknown;
    try {
      body = await request(transport, {
        method: 'GET',
        path: TOKEN_PATH,
        headers: { authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
      });
    } catch (error) {
      if (error instanceof DarajaApiError) {
        const summary = [error.errorCode, error.errorMessage].filter(Boolean).join(' ');
        throw new AuthError(
          `Token request failed with status ${error.status}${summary ? `: ${summary}` : ''}`,
          error.status,
          error.errorCode,
          { cause: error },
        );
      }
      if (error instanceof MpesaError) throw error;
      throw new AuthError('Token request failed', 0, undefined, { cause: error });
    }

    const record = (typeof body === 'object' && body !== null ? body : {}) as Record<
      string,
      unknown
    >;
    const accessToken = record.access_token;
    const expiresIn = Number(record.expires_in);
    if (typeof accessToken !== 'string' || accessToken === '' || !Number.isFinite(expiresIn)) {
      throw new AuthError('Token response is missing access_token or expires_in', 200);
    }

    const token: CachedToken = { accessToken, expiresAt: this.#now() + expiresIn * 1000 };
    await store.set(key, token);
    return accessToken;
  }
}
