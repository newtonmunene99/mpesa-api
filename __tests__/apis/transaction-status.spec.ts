import { describe, expect, test } from 'vite-plus/test';
import { transactionStatus } from '../../src/apis/transaction-status';
import { createContext, createMpesa } from '../../src/client';
import { ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
const accepted = {
  OriginatorConversationID: '1236-7134259-1',
  ConversationID: 'AG_20210709_1234409f86436c583e3f',
  ResponseCode: '0',
  ResponseDescription: 'Accept the service request successfully.',
};

function setup(responses: FakeResponse[]) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    initiator: { name: 'testapi', securityCredential: 'CRED==' },
    fetch,
  });
  return { api: transactionStatus(ctx), calls };
}

const urls = {
  resultUrl: 'https://example.com/status/result',
  queueTimeoutUrl: 'https://example.com/status/timeout',
};

describe('transactionStatus.query', () => {
  test('queries by receipt number with the documented defaults', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    const res = await api.query({ transactionId: 'NEF61H8J60', partyA: 600782, ...urls });

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query',
      headers: { authorization: 'Bearer tok' },
    });
    expect(calls[1]?.body).toEqual({
      Initiator: 'testapi',
      SecurityCredential: 'CRED==',
      CommandID: 'TransactionStatusQuery',
      TransactionID: 'NEF61H8J60',
      PartyA: 600782,
      IdentifierType: '4',
      ResultURL: 'https://example.com/status/result',
      QueueTimeOutURL: 'https://example.com/status/timeout',
      Remarks: 'Transaction status',
    });
    expect(res).toEqual({
      conversationId: 'AG_20210709_1234409f86436c583e3f',
      originatorConversationId: '1236-7134259-1',
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
      raw: accepted,
    });
  });

  test('queries by original conversation ID with a till identifier and occasion', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.query({
      originalConversationId: '7071-4170-a0e5-8345632bad442144258',
      partyA: 600782,
      identifierType: 'till',
      remarks: 'Checking',
      occasion: 'Audit',
      ...urls,
    });

    const body = calls[1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('TransactionID');
    expect(body).toMatchObject({
      OriginalConversationID: '7071-4170-a0e5-8345632bad442144258',
      IdentifierType: '2',
      Remarks: 'Checking',
      Occasion: 'Audit',
    });
  });

  test('normalises PartyA when it is a phone number', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.query({
      transactionId: 'NEF61H8J60',
      partyA: '0708374149',
      identifierType: 'msisdn',
      ...urls,
    });

    expect(calls[1]?.body).toMatchObject({ PartyA: '254708374149', IdentifierType: '1' });
  });

  test('reports every invalid field without calling Daraja', async () => {
    const { api, calls } = setup([]);

    const error = await api
      .query({
        partyA: 600782,
        identifierType: 'x' as never,
        remarks: 'r'.repeat(101),
        ...urls,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([
      { path: 'transactionId', message: 'or originalConversationId is required' },
      { path: 'identifierType', message: "must be 'shortcode', 'till' or 'msisdn'" },
      { path: 'remarks', message: 'must be at most 100 characters' },
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
    expect(typeof mpesa.transactionStatus.query).toBe('function');
  });
});

describe('transactionStatus.query empty optionals', () => {
  test('defaults empty remarks and omits an empty occasion', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.query({
      transactionId: 'NEF61H8J60',
      partyA: 600782,
      remarks: '',
      occasion: '',
      ...urls,
    });

    expect(calls[1]?.body).toMatchObject({ Remarks: 'Transaction status' });
    expect(calls[1]?.body).not.toHaveProperty('Occasion');
  });

  test('reports a missing initiator together with field issues', async () => {
    const { fetch, calls } = fakeFetch([]);
    const api = transactionStatus(
      createContext({ environment: 'sandbox', consumerKey: 'k', consumerSecret: 's', fetch }),
    );

    const error = await api.query({ partyA: 600782, ...urls }).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'initiator', message: 'is required' },
      { path: 'transactionId', message: 'or originalConversationId is required' },
    ]);
    expect(calls).toHaveLength(0);
  });
});
