import { AuthError, DarajaApiError, MpesaError } from './errors';
import { request, type Transport } from './http';

/** A Daraja access token as kept in a `TokenStore`. */
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
  /**
   * Returns the token saved under `key`, or `undefined`. A rejection, or a value that isn't a
   * `CachedToken`, is treated as a miss and a new token is fetched.
   */
  get(key: string): Promise<CachedToken | undefined>;
  /**
   * Saves a newly fetched token. It can expire the entry at `token.expiresAt`. A rejection is
   * reported through `onWarning`, and the token is still used.
   */
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

/** What a `TokenManager` needs; `createContext` builds these from `MpesaConfig`. */
export interface TokenManagerOptions {
  transport: Transport;
  consumerKey: string;
  consumerSecret: string;
  /** Part of the store key, so sandbox and production tokens never mix. */
  environment: 'sandbox' | 'production';
  store: TokenStore;
  /** The current time in epoch milliseconds. Defaults to `Date.now`; tests inject a clock. */
  now?: () => number;
  /** Receives non-fatal problems, such as a token store that fails to save. */
  onWarning?: (message: string) => void;
}

/** Tokens are refreshed when fewer than this many milliseconds remain. */
const REFRESH_MARGIN_MS = 60_000;

const TOKEN_PATH = '/oauth/v1/generate?grant_type=client_credentials';

/**
 * The store key for a consumer key: `mpesa:<environment>:<first 16 hex digits of SHA-256>`.
 * Hashing keeps the consumer key out of the store, while clients sharing a key share a token.
 */
async function storeKey(environment: string, consumerKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(consumerKey));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `mpesa:${environment}:${hex.slice(0, 16)}`;
}

/**
 * Hands out Daraja access tokens for one consumer key. Concurrent callers share a single
 * token request, and tokens are reused from the store until less than a minute remains.
 */
export class TokenManager {
  readonly #options: TokenManagerOptions;
  readonly #now: () => number;
  /** The store key, computed once. Reset if hashing fails, so the next call retries. */
  #key: Promise<string> | undefined;
  /** The token request in progress, shared by every caller until it settles. */
  #inFlight: Promise<string> | undefined;
  /** The last token this manager fetched, used when the store holds an older one. */
  #last: CachedToken | undefined;

  constructor(options: TokenManagerOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
  }

  /** Returns a cached token, fetching a new one when missing or about to expire. */
  async get(): Promise<string> {
    const key = await this.#storeKey();
    const cached = await this.#readUsable(key);
    return cached ?? this.#fetchOnce(key);
  }

  /**
   * Replaces a token Daraja rejected. When another caller has already stored a newer valid
   * token, that token is returned instead of fetching again, because every new token
   * invalidates the one before it.
   */
  async refresh(rejected?: string): Promise<string> {
    const key = await this.#storeKey();
    if (this.#inFlight) return this.#inFlight;
    const cached = await this.#readUsable(key);
    if (cached !== undefined && rejected !== undefined && cached !== rejected) return cached;
    return this.#fetchOnce(key);
  }

  /** Returns the newest known token if it has more than `REFRESH_MARGIN_MS` left. */
  async #readUsable(key: string): Promise<string | undefined> {
    const stored = await this.#readStored(key);
    // Prefer whichever token was issued last: if saving to the store failed, the stored one
    // has already been invalidated by Daraja.
    const newest =
      this.#last && (!stored || this.#last.expiresAt > stored.expiresAt) ? this.#last : stored;
    if (!newest) return undefined;
    return newest.expiresAt - this.#now() > REFRESH_MARGIN_MS ? newest.accessToken : undefined;
  }

  /**
   * Reads the store defensively: it may be the user's own implementation over Redis or KV,
   * so a rejection or a malformed value counts as a miss rather than an error.
   */
  async #readStored(key: string): Promise<CachedToken | undefined> {
    let cached: unknown;
    try {
      cached = await this.#options.store.get(key);
    } catch {
      return undefined;
    }
    if (typeof cached !== 'object' || cached === null) return undefined;
    const { accessToken, expiresAt } = cached as Partial<Record<keyof CachedToken, unknown>>;
    if (typeof accessToken !== 'string' || accessToken === '') return undefined;
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return undefined;
    return { accessToken, expiresAt };
  }

  #storeKey(): Promise<string> {
    this.#key ??= storeKey(this.#options.environment, this.#options.consumerKey).catch(
      (error: unknown) => {
        this.#key = undefined;
        throw error;
      },
    );
    return this.#key;
  }

  /**
   * Starts a token request, or joins the one in progress. Two concurrent requests would each
   * get a token and invalidate the other's.
   */
  #fetchOnce(key: string): Promise<string> {
    this.#inFlight ??= this.#fetch(key).finally(() => {
      this.#inFlight = undefined;
    });
    return this.#inFlight;
  }

  /**
   * Requests a token and saves it. A rejected request becomes `AuthError`; network failures
   * and timeouts stay `NetworkError`. `expires_in` is accepted as a number or a numeric string.
   */
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
    if (
      typeof accessToken !== 'string' ||
      accessToken === '' ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      throw new AuthError('Token response is missing access_token or expires_in', 200);
    }

    const token: CachedToken = { accessToken, expiresAt: this.#now() + expiresIn * 1000 };
    this.#last = token;
    try {
      await store.set(key, token);
    } catch (error) {
      // The new token is valid (and the previous one is now invalid), so still use it.
      this.#warn(
        `Could not save the M-Pesa access token to the token store: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return accessToken;
  }

  /** Calls `onWarning`, ignoring anything it throws. */
  #warn(message: string): void {
    try {
      this.#options.onWarning?.(message);
    } catch {
      // A failing warning hook must not break token handling.
    }
  }
}
