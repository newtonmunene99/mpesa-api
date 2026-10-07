import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseExpressCheckoutCallback } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

// The portal samples, with their trailing commas removed (see the fixtures README). The
// sandbox refused the probe push, so no live callback has been captured.
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      new URL(`../fixtures/daraja/express-checkout-callback-${name}.json`, import.meta.url),
      'utf8',
    ),
  );

const issuesOf = (body: unknown): unknown => {
  try {
    parseExpressCheckoutCallback(body);
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as Error).message.startsWith('parseExpressCheckoutCallback: ')).toBe(true);
    return (e as ValidationError).issues;
  }
  throw new Error('expected parseExpressCheckoutCallback to throw');
};

describe('parseExpressCheckoutCallback', () => {
  test('parses the successful sample', () => {
    const body = fixture('success');

    expect(parseExpressCheckoutCallback(body)).toEqual({
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      ok: true,
      requestId: '404e1aec-19e0-4ce3-973d-bd92e94c8021',
      amountCents: 7100,
      transactionId: 'RDQ01NFT1Q',
      conversationId: 'AG_20230426_2010434680d9f5a73766',
      status: 'SUCCESS',
      raw: body,
    });
  });

  test('parses the cancelled sample', () => {
    const body = fixture('cancelled');

    expect(parseExpressCheckoutCallback(body)).toEqual({
      resultCode: 4001,
      resultDesc: 'User cancelled transaction',
      ok: false,
      requestId: 'c2a9ba32-9e11-4b90-892c-7bc54944609a',
      amountCents: 7100,
      paymentReference: 'MAndbubry3hi',
      raw: body,
    });
  });

  test('reads a numeric resultCode and amount', () => {
    const result = parseExpressCheckoutCallback({
      ...fixture('success'),
      resultCode: 0,
      amount: 4.35,
    });

    expect(result).toMatchObject({ resultCode: 0, ok: true, amountCents: 435 });
  });

  test('keeps a non-numeric resultCode as a string', () => {
    expect(
      parseExpressCheckoutCallback({ ...fixture('cancelled'), resultCode: 'E01' }),
    ).toMatchObject({ resultCode: 'E01', ok: false });
  });

  test('leaves out blank optional fields', () => {
    const result = parseExpressCheckoutCallback({
      ...fixture('success'),
      transactionId: '',
      status: null,
    });

    expect(result).not.toHaveProperty('transactionId');
    expect(result).not.toHaveProperty('status');
  });

  test.each([
    ['a non-object body', [], [{ path: 'body', message: 'is required' }]],
    [
      'an empty object',
      {},
      [
        { path: 'resultCode', message: 'is required' },
        { path: 'requestId', message: 'is required' },
        { path: 'amount', message: 'is required' },
      ],
    ],
    [
      'a malformed amount',
      { ...fixture('success'), amount: '71.005' },
      [{ path: 'amount', message: 'must have at most 2 decimal places' }],
    ],
    [
      'an object resultCode',
      { ...fixture('success'), resultCode: {} },
      [{ path: 'resultCode', message: 'must be a string or number' }],
    ],
  ])('rejects %s', (_, body, issues) => {
    expect(issuesOf(body)).toEqual(issues);
  });

  test('ignores a __proto__ key', () => {
    const body = JSON.parse(
      '{"__proto__":{"polluted":true},"resultCode":"0","requestId":"r1","amount":"1"}',
    ) as unknown;

    const result = parseExpressCheckoutCallback(body);

    expect(result).toMatchObject({ resultCode: 0, requestId: 'r1', amountCents: 100 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });
});
