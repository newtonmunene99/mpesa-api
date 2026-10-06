import { describe, expect, test } from 'vite-plus/test';
import { MpesaError, ValidationError } from '../../src/core/errors';
import {
  checkInt,
  checkLength,
  checkPhone,
  checkShortCode,
  checkUrl,
  Issues,
  normalisePhone,
} from '../../src/core/validate';

const collect = (fn: (issues: Issues) => void): string[] => {
  const issues = new Issues();
  fn(issues);
  try {
    issues.throwIfAny('test');
    return [];
  } catch (e) {
    return (e as ValidationError).issues.map((i) => `${i.path}: ${i.message}`);
  }
};

describe('normalisePhone', () => {
  test.each([
    ['0712345678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['254112345678', '254112345678'],
    [' 0712 345 678 ', '254712345678'],
  ])('%s → %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  test.each(['254812345678', '12345', '2547123', '07123456789', 'abc'])('rejects %s', (input) => {
    expect(normalisePhone(input)).toBeUndefined();
  });
});

describe('checks', () => {
  test('checkPhone returns the normalised number or records an issue', () => {
    const issues = new Issues();
    expect(checkPhone(issues, 'phoneNumber', '0708374149')).toBe('254708374149');
    expect(collect((i) => checkPhone(i, 'phoneNumber', '12345'))).toEqual([
      'phoneNumber: must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ]);
  });

  test('checkLength enforces bounds and required', () => {
    expect(
      collect((i) => checkLength(i, 'accountReference', 'x'.repeat(12), { min: 1, max: 12 })),
    ).toEqual([]);
    expect(
      collect((i) => checkLength(i, 'accountReference', 'x'.repeat(13), { min: 1, max: 12 })),
    ).toEqual(['accountReference: must be at most 12 characters']);
    expect(collect((i) => checkLength(i, 'remarks', 'x', { min: 2, max: 100 }))).toEqual([
      'remarks: must be at least 2 characters',
    ]);
    expect(
      collect((i) => checkLength(i, 'remarks', undefined, { min: 2, max: 100, required: true })),
    ).toEqual(['remarks: is required']);
    expect(collect((i) => checkLength(i, 'occasion', undefined, { min: 1, max: 100 }))).toEqual([]);
  });

  test('checkInt enforces integers and range', () => {
    expect(collect((i) => checkInt(i, 'amount', 10, { min: 10, max: 250_000 }))).toEqual([]);
    expect(collect((i) => checkInt(i, 'amount', 1.5, { min: 1 }))).toEqual([
      'amount: must be an integer',
    ]);
    expect(collect((i) => checkInt(i, 'amount', 9, { min: 10, max: 250_000 }))).toEqual([
      'amount: must be at least 10',
    ]);
    expect(collect((i) => checkInt(i, 'amount', 250_001, { min: 10, max: 250_000 }))).toEqual([
      'amount: must be at most 250000',
    ]);
  });

  test('checkUrl requires absolute http(s) URLs and https plus no keywords when asked', () => {
    expect(collect((i) => checkUrl(i, 'callbackUrl', '/cb', { production: false }))).toEqual([
      'callbackUrl: must be an absolute URL',
    ]);
    expect(
      collect((i) => checkUrl(i, 'callbackUrl', 'http://example.com/cb', { production: false })),
    ).toEqual([]);
    expect(
      collect((i) => checkUrl(i, 'callbackUrl', 'http://example.com/cb', { production: true })),
    ).toEqual(['callbackUrl: must use https in production']);
    expect(
      collect((i) =>
        checkUrl(i, 'confirmationUrl', 'https://x.com/mpesa/cb', {
          production: true,
          blockKeywords: true,
        }),
      ),
    ).toEqual(['confirmationUrl: must not contain the keyword "mpesa"']);
    expect(
      collect((i) =>
        checkUrl(i, 'validationUrl', 'https://x.com/Query', {
          production: true,
          blockKeywords: true,
        }),
      ),
    ).toEqual(['validationUrl: must not contain the keyword "query"']);
  });

  test('checkShortCode accepts 5–7 digits', () => {
    expect(collect((i) => checkShortCode(i, 'shortCode', 174379))).toEqual([]);
    expect(collect((i) => checkShortCode(i, 'shortCode', '1234567'))).toEqual([]);
    expect(collect((i) => checkShortCode(i, 'shortCode', 1234))).toEqual([
      'shortCode: must be a 5 to 7 digit shortcode',
    ]);
  });
});

describe('ValidationError', () => {
  test('collects every issue into one error', () => {
    const issues = new Issues();
    issues.add('a', 'is required');
    issues.add('b', 'must be at most 12 characters');
    issues.add('c', 'must be an integer');

    let error: unknown;
    try {
      issues.throwIfAny('stkPush.send');
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(MpesaError);
    const v = error as ValidationError;
    expect(v.name).toBe('ValidationError');
    expect(v.issues).toHaveLength(3);
    expect(v.message).toBe(
      'stkPush.send: a is required; b must be at most 12 characters; c must be an integer',
    );
  });

  test('throwIfAny does nothing without issues', () => {
    expect(() => new Issues().throwIfAny('x')).not.toThrow();
  });
});
