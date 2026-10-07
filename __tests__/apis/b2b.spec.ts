import { constants, privateDecrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { b2b, type B2BApi } from '../../src/apis/b2b';
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
// The acknowledgement sample from the Business Pay Bill portal page.
const accepted = {
  OriginatorConversationID: '5118-111210482-1',
  ConversationID: 'AG_20230420_2010759fd5662ef6d054',
  ResponseCode: '0',
  ResponseDescription: 'Accept the service request successfully.',
};
const urls = {
  resultUrl: 'https://example.com/b2b/result',
  queueTimeoutUrl: 'https://example.com/b2b/timeout',
};
const sentUrls = {
  QueueTimeOutURL: 'https://example.com/b2b/timeout',
  ResultURL: 'https://example.com/b2b/result',
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
  return { api: b2b(ctx), calls };
}

/** Sends one request and returns its URL and body, with the credential checked and masked. */
async function sent(send: (api: B2BApi) => Promise<unknown>) {
  const { api, calls } = setup([token, { status: 200, body: accepted }]);
  await send(api);
  const call = calls[1]!;
  const body = call.body as Record<string, unknown>;
  expect(decrypt(body.SecurityCredential as string)).toBe('Safaricom999!*!');
  expect(call.headers).toMatchObject({ authorization: 'Bearer tok' });
  return { url: call.url, body: { ...body, SecurityCredential: '<checked>' } };
}

const payBill = {
  amount: 239,
  shortCode: 600979,
  partyB: 600000,
  accountReference: '353353',
  remarks: 'OK',
  ...urls,
};

describe('b2b.payBill', () => {
  test('posts a Business Pay Bill request with every documented field', async () => {
    const { url, body } = await sent((api) =>
      api.payBill({ ...payBill, requester: '0708374149', occasion: 'Rent' }),
    );

    expect(url).toBe('https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest');
    expect(body).toEqual({
      Initiator: 'testapi',
      SecurityCredential: '<checked>',
      CommandID: 'BusinessPayBill',
      SenderIdentifierType: '4',
      RecieverIdentifierType: '4',
      Amount: 239,
      PartyA: 600979,
      PartyB: 600000,
      AccountReference: '353353',
      Requester: '254708374149',
      Occassion: 'Rent',
      Remarks: 'OK',
      ...sentUrls,
    });
  });

  test('omits Requester and Occassion when not given, and sends no OriginatorConversationID', async () => {
    const { body } = await sent((api) => api.payBill(payBill));

    expect(body).not.toHaveProperty('Requester');
    expect(body).not.toHaveProperty('Occassion');
    expect(body).not.toHaveProperty('OriginatorConversationID');
  });

  test('maps the acknowledgement to camelCase', async () => {
    const { api } = setup([token, { status: 200, body: accepted }]);

    expect(await api.payBill(payBill)).toEqual({
      originatorConversationId: '5118-111210482-1',
      conversationId: 'AG_20230420_2010759fd5662ef6d054',
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
      raw: accepted,
    });
  });

  test.each([
    ['missing accountReference', { accountReference: '' }, 'accountReference', 'is required'],
    [
      'accountReference over 13 characters',
      { accountReference: 'a'.repeat(14) },
      'accountReference',
      'must be at most 13 characters',
    ],
    [
      'invalid requester',
      { requester: '12345' },
      'requester',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    [
      'occasion over 100 characters',
      { occasion: 'o'.repeat(101) },
      'occasion',
      'must be at most 100 characters',
    ],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.payBill({ ...payBill, ...override }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('is available on the client', () => {
    const { fetch } = fakeFetch([]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'k',
      consumerSecret: 's',
      fetch,
    });
    expect(typeof mpesa.b2b.payBill).toBe('function');
  });
});

const buyGoods = { amount: 239, shortCode: 600979, partyB: 600000, remarks: 'OK', ...urls };

describe('b2b.buyGoods', () => {
  test('posts a Business Buy Goods request with every documented field', async () => {
    const { url, body } = await sent((api) =>
      api.buyGoods({
        ...buyGoods,
        accountReference: '353353',
        requester: '254708374149',
        occasion: 'Stock',
      }),
    );

    expect(url).toBe('https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest');
    expect(body).toEqual({
      Initiator: 'testapi',
      SecurityCredential: '<checked>',
      CommandID: 'BusinessBuyGoods',
      SenderIdentifierType: '4',
      RecieverIdentifierType: '4',
      Amount: 239,
      PartyA: 600979,
      PartyB: 600000,
      AccountReference: '353353',
      Requester: '254708374149',
      Occassion: 'Stock',
      Remarks: 'OK',
      ...sentUrls,
    });
  });

  test('sends no AccountReference, Requester or Occassion when not given', async () => {
    const { body } = await sent((api) => api.buyGoods({ ...buyGoods, accountReference: '' }));

    expect(body).not.toHaveProperty('AccountReference');
    expect(body).not.toHaveProperty('Requester');
    expect(body).not.toHaveProperty('Occassion');
  });

  test('rejects an accountReference over 13 characters', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .buyGoods({ ...buyGoods, accountReference: 'a'.repeat(14) })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'accountReference', message: 'must be at most 13 characters' },
    ]);
    expect(calls).toHaveLength(0);
  });
});

const topUp = { amount: 239, shortCode: 600979, partyB: 600000, remarks: 'OK', ...urls };

