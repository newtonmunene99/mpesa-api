import { describe, expect, test } from 'vite-plus/test';
import { bonga } from '../../src/apis/bonga';
import { createContext, createMpesa } from '../../src/client';
import { DarajaApiError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';
import { sandboxCapture } from '../helpers/sandbox-capture';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };

function setup(responses: FakeResponse[]) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    fetch,
  });
  return { api: bonga(ctx), calls };
}

// The calculate-points response sample from the Lipa na Bonga portal page.
const calculated = {
  header: {
    requestRefId: '55b2b8bd-0be4-4430-b0dc-792efccdc690',
    responseCode: 200,
    responseMessage: 'Success',
    customerMessage: 'Request executed successfully.',
    timestamp: '2025-02-24T12:29:05.484864516',
  },
  body: { amount: '8', points: '40', rate: '0.2' },
};

const base = 'https://sandbox.safaricom.co.ke/v1/lipa/na/bonga';

describe('bonga.calculatePoints', () => {
  test('posts the points as a string and maps the conversion', async () => {
    const { api, calls } = setup([token, { status: 200, body: calculated }]);

    const res = await api.calculatePoints({ points: 40 });

    expect(calls[1]!.url).toBe(`${base}/calculate-points`);
    expect(calls[1]!.body).toEqual({ points: '40' });
    expect(res).toEqual({
      amountCents: 800,
      points: 40,
      rate: 0.2,
      requestRefId: '55b2b8bd-0be4-4430-b0dc-792efccdc690',
      responseCode: 200,
      customerMessage: 'Request executed successfully.',
      raw: calculated,
    });
  });

  test('reads a fractional amount exactly', async () => {
    const body = { ...calculated, body: { amount: '1.4', points: '7', rate: '0.2' } };
    const { api } = setup([token, { status: 200, body }]);

    expect(await api.calculatePoints({ points: 7 })).toMatchObject({ amountCents: 140 });
  });

  test.each([
    ['a 404 header code', { header: { responseCode: 404, responseMessage: 'Fail' }, body: null }],
    ['no header', { body: calculated.body }],
  ])('rejects a response with %s', async (_, body) => {
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.calculatePoints({ points: 40 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 200, body });
  });

  test('names the refused code in the error', async () => {
    const body = { header: { responseCode: 404, responseMessage: 'Fail' }, body: null };
    const { api } = setup([token, { status: 200, body }]);

    await expect(api.calculatePoints({ points: 40 })).rejects.toMatchObject({
      errorCode: '404',
      errorMessage: 'Fail',
    });
  });

  test.each([
    [
      'a non-numeric amount',
      { amount: 'eight', points: '40', rate: '0.2' },
      'amount',
      'must be a number',
    ],
    [
      'a non-numeric rate',
      { amount: '8', points: '40', rate: 'x' },
      'rate',
      'must be a positive number',
    ],
    [
      'a fractional points',
      { amount: '8', points: '4.5', rate: '0.2' },
      'points',
      'must be an integer',
    ],
  ])('reports %s in the body', async (_, values, path, message) => {
    const { api } = setup([token, { status: 200, body: { ...calculated, body: values } }]);

    const error = await api.calculatePoints({ points: 40 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('bonga.calculatePoints');
    expect((error as ValidationError).issues).toEqual([{ path: `body.${path}`, message }]);
  });

  test('reports a zero rate', async () => {
    const body = { ...calculated, body: { amount: '8', points: '40', rate: '0' } };
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.calculatePoints({ points: 40 }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'body.rate', message: 'must be a positive number' },
    ]);
  });

  test('reports a non-positive amount in the body', async () => {
    const body = { ...calculated, body: { amount: '-8', points: '40', rate: '0.2' } };
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.calculatePoints({ points: 40 }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'body.amount', message: 'must be a positive number' },
    ]);
  });

  test("surfaces the sandbox's 404 (bonga-calculate.json)", async () => {
    // This sandbox app has no route to Lipa na Bonga: HTTP 404 with an empty body.
    const captured = sandboxCapture('bonga-calculate');
    const { api, calls } = setup([token, { status: captured.status, body: captured.response }]);

    const error = await api.calculatePoints({ points: 40 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 404 });
    expect(calls).toHaveLength(2);
  });

  test('is wired on createMpesa, with no initiator', async () => {
    const { fetch, calls } = fakeFetch([token, { status: 200, body: calculated }]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });

    await mpesa.bonga.calculatePoints({ points: 40 });

    expect(calls[1]!.url).toBe(`${base}/calculate-points`);
  });

  test.each([
    ['points 0', 0, 'must be at least 1'],
    ['fractional points', 1.5, 'must be an integer'],
  ])('rejects %s', async (_, points, message) => {
    const { api, calls } = setup([]);

    const error = await api.calculatePoints({ points }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([{ path: 'points', message }]);
    expect(calls).toHaveLength(0);
  });
});

