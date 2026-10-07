import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { pullTransactions } from '../../src/apis/pull-transactions';
import { createContext, createMpesa, type Environment } from '../../src/client';
import { DarajaApiError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';
import { sandboxCapture } from '../helpers/sandbox-capture';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };

function setup(responses: FakeResponse[], environment: Environment = 'sandbox') {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({ environment, consumerKey: 'key', consumerSecret: 'secret', fetch });
  return { api: pullTransactions(ctx), calls };
}

// The register response sample from the Pull Transactions portal page.
const registered = {
  ResponseRefID: 'feb5e3f2-fbc-4745-844c-ee37b546f627',
  ResponseStatus: '1000',
  ShortCode: '600000',
  ResponseDescription: 'Shortcode Registered Successfully',
};
const registration = {
  shortCode: 600000,
  nominatedNumber: '0722000000',
  callbackUrl: 'https://example.com/pull',
};

describe('pullTransactions.register', () => {
  test('posts the registration without an initiator and maps the response', async () => {
    const { api, calls } = setup([token, { status: 200, body: registered }]);

    const res = await api.register(registration);

    expect(calls[1]!.url).toBe('https://sandbox.safaricom.co.ke/pulltransactions/v1/register');
    expect(calls[1]!.body).toEqual({
      ShortCode: '600000',
      RequestType: 'Pull',
      NominatedNumber: '254722000000',
      CallBackURL: 'https://example.com/pull',
    });
    expect(res).toEqual({
      responseRefId: 'feb5e3f2-fbc-4745-844c-ee37b546f627',
      status: '1000',
      shortCode: '600000',
      description: 'Shortcode Registered Successfully',
      alreadyRegistered: false,
      raw: registered,
    });
  });

  test('treats 1001 as already registered', async () => {
    const body = { ...registered, ResponseStatus: '1001', ResponseDescription: 'Already' };
    const { api } = setup([token, { status: 200, body }]);

    expect(await api.register(registration)).toMatchObject({
      status: '1001',
      alreadyRegistered: true,
    });
  });

  test('rejects any other ResponseStatus as DarajaApiError', async () => {
    const body = { ...registered, ResponseStatus: '1002', ResponseDescription: 'Refused' };
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.register(registration).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({
      status: 200,
      errorCode: '1002',
      errorMessage: 'Refused',
      body,
    });
  });

  test('rejects a body without ResponseStatus', async () => {
    const { api } = setup([token, { status: 200, body: { ResponseRefID: 'x' } }]);

    await expect(api.register(registration)).rejects.toBeInstanceOf(DarajaApiError);
  });

  test('surfaces the sandbox refusal as DarajaApiError', async () => {
    const captured = sandboxCapture('pull-register');
    const refused: FakeResponse = { status: captured.status, body: captured.response };
    // A 401 makes the SDK refresh the token and retry once before giving up.
    const { api, calls } = setup([token, refused, token, refused]);

    const error = await api.register(registration).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 401, errorCode: '401.001' });
    expect(calls).toHaveLength(4);
  });

  test('is wired on createMpesa', async () => {
    const { fetch, calls } = fakeFetch([token, { status: 200, body: registered }]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });

    await mpesa.pullTransactions.register(registration);

    expect(calls[1]!.url).toBe('https://sandbox.safaricom.co.ke/pulltransactions/v1/register');
  });

  test.each([
    ['short shortCode', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    [
      'invalid nominatedNumber',
      { nominatedNumber: '12345' },
      'nominatedNumber',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    ['relative callbackUrl', { callbackUrl: '/pull' }, 'callbackUrl', 'must be an absolute URL'],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.register({ ...registration, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('pullTransactions.register');
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('requires an https callbackUrl in production', async () => {
    const { api, calls } = setup([], 'production');

    const error = await api
      .register({ ...registration, callbackUrl: 'http://example.com/pull' })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'callbackUrl', message: 'must use https in production' },
    ]);
    expect(calls).toHaveLength(0);
  });
});

// The query response sample from the Pull Transactions portal page.
const page = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(new URL('../fixtures/daraja/pull-query-response.json', import.meta.url), 'utf8'),
  );
const window = {
  shortCode: 600000,
  from: new Date('2020-08-04T05:36:00Z'),
  to: new Date('2020-08-05T21:00:00Z'),
};

