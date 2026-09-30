import { constants, privateDecrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { b2c } from '../../src/apis/b2c';
import { createContext, createMpesa, type MpesaConfig } from '../../src/client';
import { NetworkError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const read = (name: string): string =>
  readFileSync(new URL(`../fixtures/certs/${name}`, import.meta.url), 'utf8');
const decrypt = (credential: string): string =>
  privateDecrypt(
    { key: read('test-key.pem'), padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(credential, 'base64'),
  ).toString('utf8');

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
const accepted = {
  ConversationID: 'AG_20240706_20106e9209f64bebd05b',
  OriginatorConversationID: 'caller-id-1',
  ResponseCode: '0',
  ResponseDescription: 'Accept the service request successfully.',
};

function setup(responses: FakeResponse[], extra: Partial<MpesaConfig> = {}) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    initiator: { name: 'testapi', password: 'Safaricom999!*!', certificate: read('test-cert.pem') },
    fetch,
    ...extra,
  });
  return { api: b2c(ctx), calls };
}

const input = {
  commandId: 'BusinessPayment' as const,
  amount: 100,
  shortCode: 600997,
  phoneNumber: '0705912645',
  remarks: 'Salary',
  resultUrl: 'https://example.com/b2c/result',
  queueTimeoutUrl: 'https://example.com/b2c/timeout',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('b2c.pay', () => {
  test('posts the v3 payment request with every documented field', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.pay({ ...input, originatorConversationId: 'caller-id-1', occasion: 'December' });

    const call = calls[1]!;
    const body = call.body as Record<string, unknown>;
    expect(call).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
      headers: { authorization: 'Bearer tok' },
    });
    expect({ ...body, SecurityCredential: '<checked below>' }).toEqual({
      OriginatorConversationID: 'caller-id-1',
      InitiatorName: 'testapi',
      SecurityCredential: '<checked below>',
      CommandID: 'BusinessPayment',
      Amount: 100,
      PartyA: 600997,
      PartyB: '254705912645',
      Remarks: 'Salary',
      QueueTimeOutURL: 'https://example.com/b2c/timeout',
      ResultURL: 'https://example.com/b2c/result',
      Occassion: 'December',
    });
    expect(decrypt(body.SecurityCredential as string)).toBe('Safaricom999!*!');
  });

  test('generates an OriginatorConversationID when none is given and omits Occassion', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    );
    const { api, calls } = setup([
      token,
      {
        status: 200,
        body: { ...accepted, OriginatorConversationID: '11111111-2222-4333-8444-555555555555' },
      },
    ]);

    const res = await api.pay(input);

    const body = calls[1]!.body as Record<string, unknown>;
    expect(body.OriginatorConversationID).toBe('11111111-2222-4333-8444-555555555555');
    expect(body).not.toHaveProperty('Occassion');
    expect(res.originatorConversationId).toBe('11111111-2222-4333-8444-555555555555');
  });

  test('maps the acknowledgement to camelCase', async () => {
    const { api } = setup([token, { status: 200, body: accepted }]);

    expect(await api.pay({ ...input, originatorConversationId: 'caller-id-1' })).toEqual({
      conversationId: 'AG_20240706_20106e9209f64bebd05b',
      originatorConversationId: 'caller-id-1',
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
      raw: accepted,
    });
  });

  test('reports every invalid field without calling Daraja', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .pay({
        ...input,
        commandId: 'Other' as never,
        amount: 5,
        remarks: 'x',
        occasion: 'y'.repeat(101),
      })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      {
        path: 'commandId',
        message: "must be 'SalaryPayment', 'BusinessPayment' or 'PromotionPayment'",
      },
      { path: 'amount', message: 'must be at least 10' },
      { path: 'remarks', message: 'must be at least 2 characters' },
      { path: 'occasion', message: 'must be at most 100 characters' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('requires an initiator', async () => {
    const { api } = setup([], { initiator: undefined });

    const error = await api.pay(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).toBe('b2c.pay: initiator is required');
  });

  test('is available on the client', () => {
    const { fetch } = fakeFetch([]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'k',
      consumerSecret: 's',
      fetch,
    });
    expect(typeof mpesa.b2c.pay).toBe('function');
  });
});

describe('b2c.pay OriginatorConversationID handling', () => {
  test('returns the generated ID even when Daraja does not echo it', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    );
    const { ConversationID, ResponseCode, ResponseDescription } = accepted;
    const { api } = setup([
      token,
      { status: 200, body: { ConversationID, ResponseCode, ResponseDescription } },
    ]);

    const res = await api.pay(input);

    expect(res.originatorConversationId).toBe('11111111-2222-4333-8444-555555555555');
  });

  test('attaches the ID to errors so the payment can be checked', async () => {
    const { api } = setup([token, new TypeError('socket hang up')]);

    const error = await api
      .pay({ ...input, originatorConversationId: 'caller-id-9' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).originatorConversationId).toBe('caller-id-9');
  });

  test('resends the identical body after a token refresh', async () => {
    const { api, calls } = setup([
      token,
      { status: 404, body: { errorCode: '404.001.03', errorMessage: 'Invalid Access Token' } },
      { status: 200, body: { access_token: 'tok2', expires_in: 3599 } },
      { status: 200, body: accepted },
    ]);

    await api.pay(input);

    expect(calls).toHaveLength(4);
    expect(calls[3]?.body).toEqual(calls[1]?.body);
    expect(calls[3]?.headers.authorization).toBe('Bearer tok2');
  });
});

describe('b2c.pay input edge cases', () => {
  test('omits an empty occasion', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.pay({ ...input, occasion: '' });

    expect(calls[1]?.body).not.toHaveProperty('Occassion');
  });

  test('reports a missing initiator together with field issues', async () => {
    const { api, calls } = setup([], { initiator: undefined });

    const error = await api.pay({ ...input, amount: 5 }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'initiator', message: 'is required' },
      { path: 'amount', message: 'must be at least 10' },
    ]);
    expect(calls).toHaveLength(0);
  });
});

describe('b2c.pay validation rules', () => {
  test.each([
    ['amount above 250 000', { amount: 250_001 }, 'amount', 'must be at most 250000'],
    ['non-integer amount', { amount: 10.5 }, 'amount', 'must be an integer'],
    ['shortCode too short', { shortCode: 1234 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    [
      'invalid phone',
      { phoneNumber: '0812345678' },
      'phoneNumber',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    [
      'remarks over 100 characters',
      { remarks: 'r'.repeat(101) },
      'remarks',
      'must be at most 100 characters',
    ],
    ['relative result URL', { resultUrl: '/result' }, 'resultUrl', 'must be an absolute URL'],
    [
      'relative timeout URL',
      { queueTimeoutUrl: 'timeout' },
      'queueTimeoutUrl',
      'must be an absolute URL',
    ],
    [
      'ID over 100 characters',
      { originatorConversationId: 'i'.repeat(101) },
      'originatorConversationId',
      'must be at most 100 characters',
    ],
  ])('%s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.pay({ ...input, ...override }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('requires https in production', async () => {
    const { api, calls } = setup([], { environment: 'production' });

    const error = await api
      .pay({ ...input, resultUrl: 'http://example.com/result' })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'resultUrl', message: 'must use https in production' },
    ]);
    expect(calls).toHaveLength(0);
  });
});
