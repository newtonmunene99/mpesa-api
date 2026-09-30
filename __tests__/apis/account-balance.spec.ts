import { describe, expect, test } from 'vite-plus/test';
import { accountBalance } from '../../src/apis/account-balance';
import { createContext, createMpesa, type MpesaConfig } from '../../src/client';
import { ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
// Sample acknowledgement from the Daraja portal's Account Balance docs.
const accepted = {
  OriginatorConversationID: '515-5258779-3',
  ConversationID: 'AG_20200123_0000417fed8ed666e976',
  ResponseCode: '0',
  ResponseDescription: 'Accept the service request successfully',
};

function setup(responses: FakeResponse[], extra: Partial<MpesaConfig> = {}) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    initiator: { name: 'testapiuser', securityCredential: 'CRED==' },
    fetch,
    ...extra,
  });
  return { api: accountBalance(ctx), calls };
}

const input = {
  partyA: 600000,
  resultUrl: 'https://example.com/balance/result',
  queueTimeoutUrl: 'https://example.com/balance/timeout',
};

describe('accountBalance.query', () => {
  test('posts the documented request', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    const res = await api.query(input);

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/accountbalance/v1/query',
      headers: { authorization: 'Bearer tok' },
    });
    expect(calls[1]?.body).toEqual({
      Initiator: 'testapiuser',
      SecurityCredential: 'CRED==',
      CommandID: 'AccountBalance',
      PartyA: 600000,
      IdentifierType: '4',
      Remarks: 'Account balance',
      QueueTimeOutURL: 'https://example.com/balance/timeout',
      ResultURL: 'https://example.com/balance/result',
    });
    expect(res).toEqual({
      conversationId: 'AG_20200123_0000417fed8ed666e976',
      originatorConversationId: '515-5258779-3',
      responseCode: '0',
      responseDescription: 'Accept the service request successfully',
      raw: accepted,
    });
  });

  test('reports every invalid field without calling Daraja', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .query({
        partyA: '',
        resultUrl: '/relative',
        queueTimeoutUrl: input.queueTimeoutUrl,
        remarks: 'r'.repeat(101),
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([
      { path: 'partyA', message: 'must be a 5 to 9 digit shortcode' },
      { path: 'resultUrl', message: 'must be an absolute URL' },
      { path: 'remarks', message: 'must be at most 100 characters' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('requires an initiator', async () => {
    const { api } = setup([], { initiator: undefined });

    await expect(api.query(input)).rejects.toThrow('accountBalance.query: initiator is required');
  });

  test('is available on the client', () => {
    const { fetch } = fakeFetch([]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'k',
      consumerSecret: 's',
      fetch,
    });
    expect(typeof mpesa.accountBalance.query).toBe('function');
  });
});

describe('accountBalance.query empty optionals', () => {
  test('defaults empty remarks', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.query({ ...input, remarks: '' });

    expect(calls[1]?.body).toMatchObject({ Remarks: 'Account balance' });
  });
});
