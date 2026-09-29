import { describe, expect, test } from 'vite-plus/test';
import { stkPush } from '../../src/apis/stk-push';
import { createContext, createMpesa, type MpesaConfig } from '../../src/client';
import { ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';

const NOW = new Date('2026-09-29T08:30:00.000Z');
const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
const accepted = {
  MerchantRequestID: '2654-4b64-97ff-b827b542881d3130',
  CheckoutRequestID: 'ws_CO_1007202409152617172396192',
  ResponseCode: '0',
  ResponseDescription: 'Success. Request accepted for processing',
  CustomerMessage: 'Success. Request accepted for processing',
};

function setup(responses: FakeResponse[], extra: Partial<MpesaConfig> = {}) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext(
    {
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      passkey: 'pk',
      fetch,
      ...extra,
    },
    () => NOW,
  );
  return { api: stkPush(ctx), calls };
}

const input = {
  shortCode: 174379,
  type: 'paybill' as const,
  amount: 1,
  phoneNumber: '254708374149',
  callbackUrl: 'https://example.com/cb',
  accountReference: 'INV-42',
};

describe('stkPush.send', () => {
  test('sends the documented body with derived password and EAT timestamp', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.send(input);

    expect(calls[1]).toEqual({
      url: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer tok',
        'content-type': 'application/json',
      },
      body: {
        BusinessShortCode: 174379,
        Password: 'MTc0Mzc5cGsyMDI2MDkyOTExMzAwMA==',
        Timestamp: '20260929113000',
        TransactionType: 'CustomerPayBillOnline',
        Amount: 1,
        PartyA: '254708374149',
        PartyB: 174379,
        PhoneNumber: '254708374149',
        CallBackURL: 'https://example.com/cb',
        AccountReference: 'INV-42',
        TransactionDesc: 'Payment',
      },
    });
  });

  test('maps the response to camelCase and keeps the raw body', async () => {
    const { api } = setup([token, { status: 200, body: accepted }]);

    expect(await api.send(input)).toEqual({
      merchantRequestId: '2654-4b64-97ff-b827b542881d3130',
      checkoutRequestId: 'ws_CO_1007202409152617172396192',
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing',
      raw: accepted,
    });
  });

  test('uses CustomerBuyGoodsOnline and the till number for till payments', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.send({ ...input, type: 'till', partyB: 5678901, description: 'Order 7' });

    expect(calls[1]?.body).toMatchObject({
      TransactionType: 'CustomerBuyGoodsOnline',
      PartyB: 5678901,
      TransactionDesc: 'Order 7',
    });
  });

  test('normalises the phone number', async () => {
    const { api, calls } = setup([token, { status: 200, body: accepted }]);

    await api.send({ ...input, phoneNumber: '0708374149' });

    expect(calls[1]?.body).toMatchObject({ PartyA: '254708374149', PhoneNumber: '254708374149' });
  });

  test('reports every invalid field without calling Daraja', async () => {
    const { api, calls } = setup([], { passkey: undefined });

    const error = await api
      .send({
        ...input,
        accountReference: 'x'.repeat(13),
        description: 'x'.repeat(14),
        amount: 0,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([
      { path: 'passkey', message: 'is required in the client config for stkPush' },
      { path: 'amount', message: 'must be at least 1' },
      { path: 'accountReference', message: 'must be at most 12 characters' },
      { path: 'description', message: 'must be at most 13 characters' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test('is available on the client', () => {
    const { fetch } = fakeFetch([]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });
    expect(typeof mpesa.stkPush.send).toBe('function');
  });
});

describe('stkPush.query', () => {
  const queried = {
    ResponseCode: '0',
    ResponseDescription: 'The service request has been accepted successsfully',
    MerchantRequestID: '22205-34066-1',
    CheckoutRequestID: 'ws_CO_13012021093521236557',
    ResultCode: '1032',
    ResultDesc: 'Request cancelled by user',
  };

  test('sends the checkout request ID with derived password and timestamp', async () => {
    const { api, calls } = setup([token, { status: 200, body: queried }]);

    await api.query({ shortCode: 174379, checkoutRequestId: 'ws_CO_13012021093521236557' });

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      headers: { authorization: 'Bearer tok' },
      body: {
        BusinessShortCode: 174379,
        Password: 'MTc0Mzc5cGsyMDI2MDkyOTExMzAwMA==',
        Timestamp: '20260929113000',
        CheckoutRequestID: 'ws_CO_13012021093521236557',
      },
    });
  });

  test('maps the result code to a number and keeps the raw body', async () => {
    const { api } = setup([token, { status: 200, body: queried }]);

    expect(
      await api.query({ shortCode: 174379, checkoutRequestId: 'ws_CO_13012021093521236557' }),
    ).toEqual({
      merchantRequestId: '22205-34066-1',
      checkoutRequestId: 'ws_CO_13012021093521236557',
      responseCode: '0',
      responseDescription: 'The service request has been accepted successsfully',
      resultCode: 1032,
      resultDesc: 'Request cancelled by user',
      raw: queried,
    });
  });

  test('requires the checkout request ID', async () => {
    const { api, calls } = setup([]);

    await expect(api.query({ shortCode: 174379, checkoutRequestId: '' })).rejects.toThrow(
      'stkPush.query: checkoutRequestId is required',
    );
    expect(calls).toHaveLength(0);
  });
});
