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
