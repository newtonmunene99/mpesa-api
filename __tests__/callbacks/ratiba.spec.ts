import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseRatibaCallback } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

// The portal samples, as shown: success in camelCase, failure in PascalCase. The sandbox
// refused the probe (see ratiba-create.json), so no live callback has been captured.
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      new URL(`../fixtures/daraja/ratiba-callback-${name}.json`, import.meta.url),
      'utf8',
    ),
  );

const issuesOf = (body: unknown): unknown => {
  try {
    parseRatibaCallback(body);
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as Error).message.startsWith('parseRatibaCallback: ')).toBe(true);
    return (e as ValidationError).issues;
  }
  throw new Error('expected parseRatibaCallback to throw');
};

describe('parseRatibaCallback', () => {
  test('parses the camelCase success sample', () => {
    const body = fixture('success');

    expect(parseRatibaCallback(body)).toEqual({
      resultCode: 0,
      ok: true,
      responseDescription: 'Standing order created successfully',
      responseRefId: '06aae68f-7d5a-4b44-a22d-8aa77126689b',
      requestRefId: '06aae68f-7d5a-4b44-a22d-8aa77126689b',
      standingOrderId: '2571168',
      transactionId: '2571168',
      status: 'ACTIVE',
      data: {
        standingOrderName: 'mpesa_Ratiba_test_Name',
        amount: '500.00',
        issuePaymentReminderUntil: '20280407',
        reminderScheduleId: '2571168',
        firstPaymentReminderDate: '20260807',
        status: 'ACTIVE',
        TransactionID: '2571168',
        ResponseCode: '0',
        Status: 'OKAY',
        Msisdn: '*********867',
      },
      raw: body,
    });
  });

  test('parses the PascalCase failure sample', () => {
    const body = fixture('failure');

    expect(parseRatibaCallback(body)).toEqual({
      resultCode: 1037,
      ok: false,
      responseDescription: 'Error',
      responseRefId: '4dd9b5d9-d738-42ba-9326-2cc99e966000',
      requestRefId: 'c8c2bb31-3b3a-402e-84fc-21ef35161e48',
      transactionId: '0000000000',
      status: 'ERROR',
      data: {
        TransactionID: '0000000000',
        responseCode: '1037',
        Status: 'ERROR',
        Msisdn: '*********149',
      },
      raw: body,
    });
  });

  test('reads a header in one casing with a body in the other', () => {
    const success = fixture('success');
    const failure = fixture('failure');

    const result = parseRatibaCallback({
      responseHeader: success.responseHeader,
      ResponseBody: failure.ResponseBody,
    });

    expect(result).toMatchObject({ resultCode: 0, ok: true, status: 'ERROR' });
  });

  test('accepts a callback without a body', () => {
    const { responseHeader } = fixture('success');

    const result = parseRatibaCallback({ responseHeader });

    expect(result.data).toEqual({});
    expect(result).not.toHaveProperty('standingOrderId');
    expect(result).not.toHaveProperty('transactionId');
    expect(result).not.toHaveProperty('status');
  });

  test('skips malformed entries and keeps values as strings', () => {
    const result = parseRatibaCallback({
      responseHeader: { responseCode: '0' },
      responseBody: {
        responseData: [null, { name: 'amount', value: 500 }, { value: 'orphan' }, { name: 'x' }],
      },
    });

    expect(result.data).toEqual({ amount: '500' });
  });

  test('keeps a __proto__ name as a plain key', () => {
    const body = JSON.parse(
      '{"responseHeader":{"responseCode":"0"},"responseBody":{"responseData":[{"name":"__proto__","value":"x"}]}}',
    ) as unknown;

    const { data } = parseRatibaCallback(body);

    expect(Object.getPrototypeOf(data)).toBeNull();
    expect(Object.keys(data)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  test.each([
    ['a non-object body', 'x', [{ path: 'body', message: 'is required' }]],
    ['no header', {}, [{ path: 'responseHeader', message: 'is required' }]],
    [
      'a header without responseCode',
      { ResponseHeader: { responseDescription: 'Error' } },
      [{ path: 'responseHeader.responseCode', message: 'is required' }],
    ],
  ])('rejects %s', (_, body, issues) => {
    expect(issuesOf(body)).toEqual(issues);
  });
});
