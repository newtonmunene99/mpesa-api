import { describe, expect, test, vi } from 'vite-plus/test';
import { ratiba, type RatibaStandingOrderInput } from '../../src/apis/ratiba';
import { createContext, createMpesa, type Environment } from '../../src/client';
import { DarajaApiError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';
import { sandboxCapture } from '../helpers/sandbox-capture';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };

function setup(responses: FakeResponse[], environment: Environment = 'sandbox') {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({ environment, consumerKey: 'key', consumerSecret: 'secret', fetch });
  return { api: ratiba(ctx), calls };
}

// The acknowledgement sample from the M-Pesa Ratiba portal page.
const accepted = {
  ResponseHeader: {
    responseRefID: '4dd9b5d9-d738-42ba-9326-2cc99e966000',
    responseCode: '200',
    responseDescription: 'Request accepted for processing',
    ResultDesc: 'The service request is processed successfully.',
  },
  ResponseBody: { responseDescription: 'Request accepted for processing', responseCode: '200' },
};

const order: RatibaStandingOrderInput = {
  name: 'Phone Lipa Mdogo Mdogo',
  type: 'paybill',
  shortCode: 600000,
  phoneNumber: '0712345678',
  amount: 500,
  // 23:30 EAT on 4 September, so a UTC formatter would send the wrong day.
  startDate: new Date('2026-09-04T20:30:00Z'),
  endDate: new Date('2027-09-05T09:00:00Z'),
  frequency: 'monthly',
  accountReference: 'PHONE-42',
  description: 'Phone loan',
  callbackUrl: 'https://example.com/ratiba',
  requestRefId: 'ref-1',
};

const path = 'https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal';

