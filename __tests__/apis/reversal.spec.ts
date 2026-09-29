import { describe, expect, test } from 'vite-plus/test';
import { reversal } from '../../src/apis/reversal';
import { createContext, createMpesa, type MpesaConfig } from '../../src/client';
import { ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
// Sample acknowledgement from the Daraja portal's Reversal docs.
const accepted = {
  OriginatorConversationID: 'f1e2-4b95-a71d-b30d3cdbb7a7735297',
  ConversationID: 'AG_20210706_20106e9209f64bebd05b',
  ResponseCode: '0',
  ResponseDescription: 'Accept the service request successfully.',
};

function setup(responses: FakeResponse[], extra: Partial<MpesaConfig> = {}) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    initiator: { name: 'apiop37', securityCredential: 'CRED==' },
    fetch,
    ...extra,
  });
  return { api: reversal(ctx), calls };
}

const input = {
  transactionId: 'PDU91HIVIT',
  amount: 200,
  receiverParty: 603021,
  remarks: 'Payment reversal',
  resultUrl: 'https://example.com/reversal/result',
  queueTimeoutUrl: 'https://example.com/reversal/timeout',
};

describe('reversal.request', () => {
  test('posts exactly the documented fields', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    const res = await api.request(input);

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/reversal/v1/request',
      headers: { authorization: 'Bearer tok' },
    });
    expect(calls[1]?.body).toEqual({
      Initiator: 'apiop37',
      SecurityCredential: 'CRED==',
      CommandID: 'TransactionReversal',
      TransactionID: 'PDU91HIVIT',
      Amount: 200,
      ReceiverParty: 603021,
      RecieverIdentifierType: '11',
      ResultURL: 'https://example.com/reversal/result',
      QueueTimeOutURL: 'https://example.com/reversal/timeout',
      Remarks: 'Payment reversal',
    });
    expect(res).toEqual({
      conversationId: 'AG_20210706_20106e9209f64bebd05b',
      originatorConversationId: 'f1e2-4b95-a71d-b30d3cdbb7a7735297',
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
      raw: accepted,
    });
  });

  test('reports every invalid field without calling Daraja', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .request({
        ...input,
        transactionId: '',
        amount: 0,
        receiverParty: '' as never,
        queueTimeoutUrl: '/timeout',
        remarks: 'x',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([
      { path: 'transactionId', message: 'is required' },
      { path: 'amount', message: 'must be at least 1' },
      { path: 'receiverParty', message: 'must be a 5 to 9 digit shortcode' },
      { path: 'queueTimeoutUrl', message: 'must be an absolute URL' },
      { path: 'remarks', message: 'must be at least 2 characters' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('requires remarks', async () => {
    const { api } = setup([]);

    await expect(api.request({ ...input, remarks: undefined as never })).rejects.toThrow(
      'reversal.request: remarks is required',
    );
  });

  test('requires an initiator', async () => {
    const { api } = setup([], { initiator: undefined });

    await expect(api.request(input)).rejects.toThrow('reversal.request: initiator is required');
  });

  test('is available on the client', () => {
    const { fetch } = fakeFetch([]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'k',
      consumerSecret: 's',
      fetch,
    });
    expect(typeof mpesa.reversal.request).toBe('function');
  });
});
