import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseStkCallback } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/daraja/${name}`, import.meta.url), 'utf8'));

const callback = (stkCallback: Record<string, unknown>) => ({ Body: { stkCallback } });

describe('parseStkCallback', () => {
  test('parses the documented successful callback', () => {
    const body = fixture('stk-callback-success.json');

    expect(parseStkCallback(body)).toEqual({
      merchantRequestId: '29115-34620561-1',
      checkoutRequestId: 'ws_CO_191220191020363925',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      ok: true,
      metadata: {
        amount: 1,
        mpesaReceiptNumber: 'NLJ7RT61SV',
        transactionDate: new Date('2019-12-19T07:21:15Z'),
        phoneNumber: '254708374149',
      },
      raw: body,
    });
  });

  test('parses the documented cancelled callback without metadata', () => {
    const result = parseStkCallback(fixture('stk-callback-cancelled.json'));

    expect(result).toMatchObject({
      merchantRequestId: 'f1e2-4b95-a71d-b30d3cdbb7a7942864',
      checkoutRequestId: 'ws_CO_21072024125243250722943992',
      resultCode: 1032,
      resultDesc: 'Request cancelled by user',
      ok: false,
    });
    expect(result).not.toHaveProperty('metadata');
  });

  test('reads Balance, skips items without a Value and keeps a numeric-string code', () => {
    const result = parseStkCallback(
      callback({
        MerchantRequestID: 'm',
        CheckoutRequestID: 'c',
        ResultCode: '0',
        ResultDesc: 'ok',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: '10.50' },
            { Name: 'Balance' },
            { Name: 'MpesaReceiptNumber', Value: 'ABC' },
            { Name: 'Unknown', Value: 'x' },
          ],
        },
      }),
    );

    expect(result.resultCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({ amount: 10.5, mpesaReceiptNumber: 'ABC' });
  });

  test('reads a Balance value when present', () => {
    const result = parseStkCallback(
      callback({
        MerchantRequestID: 'm',
        CheckoutRequestID: 'c',
        ResultCode: 0,
        ResultDesc: 'ok',
        CallbackMetadata: { Item: [{ Name: 'Balance', Value: 250 }] },
      }),
    );

    expect(result.metadata).toEqual({ balance: 250 });
  });

  test('accepts a single metadata item that is not wrapped in an array', () => {
    const result = parseStkCallback(
      callback({
        MerchantRequestID: 'm',
        CheckoutRequestID: 'c',
        ResultCode: 0,
        ResultDesc: 'ok',
        CallbackMetadata: { Item: { Name: 'Amount', Value: 5 } },
      }),
    );

    expect(result.metadata).toEqual({ amount: 5 });
  });

  test.each([
    ['a non-object body', null, [{ path: 'Body.stkCallback', message: 'is required' }]],
    [
      'a body without stkCallback',
      { Body: {} },
      [{ path: 'Body.stkCallback', message: 'is required' }],
    ],
    [
      'missing identifiers and result code',
      callback({ ResultDesc: 'x' }),
      [
        { path: 'Body.stkCallback.MerchantRequestID', message: 'is required' },
        { path: 'Body.stkCallback.CheckoutRequestID', message: 'is required' },
        { path: 'Body.stkCallback.ResultCode', message: 'is required' },
      ],
    ],
    [
      'bad metadata values',
      callback({
        MerchantRequestID: 'm',
        CheckoutRequestID: 'c',
        ResultCode: 0,
        ResultDesc: 'ok',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 'lots' },
            { Name: 'TransactionDate', Value: 2019 },
          ],
        },
      }),
      [
        { path: 'Body.stkCallback.CallbackMetadata.Amount', message: 'must be a number' },
        {
          path: 'Body.stkCallback.CallbackMetadata.TransactionDate',
          message: 'must be a YYYYMMDDHHmmss timestamp',
        },
      ],
    ],
  ])('rejects %s', (_, body, issues) => {
    const error = (() => {
      try {
        parseStkCallback(body);
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual(issues);
    expect((error as Error).message.startsWith('parseStkCallback: ')).toBe(true);
  });
});
