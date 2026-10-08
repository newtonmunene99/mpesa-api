import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { billManagerPaymentResponse, parseBillManagerPayment } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

// The portal's payment push, with its placeholders replaced by the parameter table's sample
// values (see the fixtures README). The sandbox times out on Bill Manager, so no live push.
const fixture = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(new URL('../fixtures/daraja/billmanager-payment.json', import.meta.url), 'utf8'),
  );

const issuesOf = (body: unknown): unknown => {
  try {
    parseBillManagerPayment(body);
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as Error).message.startsWith('parseBillManagerPayment: ')).toBe(true);
    return (e as ValidationError).issues;
  }
  throw new Error('expected parseBillManagerPayment to throw');
};

describe('parseBillManagerPayment', () => {
  test('parses the portal sample', () => {
    const body = fixture();

    expect(parseBillManagerPayment(body)).toEqual({
      transactionId: 'RJB53MYR1N',
      paidAmountCents: 500000,
      msisdn: '254722000000',
      dateCreated: new Date('2021-09-30T21:00:00.000Z'),
      accountReference: 'BC001',
      shortCode: '456545',
      raw: body,
    });
  });

  test('reads numeric values, as the parameter table types them', () => {
    const result = parseBillManagerPayment({
      ...fixture(),
      paidAmount: 50.5,
      msisdn: 254722000000,
      shortCode: 456545,
    });

    expect(result).toMatchObject({
      paidAmountCents: 5050,
      msisdn: '254722000000',
      shortCode: '456545',
    });
  });

  test.each([
    ['a non-object body', null, [{ path: 'body', message: 'is required' }]],
    [
      'an empty object',
      {},
      [
        { path: 'transactionId', message: 'is required' },
        { path: 'paidAmount', message: 'is required' },
        { path: 'dateCreated', message: 'is required' },
      ],
    ],
    [
      'a malformed amount and date',
      { ...fixture(), paidAmount: '{50}', dateCreated: '2021-02-30' },
      [
        { path: 'paidAmount', message: 'must be a number' },
        { path: 'dateCreated', message: 'must be a YYYY-MM-DD date' },
      ],
    ],
  ])('rejects %s', (_, body, issues) => {
    expect(issuesOf(body)).toEqual(issues);
  });

  test('ignores a __proto__ key', () => {
    const body = JSON.parse(
      '{"__proto__":{"polluted":true},"transactionId":"T1","paidAmount":"1","dateCreated":"2021-10-01"}',
    ) as unknown;

    expect(parseBillManagerPayment(body)).toMatchObject({
      transactionId: 'T1',
      paidAmountCents: 100,
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('billManagerPaymentResponse', () => {
  test('is the reply the portal documents, and cannot be changed', () => {
    expect(billManagerPaymentResponse).toEqual({ resmsg: 'Success', rescode: '200' });
    expect(Object.isFrozen(billManagerPaymentResponse)).toBe(true);
  });
});
