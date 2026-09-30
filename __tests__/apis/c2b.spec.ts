import { describe, expect, test } from 'vite-plus/test';
import { c2b } from '../../src/apis/c2b';
import { createContext, createMpesa, type Environment } from '../../src/client';
import { ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };

function setup(responses: FakeResponse[], environment: Environment = 'sandbox') {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({ environment, consumerKey: 'key', consumerSecret: 'secret', fetch });
  return { api: c2b(ctx), calls };
}

const registration = {
  shortCode: 600984,
  confirmationUrl: 'https://example.com/confirm',
  validationUrl: 'https://example.com/validate',
  defaultAction: 'Completed' as const,
};

describe('c2b.registerUrls', () => {
  test('posts the registration to the v2 endpoint', async () => {
    const { api, calls } = setup([
      token,
      {
        status: 200,
        body: { OriginatorCoversationID: 'abc', ResponseCode: '0', ResponseDescription: 'Success' },
      },
    ]);

    await api.registerUrls(registration);

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/c2b/v2/registerurl',
      headers: { authorization: 'Bearer tok' },
      body: {
        ShortCode: '600984',
        ResponseType: 'Completed',
        ConfirmationURL: 'https://example.com/confirm',
        ValidationURL: 'https://example.com/validate',
      },
    });
  });

  test.each([
    ['OriginatorCoversationID', { OriginatorCoversationID: 'abc' }],
    ['OriginatorConversationID', { OriginatorConversationID: 'abc' }],
  ])('maps the response with Daraja spelling %s', async (_, idField) => {
    const body = { ...idField, ResponseCode: '0', ResponseDescription: 'Success' };
    const { api } = setup([token, { status: 200, body }]);

    expect(await api.registerUrls(registration)).toEqual({
      originatorConversationId: 'abc',
      responseCode: '0',
      responseDescription: 'Success',
      raw: body,
    });
  });

  test('enforces https and blocked keywords in production', async () => {
    const { api, calls } = setup([], 'production');

    const error = await api
      .registerUrls({
        ...registration,
        confirmationUrl: 'https://x.com/mpesa/confirm',
        validationUrl: 'http://x.com/validate',
      })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'confirmationUrl', message: 'must not contain the keyword "mpesa"' },
      { path: 'validationUrl', message: 'must use https in production' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('allows http and keywords in sandbox', async () => {
    const { api } = setup([
      token,
      {
        status: 200,
        body: { OriginatorCoversationID: 'abc', ResponseCode: '0', ResponseDescription: 'Success' },
      },
    ]);

    await expect(
      api.registerUrls({ ...registration, confirmationUrl: 'http://x.com/mpesa/confirm' }),
    ).resolves.toMatchObject({ responseCode: '0' });
  });

  test('requires a correctly cased default action', async () => {
    const { api } = setup([]);

    await expect(
      api.registerUrls({ ...registration, defaultAction: 'completed' as never }),
    ).rejects.toThrow("defaultAction must be 'Completed' or 'Cancelled'");
  });

  test('is available on the client', () => {
    const { fetch } = fakeFetch([]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'k',
      consumerSecret: 's',
      fetch,
    });
    expect(typeof mpesa.c2b.registerUrls).toBe('function');
  });
});

describe('c2b.simulate', () => {
  const ok = {
    OriginatorCoversationID: '53e3-4aa8-9fe0-8fb5e4092cdd3405976',
    ResponseCode: '0',
    ResponseDescription: 'Accept the service request successfully.',
  };

  test('simulates a paybill payment on the v2 endpoint', async () => {
    const { api, calls } = setup([token, { status: 200, body: ok }]);

    const res = await api.simulate({
      shortCode: 600984,
      type: 'paybill',
      amount: 1,
      phoneNumber: '254708374149',
      billRefNumber: 'acc',
    });

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/c2b/v2/simulate',
      headers: { authorization: 'Bearer tok' },
      body: {
        ShortCode: 600984,
        CommandID: 'CustomerPayBillOnline',
        Amount: 1,
        Msisdn: 254708374149,
        BillRefNumber: 'acc',
      },
    });
    expect(res).toEqual({
      originatorConversationId: '53e3-4aa8-9fe0-8fb5e4092cdd3405976',
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
      raw: ok,
    });
  });

  test('sends a null bill reference for till payments', async () => {
    const { api, calls } = setup([token, { status: 200, body: ok }]);

    await api.simulate({ shortCode: 600984, type: 'till', amount: 1, phoneNumber: '0708374149' });

    expect(calls[1]?.body).toEqual({
      ShortCode: 600984,
      CommandID: 'CustomerBuyGoodsOnline',
      Amount: 1,
      Msisdn: 254708374149,
      BillRefNumber: null,
    });
  });

  test('requires a bill reference for paybill payments', async () => {
    const { api, calls } = setup([]);

    await expect(
      api.simulate({ shortCode: 600984, type: 'paybill', amount: 1, phoneNumber: '254708374149' }),
    ).rejects.toThrow('c2b.simulate: billRefNumber is required for paybill payments');
    expect(calls).toHaveLength(0);
  });

  test('is only available in sandbox', async () => {
    const { api, calls } = setup([], 'production');

    await expect(
      api.simulate({ shortCode: 600984, type: 'till', amount: 1, phoneNumber: '254708374149' }),
    ).rejects.toThrow(
      'c2b.simulate: environment must be sandbox; Daraja does not support simulation in production',
    );
    expect(calls).toHaveLength(0);
  });
});

describe('c2b.simulate in production', () => {
  test('reports the environment together with field issues', async () => {
    const { api, calls } = setup([], 'production');

    const error = await api
      .simulate({ shortCode: 600984, type: 'paybill', amount: 0, phoneNumber: '254708374149' })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      {
        path: 'environment',
        message: 'must be sandbox; Daraja does not support simulation in production',
      },
      { path: 'amount', message: 'must be at least 1' },
      { path: 'billRefNumber', message: 'is required for paybill payments' },
    ]);
    expect(calls).toHaveLength(0);
  });
});
