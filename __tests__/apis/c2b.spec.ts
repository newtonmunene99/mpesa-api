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