describe('ratiba.createStandingOrder', () => {
  test('posts the order without an initiator and maps the acknowledgement', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    const res = await api.createStandingOrder(order);

    expect(calls[1]!.url).toBe(path);
    expect(calls[1]!.body).toEqual({
      StandingOrderName: 'Phone Lipa Mdogo Mdogo',
      ReceiverPartyIdentifierType: '4',
      TransactionType: 'Standing Order Pay Bill Ext-Third Party',
      BusinessShortCode: '600000',
      PartyA: '254712345678',
      Amount: '500',
      StartDate: '20260904',
      EndDate: '20270905',
      Frequency: '5',
      CustomStoId: 'ref-1',
      AccountReference: 'PHONE-42',
      TransactionDesc: 'Phone loan',
      CallBackURL: 'https://example.com/ratiba',
    });
    expect(res).toEqual({
      responseRefId: '4dd9b5d9-d738-42ba-9326-2cc99e966000',
      responseCode: '200',
      responseDescription: 'Request accepted for processing',
      requestRefId: 'ref-1',
      raw: accepted,
    });
  });

  test('sends a till as identifier type 2 with the merchant payment type', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.createStandingOrder({ ...order, type: 'till' });

    expect(calls[1]!.body).toMatchObject({
      ReceiverPartyIdentifierType: '2',
      TransactionType: 'Standing Order Merchant Payment Ext-Third Party',
    });
  });

  test.each([
    ['once', '1'],
    ['daily', '2'],
    ['weekly', '3'],
    ['biweekly', '4'],
    ['monthly', '5'],
    ['bimonthly', '6'],
    ['quarterly', '7'],
    ['halfYearly', '8'],
    ['yearly', '9'],
  ] as const)('sends frequency %s as %s', async (frequency, sent) => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.createStandingOrder({ ...order, frequency });

    expect(calls[1]!.body).toMatchObject({ Frequency: sent });
  });

  test('generates a request ID when none is given', async () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('0-0-0-0-0');
    try {
      const { api, calls } = setup([token, { status: 200, body: accepted }]);
      const { requestRefId: _, ...withoutId } = order;

      const res = await api.createStandingOrder(withoutId);

      expect(calls[1]!.body).toMatchObject({ CustomStoId: '0-0-0-0-0' });
      expect(res.requestRefId).toBe('0-0-0-0-0');
    } finally {
      spy.mockRestore();
    }
  });

  test.each([
    [
      'a 500 header code',
      { ResponseHeader: { responseCode: '500', responseDescription: 'Failed' } },
    ],
    ['no header', { ResponseBody: { responseCode: '200' } }],
  ])('rejects an acknowledgement with %s', async (_, body) => {
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.createStandingOrder(order).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 200, body });
  });

  test('accepts an end on the same EAT day, even earlier in that day', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    // Start 23:30 EAT, end 13:00 EAT on 4 September.
    await api.createStandingOrder({
      ...order,
      frequency: 'once',
      endDate: new Date('2026-09-04T10:00:00Z'),
    });

    expect(calls[1]!.body).toMatchObject({ StartDate: '20260904', EndDate: '20260904' });
  });

  test('leaves errorCode out when the header is missing', async () => {
    const { api } = setup([token, { status: 200, body: { ResponseBody: {} } }]);

    const error = await api.createStandingOrder(order).catch((e: unknown) => e);

    expect((error as DarajaApiError).errorCode).toBeUndefined();
  });

  test('names the refused code in the error', async () => {
    const body = { ResponseHeader: { responseCode: '500', responseDescription: 'Failed' } };
    const { api } = setup([token, { status: 200, body }]);

    await expect(api.createStandingOrder(order)).rejects.toMatchObject({
      errorCode: '500',
      errorMessage: 'Failed',
    });
  });

  test("surfaces the sandbox's refusal (ratiba-create.json)", async () => {
    // The sandbox refuses any shortcode not issued to the app, with HTTP 400.
    const captured = sandboxCapture('ratiba-create');
    const { api, calls } = setup([token, { status: captured.status, body: captured.response }]);

    const error = await api.createStandingOrder(order).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 400, body: captured.response });
    expect(calls).toHaveLength(2);
  });

  test('is wired on createMpesa', async () => {
    const { fetch, calls } = fakeFetch([token, { status: 200, body: accepted }]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });

    await mpesa.ratiba.createStandingOrder(order);

    expect(calls[1]!.url).toBe(path);
  });

  test.each([
    ['empty name', { name: ' ' }, 'name', 'is required'],
    ['amount 0', { amount: 0 }, 'amount', 'must be at least 1'],
    ['fractional amount', { amount: 1.5 }, 'amount', 'must be an integer'],
    ['short shortCode', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    [
      'invalid phoneNumber',
      { phoneNumber: '123' },
      'phoneNumber',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    [
      'accountReference over 12',
      { accountReference: 'A'.repeat(13) },
      'accountReference',
      'must be at most 12 characters',
    ],
    ['empty accountReference', { accountReference: '' }, 'accountReference', 'is required'],
    ['empty description', { description: '' }, 'description', 'is required'],
    [
      'description over 13',
      { description: 'D'.repeat(14) },
      'description',
      'must be at most 13 characters',
    ],
    ['invalid startDate', { startDate: new Date('x') }, 'startDate', 'must be a valid date'],
    ['invalid endDate', { endDate: new Date('x') }, 'endDate', 'must be a valid date'],
    [
      'endDate before startDate',
      { endDate: new Date('2026-09-03T00:00:00Z') },
      'endDate',
      'must not be before startDate',
    ],
    ['unknown type', { type: 'bank' as never }, 'type', "must be 'paybill' or 'till'"],
    [
      'unknown frequency',
      { frequency: 'hourly' as never },
      'frequency',
      "must be 'once', 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'halfYearly' or 'yearly'",
    ],
    [
      'inherited frequency',
      { frequency: 'toString' as never },
      'frequency',
      "must be 'once', 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'halfYearly' or 'yearly'",
    ],
    ['relative callbackUrl', { callbackUrl: '/cb' }, 'callbackUrl', 'must be an absolute URL'],
    ['empty requestRefId', { requestRefId: ' ' }, 'requestRefId', 'is required'],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.createStandingOrder({ ...order, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('ratiba.createStandingOrder');
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('requires an https callbackUrl in production', async () => {
    const { api, calls } = setup([], 'production');

    const error = await api
      .createStandingOrder({ ...order, callbackUrl: 'http://example.com/cb' })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'callbackUrl', message: 'must use https in production' },
    ]);
    expect(calls).toHaveLength(0);
  });
});