describe('b2b.topUpB2C', () => {
  test('posts a B2C Account Top Up request with every documented field', async () => {
    const { url, body } = await sent((api) =>
      api.topUpB2C({ ...topUp, accountReference: '353353', requester: '0708374149' }),
    );

    expect(url).toBe('https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest');
    expect(body).toEqual({
      Initiator: 'testapi',
      SecurityCredential: '<checked>',
      CommandID: 'BusinessPayToBulk',
      SenderIdentifierType: '4',
      RecieverIdentifierType: '4',
      Amount: 239,
      PartyA: 600979,
      PartyB: 600000,
      AccountReference: '353353',
      Requester: '254708374149',
      Remarks: 'OK',
      ...sentUrls,
    });
  });

  test('never sends Occassion, which Top Up does not take', async () => {
    const { body } = await sent((api) =>
      api.topUpB2C({ ...topUp, occasion: 'ignored' } as typeof topUp),
    );

    expect(body).not.toHaveProperty('Occassion');
    expect(body).not.toHaveProperty('AccountReference');
    expect(body).not.toHaveProperty('Requester');
  });

  test('rejects an invalid requester', async () => {
    const { api, calls } = setup([]);

    const error = await api.topUpB2C({ ...topUp, requester: '12345' }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      {
        path: 'requester',
        message: 'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
      },
    ]);
    expect(calls).toHaveLength(0);
  });
});

const tax = {
  amount: 239,
  shortCode: 888880,
  accountReference: 'PRN1234XN',
  remarks: 'OK',
  ...urls,
};

describe('b2b.remitTax', () => {
  test('posts a Tax Remittance request to KRA', async () => {
    const { url, body } = await sent((api) => api.remitTax(tax));

    expect(url).toBe('https://sandbox.safaricom.co.ke/mpesa/b2b/v1/remittax');
    expect(body).toEqual({
      Initiator: 'testapi',
      SecurityCredential: '<checked>',
      CommandID: 'PayTaxToKRA',
      SenderIdentifierType: '4',
      RecieverIdentifierType: '4',
      Amount: 239,
      PartyA: 888880,
      PartyB: 572572,
      AccountReference: 'PRN1234XN',
      Remarks: 'OK',
      ...sentUrls,
    });
  });

  test('requires the payment registration number', async () => {
    const { api, calls } = setup([]);

    const error = await api.remitTax({ ...tax, accountReference: '' }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'accountReference', message: 'is required' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('always pays KRA and takes no partyB, requester or occasion', async () => {
    const { body } = await sent((api) =>
      // @ts-expect-error remitTax has no partyB; KRA's shortcode is fixed.
      api.remitTax({ ...tax, partyB: 600000, requester: '0708374149', occasion: 'x' }),
    );

    expect(body).toHaveProperty('PartyB', 572572);
    expect(body).not.toHaveProperty('Requester');
    expect(body).not.toHaveProperty('Occassion');
  });
});

/** Each B2B method with a valid input; the shared rules below run against every one. */
const methods: [
  string,
  (api: B2BApi, input: Record<string, unknown>) => Promise<unknown>,
  Record<string, unknown>,
][] = [
  ['payBill', (api, input) => api.payBill(input as typeof payBill), payBill],
  ['buyGoods', (api, input) => api.buyGoods(input as typeof buyGoods), buyGoods],
  ['topUpB2C', (api, input) => api.topUpB2C(input as typeof topUp), topUp],
  ['remitTax', (api, input) => api.remitTax(input as typeof tax), tax],
];

describe.each(methods)('b2b.%s shared validation', (method, call, valid) => {
  test.each([
    ['zero amount', { amount: 0 }, 'amount', 'must be at least 1'],
    ['non-integer amount', { amount: 1.5 }, 'amount', 'must be an integer'],
    ['shortCode too short', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    ['empty remarks', { remarks: '' }, 'remarks', 'is required'],
    [
      'remarks over 100 characters',
      { remarks: 'r'.repeat(101) },
      'remarks',
      'must be at most 100 characters',
    ],
    ['relative result URL', { resultUrl: '/result' }, 'resultUrl', 'must be an absolute URL'],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await call(api, { ...valid, ...override }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('requires an initiator', async () => {
    const { api, calls } = setup([], { initiator: undefined });

    const error = await call(api, valid).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).toBe(`b2b.${method}: initiator is required`);
    expect(calls).toHaveLength(0);
  });
});

describe.each(methods.filter(([, , valid]) => 'partyB' in valid))(
  'b2b.%s partyB',
  (_, call, valid) => {
    test('rejects an invalid partyB', async () => {
      const { api, calls } = setup([]);

      const error = await call(api, { ...valid, partyB: 'abc' }).catch((e: unknown) => e);

      expect((error as ValidationError).issues).toEqual([
        { path: 'partyB', message: 'must be a 5 to 7 digit shortcode' },
      ]);
      expect(calls).toHaveLength(0);
    });
  },
);

describe('b2b optional-field rules per method', () => {
  test.each([
    ['topUpB2C', 'accountReference', 'a'.repeat(14), 'must be at most 13 characters'],
    ['remitTax', 'accountReference', 'a'.repeat(14), 'must be at most 13 characters'],
    [
      'buyGoods',
      'requester',
      '12345',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    ['buyGoods', 'occasion', 'o'.repeat(101), 'must be at most 100 characters'],
  ])('%s rejects an invalid %s', async (method, path, value, message) => {
    const [, call, valid] = methods.find(([name]) => name === method)!;
    const { api, calls } = setup([]);

    const error = await call(api, { ...valid, [path]: value }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });
});