// The redeem response sample from the Lipa na Bonga portal page.
const redeemed = {
  header: {
    requestRefId: 'a53a2939-7361-482f-ba1e-ccd51504acd3',
    responseCode: 200,
    responseMessage: 'Operation Successfully.',
    customerMessage: 'Dear customer, your request was processed successfully',
    timestamp: '2026-03-10T09:54:28.456847481',
  },
  body: null,
};
const redemption = {
  phoneNumber: '0720776155',
  shortCode: 888880,
  accountNumber: 'test',
  points: 40,
  amount: 8,
  rate: 0.2,
};

describe('bonga.redeem', () => {
  test('posts the redemption and maps the acknowledgement', async () => {
    const { api, calls } = setup([token, { status: 200, body: redeemed }]);

    const res = await api.redeem(redemption);

    expect(calls[1]!.url).toBe(`${base}/redeem-paybill`);
    expect(calls[1]!.body).toEqual({
      msisdn: '254720776155',
      amount: 8,
      bongaPoints: 40,
      conversionRate: 0.2,
      shortCode: '888880',
      accountNumber: 'test',
    });
    expect(res).toEqual({
      requestRefId: 'a53a2939-7361-482f-ba1e-ccd51504acd3',
      responseCode: 200,
      responseMessage: 'Operation Successfully.',
      raw: redeemed,
    });
  });

  test('accepts a fractional amount that matches exactly', async () => {
    const { api, calls } = setup([token, { status: 200, body: redeemed }]);

    // 0.2 * 3 is 0.6000000000000001 in floating point; the check compares cents.
    await api.redeem({ ...redemption, points: 3, amount: 0.6 });

    expect(calls[1]!.body).toMatchObject({ amount: 0.6, bongaPoints: 3 });
  });

  test('rejects a non-200 header', async () => {
    const body = { header: { responseCode: 404, responseMessage: 'Fail' }, body: null };
    const { api } = setup([token, { status: 200, body }]);

    await expect(api.redeem(redemption)).rejects.toMatchObject({
      name: 'DarajaApiError',
      errorCode: '404',
      errorMessage: 'Fail',
    });
  });

  test("surfaces the sandbox's 404 (bonga-redeem.json)", async () => {
    const captured = sandboxCapture('bonga-redeem');
    const { api } = setup([token, { status: captured.status, body: captured.response }]);

    await expect(api.redeem(redemption)).rejects.toMatchObject({ status: 404 });
  });

  test.each([
    [
      'an invalid phoneNumber',
      { phoneNumber: '123' },
      'phoneNumber',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    ['a short shortCode', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    ['an empty accountNumber', { accountNumber: ' ' }, 'accountNumber', 'is required'],
    ['points 0', { points: 0 }, 'points', 'must be at least 1'],
    ['fractional points', { points: 1.5 }, 'points', 'must be an integer'],
    ['rate 0', { rate: 0 }, 'rate', 'must be a positive number'],
    ['an infinite rate', { rate: Infinity }, 'rate', 'must be a positive number'],
    ['a NaN rate', { rate: Number.NaN }, 'rate', 'must be a positive number'],
    ['a negative amount', { amount: -8 }, 'amount', 'must be a positive number'],
    ['an infinite amount', { amount: Infinity }, 'amount', 'must be a positive number'],
    ['a NaN amount', { amount: Number.NaN }, 'amount', 'must be a positive number'],
    [
      'an amount with tenths of a cent',
      { amount: 8.004 },
      'amount',
      'must have at most 2 decimal places',
    ],
    [
      'an amount below one cent',
      { points: 1, amount: 0.004, rate: 0.004 },
      'amount',
      'must have at most 2 decimal places',
    ],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.redeem({ ...redemption, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('bonga.redeem');
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('reports both an infinite rate and amount', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .redeem({ ...redemption, rate: Infinity, amount: Infinity })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'rate', message: 'must be a positive number' },
      { path: 'amount', message: 'must be a positive number' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('sends the portal sample as given, though its amount is not points × rate', async () => {
    // KES 50 for 20 points at 0.2 (worth 4): Daraja, not the SDK, decides whether that's valid.
    const { api, calls } = setup([token, { status: 200, body: redeemed }]);

    await api.redeem({ ...redemption, amount: 50, points: 20 });

    expect(calls[1]!.body).toMatchObject({ amount: 50, bongaPoints: 20, conversionRate: 0.2 });
  });
});
