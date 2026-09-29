import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vite-plus/test';
import { Mpesa } from '../../src/index';
import type { CredentialsInterface, HttpServiceResponse } from '../../src/models/interfaces';
import { HttpService } from '../../src/services/http.service';

const ok = <T>(data: T): HttpServiceResponse<T> => ({
  protocol: 'https:',
  hostname: 'sandbox.safaricom.co.ke',
  path: '',
  method: 'POST',
  headers: {},
  statusCode: 200,
  statusMessage: 'OK',
  data,
});

const bearer = { headers: { Authorization: 'Bearer tok' } };

let get: MockInstance<HttpService['get']>;
let post: MockInstance<HttpService['post']>;
let mpesa: Mpesa;

beforeEach(() => {
  get = vi
    .spyOn(HttpService.prototype, 'get')
    .mockResolvedValue(ok({ access_token: 'tok', expires_in: '3599' }));
  post = vi.spyOn(HttpService.prototype, 'post').mockResolvedValue(ok({ ResponseCode: '0' }));
  mpesa = new Mpesa(
    {
      clientKey: 'key',
      clientSecret: 'secret',
      initiatorPassword: 'unused',
      securityCredential: 'SC',
    },
    'sandbox',
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Mpesa', () => {
  test('authenticates with basic auth on the oauth route', async () => {
    await mpesa.c2bRegister({
      ShortCode: 600000,
      ResponseType: 'Completed',
      ConfirmationURL: 'https://confirm',
      ValidationURL: 'https://validate',
    });

    expect(get).toHaveBeenCalledWith('/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: 'Basic a2V5OnNlY3JldA==' },
    });
  });

  test('constructor throws without security credential or initiator password', () => {
    expect(
      () => new Mpesa({ clientKey: 'k', clientSecret: 's' } as CredentialsInterface, 'sandbox'),
    ).toThrow(
      'You must provide either the security credential or initiator password. Both cannot be null',
    );
  });

  test('c2bRegister posts the registration and returns the response body', async () => {
    const res = await mpesa.c2bRegister({
      ShortCode: 600000,
      ResponseType: 'Completed',
      ConfirmationURL: 'https://confirm',
      ValidationURL: 'https://validate',
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/c2b/v1/registerurl',
      {
        ShortCode: 600000,
        ResponseType: 'Completed',
        ConfirmationURL: 'https://confirm',
        ValidationURL: 'https://validate',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('c2bSimulate defaults BillRefNumber to "account"', async () => {
    const res = await mpesa.c2bSimulate({
      ShortCode: 600000,
      CommandID: 'CustomerPayBillOnline',
      Amount: 10,
      Msisdn: 254708374149,
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/c2b/v1/simulate',
      {
        ShortCode: 600000,
        CommandID: 'CustomerPayBillOnline',
        Amount: 10,
        Msisdn: 254708374149,
        BillRefNumber: 'account',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('transactionStatus fills its defaults and the security credential', async () => {
    const res = await mpesa.transactionStatus({
      Initiator: 'api',
      TransactionID: 'OEI2AK4Q16',
      PartyA: '600000',
      IdentifierType: '4',
      ResultURL: 'https://result',
      QueueTimeOutURL: 'https://timeout',
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/transactionstatus/v1/query',
      {
        Initiator: 'api',
        SecurityCredential: 'SC',
        CommandID: 'TransactionStatusQuery',
        TransactionID: 'OEI2AK4Q16',
        PartyA: '600000',
        IdentifierType: '4',
        ResultURL: 'https://result',
        QueueTimeOutURL: 'https://timeout',
        Remarks: 'Transaction Status',
        Occasion: 'TransactionStatus',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('b2c sends Initiator as InitiatorName and defaults Remarks and Occasion', async () => {
    const res = await mpesa.b2c({
      Initiator: 'api',
      CommandID: 'BusinessPayment',
      Amount: 100,
      PartyA: '600000',
      PartyB: '254708374149',
      QueueTimeOutURL: 'https://timeout',
      ResultURL: 'https://result',
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/b2c/v1/paymentrequest',
      {
        InitiatorName: 'api',
        SecurityCredential: 'SC',
        CommandID: 'BusinessPayment',
        Amount: 100,
        PartyA: '600000',
        PartyB: '254708374149',
        Remarks: 'account',
        QueueTimeOutURL: 'https://timeout',
        ResultURL: 'https://result',
        Occasion: 'account',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('lipaNaMpesaOnline derives password and timestamp from the clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T08:30:00.000Z'));

    const res = await mpesa.lipaNaMpesaOnline({
      BusinessShortCode: 174379,
      passKey: 'pk',
      Amount: 1,
      PartyA: '254708374149',
      PartyB: '174379',
      PhoneNumber: '254708374149',
      CallBackURL: 'https://callback',
      AccountReference: 'acc',
    });

    // The trailing space in the TransactionType default is a known bug, pinned until the API rework.
    expect(post).toHaveBeenCalledWith(
      '/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: 174379,
        Password: 'MTc0Mzc5cGsyMDI2MDkyOTA4MzAwMA==',
        Timestamp: '20260929083000',
        TransactionType: 'CustomerPayBillOnline ',
        Amount: 1,
        PartyA: '254708374149',
        PartyB: '174379',
        PhoneNumber: '254708374149',
        CallBackURL: 'https://callback',
        AccountReference: 'acc',
        TransactionDesc: 'Lipa Na Mpesa Online',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('lipaNaMpesaQuery derives password and timestamp from the clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T08:30:00.000Z'));

    const res = await mpesa.lipaNaMpesaQuery({
      BusinessShortCode: 174379,
      passKey: 'pk',
      CheckoutRequestID: 'ws_CO_290920260830000001',
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/stkpushquery/v1/query',
      {
        BusinessShortCode: 174379,
        Password: 'MTc0Mzc5cGsyMDI2MDkyOTA4MzAwMA==',
        Timestamp: '20260929083000',
        CheckoutRequestID: 'ws_CO_290920260830000001',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('reversal fills its defaults and the security credential', async () => {
    const res = await mpesa.reversal({
      Initiator: 'api',
      TransactionID: 'OEI2AK4Q16',
      Amount: 100,
      ReceiverParty: '600000',
      ResultURL: 'https://result',
      QueueTimeOutURL: 'https://timeout',
      CommandID: 'TransactionReversal',
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/reversal/v1/request',
      {
        Initiator: 'api',
        SecurityCredential: 'SC',
        CommandID: 'TransactionReversal',
        TransactionID: 'OEI2AK4Q16',
        Amount: 100,
        ReceiverParty: '600000',
        RecieverIdentifierType: '4',
        ResultURL: 'https://result',
        QueueTimeOutURL: 'https://timeout',
        Remarks: 'Transaction Reversal',
        Occasion: 'TransactionReversal',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });

  test('accountBalance fills its defaults and the security credential', async () => {
    const res = await mpesa.accountBalance({
      Initiator: 'api',
      PartyA: '600000',
      IdentifierType: '4',
      QueueTimeOutURL: 'https://timeout',
      ResultURL: 'https://result',
      CommandID: 'AccountBalance',
    });

    expect(post).toHaveBeenCalledWith(
      '/mpesa/accountbalance/v1/query',
      {
        Initiator: 'api',
        SecurityCredential: 'SC',
        CommandID: 'AccountBalance',
        PartyA: '600000',
        IdentifierType: '4',
        Remarks: 'Account Balance',
        QueueTimeOutURL: 'https://timeout',
        ResultURL: 'https://result',
      },
      bearer,
    );
    expect(res).toEqual({ ResponseCode: '0' });
  });
});
