import { describe, expect, test } from 'vite-plus/test';
import { qr, type QrInput } from '../../src/apis/qr';
import { createContext, createMpesa } from '../../src/client';
import { DarajaApiError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';
import { sandboxCapture } from '../helpers/sandbox-capture';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
const captured = sandboxCapture('qr-generate');
const ok: FakeResponse = { status: captured.status, body: captured.response };

function setup(responses: FakeResponse[]) {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    fetch,
  });
  return { api: qr(ctx), calls };
}

const input: QrInput = {
  merchantName: 'TEST SUPERMARKET',
  reference: 'Invoice Test',
  amount: 1,
  type: 'buyGoods',
  creditParty: 373132,
};

describe('qr.generate', () => {
  test.each([
    ['buyGoods', 373132, 'BG', '373132'],
    ['payBill', '600000', 'PB', '600000'],
    ['agentWithdrawal', 123456, 'WA', '123456'],
    ['sendMoney', '0712345678', 'SM', '254712345678'],
    ['sendToBusiness', '+254 712 345 678', 'SB', '254712345678'],
  ] as const)('sends type %s as TrxCode %s', async (type, creditParty, trxCode, cpi) => {
    const { api, calls } = setup([token, ok]);

    await api.generate({ ...input, type, creditParty });

    expect(calls[1]).toMatchObject({
      url: 'https://sandbox.safaricom.co.ke/mpesa/qrcode/v1/generate',
      headers: { authorization: 'Bearer tok' },
    });
    expect(calls[1]!.body).toEqual({
      MerchantName: 'TEST SUPERMARKET',
      RefNo: 'Invoice Test',
      Amount: 1,
      TrxCode: trxCode,
      CPI: cpi,
      Size: '300',
    });
  });

  test('sends a given size as a string', async () => {
    const { api, calls } = setup([token, ok]);

    await api.generate({ ...input, size: 512 });

    expect(calls[1]!.body).toMatchObject({ Size: '512' });
  });

  test('maps the sandbox response, which has no RequestID', async () => {
    const { api } = setup([token, ok]);

    const res = await api.generate(input);

    expect(res).toEqual({
      qrCode: expect.stringMatching(/^iVBORw0KGgo/),
      responseCode: '00',
      responseDescription: 'The service request is processed successfully.',
      raw: captured.response,
    });
    expect(res).not.toHaveProperty('requestId');
  });

  test('maps RequestID when Daraja sends it, as the portal sample does', async () => {
    const body = {
      ResponseCode: '0',
      RequestID: '16738-27456357-1',
      ResponseDescription: 'QR Code Successfully Generated.',
      QRCode: 'iVBORw0KGgo',
    };
    const { api } = setup([token, { status: 200, body }]);

    expect(await api.generate(input)).toMatchObject({ requestId: '16738-27456357-1' });
  });

  test('rejects a non-zero ResponseCode', async () => {
    const { api } = setup([
      token,
      { status: 200, body: { ResponseCode: '1', ResponseDescription: 'Failed' } },
    ]);

    const error = await api.generate(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ errorCode: '1', errorMessage: 'Failed' });
  });

  test('is wired on createMpesa', async () => {
    const { fetch, calls } = fakeFetch([token, ok]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });

    await mpesa.qr.generate(input);

    expect(calls[1]!.url).toBe('https://sandbox.safaricom.co.ke/mpesa/qrcode/v1/generate');
  });
});

describe('qr.generate validation rules', () => {
  test.each([
    ['amount 0', { amount: 0 }, 'amount', 'must be at least 1'],
    ['fractional amount', { amount: 1.5 }, 'amount', 'must be an integer'],
    ['empty merchantName', { merchantName: '' }, 'merchantName', 'is required'],
    ['empty reference', { reference: '' }, 'reference', 'is required'],
    ['blank merchantName', { merchantName: '   ' }, 'merchantName', 'is required'],
    ['blank reference', { reference: '   ' }, 'reference', 'is required'],
    [
      'inherited type',
      { type: 'toString' as never },
      'type',
      "must be 'buyGoods', 'payBill', 'agentWithdrawal', 'sendMoney' or 'sendToBusiness'",
    ],
    [
      'unknown type',
      { type: 'till' as never },
      'type',
      "must be 'buyGoods', 'payBill', 'agentWithdrawal', 'sendMoney' or 'sendToBusiness'",
    ],
    [
      'non-numeric shortcode',
      { creditParty: 'abc' },
      'creditParty',
      'must be a 5 to 7 digit shortcode',
    ],
    [
      'shortcode for sendMoney',
      { type: 'sendMoney' as const, creditParty: '12345' },
      'creditParty',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    ['size 0', { size: 0 }, 'size', 'must be at least 1'],
    ['fractional size', { size: 1.5 }, 'size', 'must be an integer'],
  ])('%s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.generate({ ...input, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect((error as ValidationError).message).toContain('qr.generate');
    expect(calls).toHaveLength(0);
  });
});