describe('pullTransactions.query', () => {
  test('posts the window in EAT and maps the transactions', async () => {
    const body = page();
    const { api, calls } = setup([token, { status: 200, body }]);

    const res = await api.query(window);

    expect(calls[1]!.url).toBe('https://sandbox.safaricom.co.ke/pulltransactions/v1/query');
    expect(calls[1]!.body).toEqual({
      ShortCode: '600000',
      StartDate: '2020-08-04 08:36:00',
      EndDate: '2020-08-06 00:00:00',
      OffSetValue: '0',
    });
    expect(res).toEqual({
      transactions: [
        {
          transactionId: 'yzlyrEsRG1',
          date: new Date('2020-08-05T10:13:00Z'),
          msisdn: '722000000',
          sender: 'UAT2',
          type: 'c2b-pay-bill-debit',
          billReference: '37207636392',
          amountCents: 16800,
          organizationName: 'Daraja Pull API Test',
        },
      ],
      responseRefId: '26178-42530161-2',
      responseCode: '1000',
      raw: body,
    });
  });

  test('sends a given offset as a string', async () => {
    const { api, calls } = setup([token, { status: 200, body: page() }]);

    await api.query({ ...window, offset: 40 });

    expect(calls[1]!.body).toMatchObject({ OffSetValue: '40' });
  });

  test('flattens several inner lists and leaves out a blank bill reference', async () => {
    const [[item]] = page().Response as Record<string, unknown>[][];
    const body = {
      ResponseCode: '1000',
      Response: [[item], [{ ...item, transactionId: 'second', billreference: '' }]],
    };
    const { api } = setup([token, { status: 200, body }]);

    const { transactions } = await api.query(window);

    expect(transactions.map((t) => t.transactionId)).toEqual(['yzlyrEsRG1', 'second']);
    expect(transactions[1]).not.toHaveProperty('billReference');
  });

  test.each([
    ["1001 with the portal's string body", { ResponseCode: '1001', Transaction: '[[]]' }],
    ['1001 with a nested empty list', { ResponseCode: '1001', Response: [[]] }],
    ['1000 with no transactions', { ResponseCode: '1000', Response: [] }],
  ])('returns no transactions for %s', async (_, body) => {
    const { api } = setup([token, { status: 200, body }]);

    expect((await api.query(window)).transactions).toEqual([]);
  });

  test('rejects another ResponseCode as DarajaApiError', async () => {
    const { api } = setup([
      token,
      { status: 200, body: { ResponseCode: '1002', ResponseMessage: 'Nope' } },
    ]);

    await expect(api.query(window)).rejects.toMatchObject({
      name: 'DarajaApiError',
      errorCode: '1002',
    });
  });

  test('surfaces the sandbox refusal as DarajaApiError', async () => {
    const captured = sandboxCapture('pull-query');
    const refused: FakeResponse = { status: captured.status, body: captured.response };
    const { api, calls } = setup([token, refused, token, refused]);

    await expect(api.query(window)).rejects.toMatchObject({ status: 401, errorCode: '401.001' });
    expect(calls).toHaveLength(4);
  });

  test('reports a malformed transaction by its position', async () => {
    const [[item]] = page().Response as Record<string, unknown>[][];
    const body = {
      ResponseCode: '1000',
      Response: [[item, { ...item, amount: 'abc', trxDate: 'yesterday', transactionId: '' }]],
    };
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.query(window).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('pullTransactions.query');
    expect((error as ValidationError).issues).toEqual([
      { path: 'transactions[1].transactionId', message: 'is required' },
      { path: 'transactions[1].trxDate', message: 'must be an ISO date' },
      { path: 'transactions[1].amount', message: 'must be a number' },
    ]);
  });

  test('reports a transaction that is not an object', async () => {
    const { api } = setup([
      token,
      { status: 200, body: { ResponseCode: '1000', Response: [[1]] } },
    ]);

    const error = await api.query(window).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'transactions[0]', message: 'must be an object' },
    ]);
  });

  test.each([
    ['to before from', { to: new Date('2020-08-04T05:35:59Z') }, 'to', 'must not be before from'],
    ['invalid from', { from: new Date('x') }, 'from', 'must be a valid date'],
    ['negative offset', { offset: -1 }, 'offset', 'must be at least 0'],
    ['fractional offset', { offset: 1.5 }, 'offset', 'must be an integer'],
    ['short shortCode', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.query({ ...window, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });
});
