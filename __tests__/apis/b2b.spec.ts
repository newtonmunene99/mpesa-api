import { constants, privateDecrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vite-plus/test';
import { b2b, type B2BApi } from '../../src/apis/b2b';
import { createContext, createMpesa, type MpesaConfig } from '../../src/client';
import { DarajaApiError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';
import { sandboxCapture } from '../helpers/sandbox-capture';

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

  test('reports every invalid field at once, in a fixed order, without calling Daraja', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .payBill({
        ...payBill,
        amount: 0,
        shortCode: 12,
        partyB: 'abc' as never,
        remarks: '',
        accountReference: 'a'.repeat(14),
        occasion: 'o'.repeat(101),
        requester: '12345',
      })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues.map((issue) => issue.path)).toEqual([
      'amount',
      'shortCode',
      'partyB',
      'remarks',
      'accountReference',
      'occasion',
      'requester',
    ]);
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

describe('b2b.expressCheckout', () => {
  // The acknowledgement sample from the B2B Express CheckOut portal page.
  const initiated = { code: '0', status: 'USSD Initiated Successfully' };
  const checkout = {
    shortCode: 600000,
    merchantTill: 123456,
    amount: 100,
    paymentReference: 'INV-7',
    partnerName: 'Vendor',
    callbackUrl: 'https://example.com/b2b/express',
  };

  test('posts the push without an initiator and returns the request ID', async () => {
    const { calls, api } = setup([token, { status: 200, body: initiated }], {
      initiator: undefined,
    });

    const res = await api.expressCheckout({ ...checkout, requestRefId: 'ref-1' });

    expect(calls[1]!.url).toBe('https://sandbox.safaricom.co.ke/v1/ussdpush/get-msisdn');
    expect(calls[1]!.body).toEqual({
      primaryShortCode: '123456',
      receiverShortCode: '600000',
      amount: '100',
      paymentRef: 'INV-7',
      callbackUrl: 'https://example.com/b2b/express',
      partnerName: 'Vendor',
      RequestRefID: 'ref-1',
    });
    expect(res).toEqual({
      code: '0',
      status: 'USSD Initiated Successfully',
      requestRefId: 'ref-1',
      raw: initiated,
    });
  });

  test('generates a request ID when none is given', async () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('0-0-0-0-0');
    try {
      const { calls, api } = setup([token, { status: 200, body: initiated }]);

      const res = await api.expressCheckout(checkout);

      expect(calls[1]!.body).toMatchObject({ RequestRefID: '0-0-0-0-0' });
      expect(res.requestRefId).toBe('0-0-0-0-0');
    } finally {
      spy.mockRestore();
    }
  });

  test('rejects a non-zero code as DarajaApiError', async () => {
    const body = { code: '1', status: 'Failed' };
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.expressCheckout(checkout).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 200, errorCode: '1', errorMessage: 'Failed', body });
  });

  test('rejects an acknowledgement without a code', async () => {
    const { api } = setup([token, { status: 200, body: { status: 'Unknown' } }]);

    await expect(api.expressCheckout(checkout)).rejects.toBeInstanceOf(DarajaApiError);
  });

  test('surfaces the sandbox refusal as DarajaApiError', async () => {
    const captured = sandboxCapture('b2b-express-checkout');
    const refused: FakeResponse = { status: captured.status, body: captured.response };
    // A 401 makes the SDK refresh the token and retry once before giving up.
    const { api, calls } = setup([token, refused, token, refused]);

    const error = await api.expressCheckout(checkout).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 401, errorCode: '401' });
    expect(calls).toHaveLength(4);
  });

  test('is wired on createMpesa', async () => {
    const { fetch, calls } = fakeFetch([token, { status: 200, body: initiated }]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });

    await mpesa.b2b.expressCheckout(checkout);

    expect(calls[1]!.url).toBe('https://sandbox.safaricom.co.ke/v1/ussdpush/get-msisdn');
  });

  test.each([
    ['amount 0', { amount: 0 }, 'amount', 'must be at least 1'],
    ['fractional amount', { amount: 1.5 }, 'amount', 'must be an integer'],
    ['short shortCode', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    [
      'non-numeric merchantTill',
      { merchantTill: 'abc' as never },
      'merchantTill',
      'must be a 5 to 7 digit shortcode',
    ],
    ['empty paymentReference', { paymentReference: '' }, 'paymentReference', 'is required'],
    ['blank partnerName', { partnerName: '  ' }, 'partnerName', 'is required'],
    ['relative callbackUrl', { callbackUrl: '/cb' }, 'callbackUrl', 'must be an absolute URL'],
    ['empty requestRefId', { requestRefId: '' }, 'requestRefId', 'is required'],
    ['blank requestRefId', { requestRefId: '  ' }, 'requestRefId', 'is required'],
    ['non-string partnerName', { partnerName: 42 as never }, 'partnerName', 'is required'],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.expressCheckout({ ...checkout, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('b2b.expressCheckout');
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('requires https callbacks in production', async () => {
    const { api, calls } = setup([], { environment: 'production' });

    const error = await api
      .expressCheckout({ ...checkout, callbackUrl: 'http://example.com/cb' })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'callbackUrl', message: 'must use https in production' },
    ]);
    expect(calls).toHaveLength(0);
  });
});
