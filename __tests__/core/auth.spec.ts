import { describe, expect, test } from 'vite-plus/test';
import {
  type CachedToken,
  MemoryTokenStore,
  TokenManager,
  type TokenStore,
} from '../../src/core/auth';
import { AuthError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const T0 = 1_800_000_000_000;

const tokenResponse = (token: string, expiresIn: number | string = 3599): FakeResponse => ({
  status: 200,
  body: { access_token: token, expires_in: expiresIn },
});

function setup(responses: FakeResponse[], store: TokenStore = new MemoryTokenStore()) {
  let now = T0;
  const warnings: string[] = [];
  const { fetch, calls } = fakeFetch(responses);
  const manager = new TokenManager({
    transport: { baseUrl: 'https://sandbox.safaricom.co.ke', fetch, timeoutMs: 1000 },
    consumerKey: 'key',
    consumerSecret: 'secret',
    environment: 'sandbox',
    store,
    now: () => now,
    onWarning: (message) => warnings.push(message),
  });
  return {
    manager,
    calls,
    warnings,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('TokenManager', () => {
  test('fetches a token with basic auth on the first call', async () => {
    const { manager, calls } = setup([tokenResponse('t1')]);

    expect(await manager.get()).toBe('t1');
    expect(calls).toEqual([
      {
        url: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        method: 'GET',
        headers: { accept: 'application/json', authorization: 'Basic a2V5OnNlY3JldA==' },
      },
    ]);
  });

  test('reuses the cached token until 60 s before expiry', async () => {
    const { manager, calls, advance } = setup([tokenResponse('t1'), tokenResponse('t2')]);

    expect(await manager.get()).toBe('t1');
    advance((3599 - 61) * 1000);
    expect(await manager.get()).toBe('t1');
    expect(calls).toHaveLength(1);

    advance(2000); // now 59 s before expiry
    expect(await manager.get()).toBe('t2');
    expect(calls).toHaveLength(2);
  });

  test('shares one request between concurrent callers', async () => {
    const { manager, calls } = setup([tokenResponse('t1')]);

    const tokens = await Promise.all(Array.from({ length: 5 }, () => manager.get()));

    expect(tokens).toEqual(['t1', 't1', 't1', 't1', 't1']);
    expect(calls).toHaveLength(1);
  });

  test('accepts expires_in as a string or a number', async () => {
    const store = new MemoryTokenStore();
    const a = setup([tokenResponse('t1', '3599')], store);
    await a.manager.get();
    expect(await store.get('mpesa:sandbox:2c70e12b7a0646f9')).toEqual({
      accessToken: 't1',
      expiresAt: T0 + 3_599_000,
    });

    const b = setup([tokenResponse('t2', 3599)]);
    expect(await b.manager.get()).toBe('t2');
  });

  test('reads and writes a custom store under a hashed key', async () => {
    const gets: string[] = [];
    const sets: [string, CachedToken][] = [];
    const store: TokenStore = {
      get: async (key) => {
        gets.push(key);
        return undefined;
      },
      set: async (key, token) => {
        sets.push([key, token]);
      },
    };
    const { manager } = setup([tokenResponse('t1')], store);

    await manager.get();

    expect(gets).toEqual(['mpesa:sandbox:2c70e12b7a0646f9']);
    expect(sets).toEqual([
      ['mpesa:sandbox:2c70e12b7a0646f9', { accessToken: 't1', expiresAt: T0 + 3_599_000 }],
    ]);
  });

  test('uses a valid token already in the store without fetching', async () => {
    const store = new MemoryTokenStore();
    await store.set('mpesa:sandbox:2c70e12b7a0646f9', {
      accessToken: 'shared',
      expiresAt: T0 + 600_000,
    });
    const { manager, calls } = setup([], store);

    expect(await manager.get()).toBe('shared');
    expect(calls).toHaveLength(0);
  });

  test('refresh always fetches a new token', async () => {
    const { manager, calls } = setup([tokenResponse('t1'), tokenResponse('t2')]);

    await manager.get();
    expect(await manager.refresh()).toBe('t2');
    expect(await manager.get()).toBe('t2');
    expect(calls).toHaveLength(2);
  });

  test('turns a failed token request into AuthError', async () => {
    const { manager } = setup([
      {
        status: 400,
        body: { errorCode: '400.008.01', errorMessage: 'Invalid Authentication passed' },
      },
    ]);

    const error = await manager.get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ status: 400, errorCode: '400.008.01' });
    expect((error as Error).message).not.toContain('secret');
  });

  test('rejects a token response without access_token', async () => {
    const { manager } = setup([{ status: 200, body: { expires_in: 3599 } }]);

    await expect(manager.get()).rejects.toBeInstanceOf(AuthError);
  });

  test('a failed token fetch leaves the manager usable', async () => {
    const { manager, calls } = setup([
      { status: 400, body: { errorCode: '400.008.01' } },
      tokenResponse('t1'),
    ]);

    await expect(manager.get()).rejects.toBeInstanceOf(AuthError);
    expect(await manager.get()).toBe('t1');
    expect(calls).toHaveLength(2);
  });

  test('get and refresh started together share one request', async () => {
    const { manager, calls } = setup([tokenResponse('t1')]);

    const [a, b] = await Promise.all([manager.get(), manager.refresh()]);

    expect([a, b]).toEqual(['t1', 't1']);
    expect(calls).toHaveLength(1);
  });

  test('refresh with the rejected token reuses a newer stored token', async () => {
    const { manager, calls } = setup([tokenResponse('t1'), tokenResponse('t2')]);

    await manager.get();
    expect(await manager.refresh('t1')).toBe('t2');
    expect(await manager.refresh('t1')).toBe('t2');
    expect(calls).toHaveLength(2);
  });

  test.each([
    ['an empty token', { accessToken: '', expiresAt: T0 + 600_000 }],
    ['a missing token', { expiresAt: T0 + 600_000 }],
    ['a non-numeric expiry', { accessToken: 'stale', expiresAt: 'soon' }],
  ])('ignores a cached entry with %s', async (_, entry) => {
    const store: TokenStore = {
      get: async () => entry as unknown as CachedToken,
      set: async () => {},
    };
    const { manager, calls } = setup([tokenResponse('fresh')], store);

    expect(await manager.get()).toBe('fresh');
    expect(calls).toHaveLength(1);
  });

  test('treats a failing store read as a cache miss', async () => {
    const store: TokenStore = {
      get: async () => {
        throw new Error('redis down');
      },
      set: async () => {},
    };
    const { manager } = setup([tokenResponse('t1')], store);

    expect(await manager.get()).toBe('t1');
  });

  test('still returns the new token when the store write fails, and warns', async () => {
    const store: TokenStore = {
      get: async () => undefined,
      set: async () => {
        throw new Error('redis down');
      },
    };
    const { manager, warnings } = setup([tokenResponse('t1')], store);

    expect(await manager.get()).toBe('t1');
    expect(warnings).toEqual([
      'Could not save the M-Pesa access token to the token store: redis down',
    ]);
  });

  test.each([0, -1, ''])('rejects a token response with expires_in %j', async (expiresIn) => {
    const { manager } = setup([tokenResponse('t1', expiresIn)]);

    await expect(manager.get()).rejects.toBeInstanceOf(AuthError);
  });
});
