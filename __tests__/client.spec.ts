import { constants, privateDecrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vite-plus/test';
import { createContext, createMpesa, type MpesaConfig } from '../src/client';
import { DarajaApiError, ValidationError } from '../src/core/errors';
import { fakeFetch, type FakeResponse } from './helpers/fake-fetch';

const cert = (name: string): string =>
  readFileSync(new URL(`./fixtures/certs/${name}`, import.meta.url), 'utf8');
const privateKey = cert('test-key.pem');
const decrypt = (credential: string): string =>
  privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(credential, 'base64'),
  ).toString('utf8');

const token = (t: string): FakeResponse => ({
  status: 200,
  body: { access_token: t, expires_in: 3599 },
});

const baseConfig = (
  fetch: typeof globalThis.fetch,
  extra: Partial<MpesaConfig> = {},
): MpesaConfig => ({
  environment: 'sandbox',
  consumerKey: 'key',
  consumerSecret: 'secret',
  fetch,
  ...extra,
});

describe('createMpesa', () => {
  test('makes no network calls', () => {
    const { fetch, calls } = fakeFetch([]);
    const mpesa = createMpesa(baseConfig(fetch));
    expect(mpesa.environment).toBe('sandbox');
    expect(calls).toHaveLength(0);
  });

  test('reports every config problem at once', () => {
    const { fetch } = fakeFetch([]);
    let error: unknown;
    try {
      createMpesa({
        ...baseConfig(fetch),
        environment: 'staging' as never,
        consumerKey: '',
        initiator: { name: 'api', password: 'pw' } as never,
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([
      { path: 'environment', message: "must be 'sandbox' or 'production'" },
      { path: 'consumerKey', message: 'is required' },
      {
        path: 'initiator.certificate',
        message: 'is required when initiator.password is set',
      },
    ]);
  });

  test('rejects an unreadable certificate when created', () => {
    const { fetch } = fakeFetch([]);
    expect(() =>
      createMpesa(
        baseConfig(fetch, { initiator: { name: 'api', password: 'pw', certificate: 'nope' } }),
      ),
    ).toThrow(ValidationError);
  });
});

describe('context', () => {
  test('uses the base URL for the environment', async () => {
    for (const [environment, host] of [
      ['sandbox', 'https://sandbox.safaricom.co.ke'],
      ['production', 'https://api.safaricom.co.ke'],
    ] as const) {
      const { fetch, calls } = fakeFetch([
        token('t1'),
        { status: 200, body: { ResponseCode: '0' } },
      ]);
      const ctx = createContext(baseConfig(fetch, { environment }));

      await ctx.post('/mpesa/x', {});

      expect(calls.map((c) => c.url)).toEqual([
        `${host}/oauth/v1/generate?grant_type=client_credentials`,
        `${host}/mpesa/x`,
      ]);
    }
  });

  test('posts with the bearer token', async () => {
    const { fetch, calls } = fakeFetch([token('t1'), { status: 200, body: { ResponseCode: '0' } }]);
    const ctx = createContext(baseConfig(fetch));

    expect(await ctx.post('/mpesa/x', { a: 1 })).toEqual({ ResponseCode: '0' });
    expect(calls[1]).toMatchObject({
      method: 'POST',
      headers: { authorization: 'Bearer t1' },
      body: { a: 1 },
    });
  });

  test.each([
    [404, '404.001.03'],
    [400, '400.003.01'],
    [401, '401.002.01'],
  ])('refreshes the token and retries once after %i %s', async (status, errorCode) => {
    const { fetch, calls } = fakeFetch([
      token('t1'),
      { status, body: { errorCode, errorMessage: 'Invalid Access Token' } },
      token('t2'),
      { status: 200, body: { ResponseCode: '0' } },
    ]);
    const ctx = createContext(baseConfig(fetch));

    expect(await ctx.post('/mpesa/x', {})).toEqual({ ResponseCode: '0' });
    expect(calls.map((c) => c.headers.authorization)).toEqual([
      'Basic a2V5OnNlY3JldA==',
      'Bearer t1',
      'Basic a2V5OnNlY3JldA==',
      'Bearer t2',
    ]);
  });

  test('surfaces a second token error instead of retrying again', async () => {
    const { fetch, calls } = fakeFetch([
      token('t1'),
      { status: 404, body: { errorCode: '404.001.03' } },
      token('t2'),
      { status: 404, body: { errorCode: '404.001.03' } },
    ]);
    const ctx = createContext(baseConfig(fetch));

    await expect(ctx.post('/mpesa/x', {})).rejects.toMatchObject({ errorCode: '404.001.03' });
    expect(calls).toHaveLength(4);
  });

  test('does not retry other errors', async () => {
    const { fetch, calls } = fakeFetch([
      token('t1'),
      { status: 500, body: { errorCode: '500.003.02', errorMessage: 'Spike Arrest Violation' } },
    ]);
    const ctx = createContext(baseConfig(fetch));

    await expect(ctx.post('/mpesa/x', {})).rejects.toBeInstanceOf(DarajaApiError);
    expect(calls).toHaveLength(2);
  });

  test('computes the security credential once from the certificate', async () => {
    const { fetch } = fakeFetch([]);
    const ctx = createContext(
      baseConfig(fetch, {
        initiator: { name: 'api', password: 'Safaricom999!*!', certificate: cert('test-cert.pem') },
      }),
    );

    const a = await ctx.securityCredential('b2c.pay');
    const b = await ctx.securityCredential('b2c.pay');

    expect(a.name).toBe('api');
    expect(b.credential).toBe(a.credential);
    expect(decrypt(a.credential)).toBe('Safaricom999!*!');
  });

  test('passes a supplied security credential through', async () => {
    const { fetch } = fakeFetch([]);
    const ctx = createContext(
      baseConfig(fetch, { initiator: { name: 'api', securityCredential: 'PRECOMPUTED==' } }),
    );

    expect(await ctx.securityCredential('b2c.pay')).toEqual({
      name: 'api',
      credential: 'PRECOMPUTED==',
    });
  });

  test('requires an initiator for credential-based APIs', async () => {
    const { fetch } = fakeFetch([]);
    const ctx = createContext(baseConfig(fetch));

    await expect(ctx.securityCredential('b2c.pay')).rejects.toThrow(
      'b2c.pay: initiator is required',
    );
  });

  test('warns once when the certificate has expired and still works', async () => {
    const warnings: string[] = [];
    const { fetch } = fakeFetch([]);
    const ctx = createContext(
      baseConfig(fetch, {
        initiator: { name: 'api', password: 'pw', certificate: cert('test-expired-cert.pem') },
        onWarning: (m) => warnings.push(m),
      }),
    );

    const { credential } = await ctx.securityCredential('b2c.pay');
    await ctx.securityCredential('b2c.pay');

    expect(decrypt(credential)).toBe('pw');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2021-01-01');
  });
});

describe('security credential edge cases', () => {
  test('rejects a password too long for the certificate key', () => {
    const { fetch } = fakeFetch([]);
    expect(() =>
      createMpesa(
        baseConfig(fetch, {
          initiator: { name: 'api', password: 'x'.repeat(246), certificate: cert('test-cert.pem') },
        }),
      ),
    ).toThrow('createMpesa: initiator.password must be at most 245 bytes for this certificate');
  });

  test('retries encryption after a failure instead of caching it', async () => {
    const { fetch } = fakeFetch([]);
    const ctx = createContext(
      baseConfig(fetch, {
        initiator: { name: 'api', password: 'pw', certificate: cert('test-cert.pem') },
      }),
    );
    const random = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) array.fill(0);
        return array;
      });

    await expect(ctx.securityCredential('b2c.pay')).rejects.toThrow(/no non-zero bytes/);
    random.mockRestore();

    expect(decrypt((await ctx.securityCredential('b2c.pay')).credential)).toBe('pw');
  });
});
