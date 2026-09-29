import { constants, privateDecrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { b2c } from '../../src/apis/b2c';
import { createContext, createMpesa, type MpesaConfig } from '../../src/client';
import { ValidationError } from '../../src/core/errors';
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
