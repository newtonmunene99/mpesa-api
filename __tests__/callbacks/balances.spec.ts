import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseBalances, parseResult } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/daraja/${name}`, import.meta.url), 'utf8'));

describe('parseBalances', () => {
  test('splits the documented Account Balance value', () => {
    const { parameters } = parseResult(fixture('balance-result.json'));

    expect(parseBalances(parameters.AccountBalance)).toEqual([
      {
        account: 'Working Account',
        currency: 'KES',
        availableCents: 70000000,
        unclearedCents: 70000000,
        reservedCents: 0,
        unreservedCents: 0,
      },
      {
        account: 'Float Account',
        currency: 'KES',
        availableCents: 0,
        unclearedCents: 0,
        reservedCents: 0,
        unreservedCents: 0,
      },
      {
        account: 'Utility Account',
        currency: 'KES',
        availableCents: 22803700,
        unclearedCents: 22803700,
        reservedCents: 0,
        unreservedCents: 0,
      },
      {
        account: 'Charges Paid Account',
        currency: 'KES',
        availableCents: -154000,
        unclearedCents: -154000,
        reservedCents: 0,
        unreservedCents: 0,
      },
      {
        account: 'Organization Settlement Account',
        currency: 'KES',
        availableCents: 0,
        unclearedCents: 0,
        reservedCents: 0,
        unreservedCents: 0,
      },
    ]);
  });

  test("splits a reversal's DebitAccountBalance", () => {
    const { parameters } = parseResult(fixture('reversal-result-success.json'));

    expect(parseBalances(parameters.DebitAccountBalance)).toEqual([
      {
        account: 'Utility Account',
        currency: 'KES',
        availableCents: 772217962,
        unclearedCents: 772217962,
        reservedCents: 0,
        unreservedCents: 0,
      },
    ]);
  });

  test('returns an empty list for an empty value and ignores a trailing separator', () => {
    expect(parseBalances('')).toEqual([]);
    expect(parseBalances('A|KES|1|2|3|4&')).toHaveLength(1);
  });

  test.each([
    ['too few fields', 'A|KES|1|2|3', [{ path: '[0]', message: 'must have 6 fields' }]],
    [
      'non-numeric amounts',
      'A|KES|1|2|3|4&B|KES|x|2|3|y',
      [
        { path: '[1].available', message: 'must be a number' },
        { path: '[1].unreserved', message: 'must be a number' },
      ],
    ],
  ])('rejects %s', (_, value, issues) => {
    const error = (() => {
      try {
        parseBalances(value);
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual(issues);
    expect((error as Error).message.startsWith('parseBalances: ')).toBe(true);
  });

  test.each([
    ['a blank amount', 'A|KES||1|2|3', [{ path: '[0].available', message: 'must be a number' }]],
    ['a hex amount', 'A|KES|0x10|1|2|3', [{ path: '[0].available', message: 'must be a number' }]],
    [
      'three decimal places',
      'A|KES|1.005|1|2|3',
      [{ path: '[0].available', message: 'must have at most 2 decimal places' }],
    ],
    ['a missing value', undefined, [{ path: 'value', message: 'must be a string' }]],
    ['a Date value', new Date(0), [{ path: 'value', message: 'must be a string' }]],
  ])('rejects %s', (_, value, issues) => {
    try {
      parseBalances(value);
      throw new Error('expected parseBalances to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).issues).toEqual(issues);
    }
  });
});
