import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { c2bValidationResponse, parseC2BNotification } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

const fixture = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(new URL('../fixtures/daraja/c2b-v2-notification.json', import.meta.url), 'utf8'),
  );

const issuesOf = (fn: () => unknown, context: string): unknown => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as Error).message.startsWith(`${context}: `)).toBe(true);
    return (e as ValidationError).issues;
  }
  throw new Error(`expected ${context} to throw`);
};

describe('parseC2BNotification', () => {
  test('parses the documented v2 notification', () => {
    const body = fixture();

    expect(parseC2BNotification(body)).toEqual({
      transactionType: 'Pay Bill',
      transId: 'RKL51ZDR4F',
      transTime: new Date('2023-11-21T09:13:25Z'),
      transAmountCents: 500,
      businessShortCode: '600966',
      billRefNumber: 'Sample Transaction',
      invoiceNumber: '',
      orgAccountBalanceCents: 2500,
      thirdPartyTransId: '',
      msisdn: '2547 ***** 126',
      firstName: 'NICHOLAS',
      middleName: '',
      lastName: '',
      raw: body,
    });
  });

  test('omits orgAccountBalanceCents when it is blank, as on validation requests', () => {
    const result = parseC2BNotification({ ...fixture(), OrgAccountBalance: '' });

    expect(result).not.toHaveProperty('orgAccountBalanceCents');
  });

  test('accepts numbers where Daraja usually sends strings', () => {
    const result = parseC2BNotification({
      ...fixture(),
      TransTime: 20231121121325,
      TransAmount: 5,
      BusinessShortCode: 600966,
    });

    expect(result).toMatchObject({ transAmountCents: 500, businessShortCode: '600966' });
    expect(result.transTime).toEqual(new Date('2023-11-21T09:13:25Z'));
  });

  test.each([
    ['a non-object body', [], [{ path: 'body', message: 'is required' }]],
    [
      'missing required keys',
      { FirstName: 'A' },
      [
        { path: 'TransactionType', message: 'is required' },
        { path: 'TransID', message: 'is required' },
        { path: 'TransTime', message: 'is required' },
        { path: 'TransAmount', message: 'is required' },
        { path: 'BusinessShortCode', message: 'is required' },
      ],
    ],
    [
      'malformed values',
      { ...fixture(), TransTime: '2023-11-21', TransAmount: 'five', OrgAccountBalance: 'n/a' },
      [
        { path: 'TransTime', message: 'must be a YYYYMMDDHHmmss timestamp' },
        { path: 'TransAmount', message: 'must be a number' },
        { path: 'OrgAccountBalance', message: 'must be a number' },
      ],
    ],
  ])('rejects %s', (_, body, issues) => {
    expect(issuesOf(() => parseC2BNotification(body), 'parseC2BNotification')).toEqual(issues);
  });

  test.each([
    ['a whitespace-only TransAmount', { TransAmount: '  ' }, 'TransAmount', 'is required'],
    ['an object TransID', { TransID: {} }, 'TransID', 'must be a string or number'],
    ['a padded TransAmount', { TransAmount: ' 5 ' }, 'TransAmount', 'must be a number'],
  ])('rejects %s', (_, override, path, message) => {
    expect(
      issuesOf(() => parseC2BNotification({ ...fixture(), ...override }), 'parseC2BNotification'),
    ).toEqual([{ path, message }]);
  });

  test('omits a whitespace-only OrgAccountBalance', () => {
    expect(parseC2BNotification({ ...fixture(), OrgAccountBalance: ' ' })).not.toHaveProperty(
      'orgAccountBalanceCents',
    );
  });
});

describe('c2bValidationResponse', () => {
  test('accepts a payment', () => {
    expect(c2bValidationResponse.accept()).toEqual({ ResultCode: '0', ResultDesc: 'Accepted' });
  });

  test('accepts a payment with your own transaction ID', () => {
    expect(c2bValidationResponse.accept('INV-42')).toEqual({
      ResultCode: '0',
      ResultDesc: 'Accepted',
      ThirdPartyTransID: 'INV-42',
    });
  });

  test.each(['C2B00011', 'C2B00012', 'C2B00013', 'C2B00014', 'C2B00015', 'C2B00016'] as const)(
    'rejects with %s',
    (code) => {
      expect(c2bValidationResponse.reject(code)).toEqual({
        ResultCode: code,
        ResultDesc: 'Rejected',
      });
    },
  );

  test('sends ThirdPartyTransID as a string', () => {
    expect(c2bValidationResponse.accept(42 as never).ThirdPartyTransID).toBe('42');
  });

  test('refuses an undocumented rejection code', () => {
    expect(
      issuesOf(
        () => c2bValidationResponse.reject('C2B00099' as never),
        'c2bValidationResponse.reject',
      ),
    ).toEqual([{ path: 'code', message: 'must be one of C2B00011 to C2B00016' }]);
  });
});
