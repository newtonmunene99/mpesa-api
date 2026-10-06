import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseResult } from '../../src/callbacks';
import { ValidationError } from '../../src/core/errors';

const fixture = (name: string): Record<string, Record<string, unknown>> =>
  JSON.parse(readFileSync(new URL(`../fixtures/daraja/${name}`, import.meta.url), 'utf8'));

const issuesOf = (body: unknown): unknown => {
  try {
    parseResult(body);
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as Error).message.startsWith('parseResult: ')).toBe(true);
    return (e as ValidationError).issues;
  }
  throw new Error('expected parseResult to throw');
};

const minimal = {
  ResultType: 0,
  ResultCode: 0,
  OriginatorConversationID: 'o',
  ConversationID: 'c',
};

describe('parseResult', () => {
  test('parses the documented B2C success', () => {
    const body = fixture('b2c-result-success.json');

    expect(parseResult(body)).toEqual({
      resultType: 0,
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      ok: true,
      originatorConversationId: '53e3-4aa8-9fe0-8fb5e4092cdd3533373',
      conversationId: 'AG_20240706_2010364430d9bbdaf872',
      transactionId: 'SG632NMUAB',
      parameters: {
        TransactionAmount: 10,
        TransactionReceipt: 'SG632NMUAB',
        ReceiverPartyPublicName: '254705912645 - NICHOLAS JOHN SONGOK',
        TransactionCompletedDateTime: new Date('2024-07-06T19:48:52Z'),
        B2CUtilityAccountAvailableFunds: 8959269.6,
        B2CWorkingAccountAvailableFunds: 1199371,
        B2CRecipientIsRegisteredCustomer: 'Y',
        B2CChargesPaidAccountAvailableFunds: -1980,
      },
      referenceData: {
        QueueTimeoutURL: 'https://internalsandbox.safaricom.co.ke/mpesa/b2cresults/v1/submit',
      },
      raw: body,
    });
  });

  test('parses the documented B2C failure with no parameters', () => {
    const result = parseResult(fixture('b2c-result-failure.json'));

    expect(result).toMatchObject({
      resultCode: 2001,
      resultDesc: 'The initiator information is invalid.',
      ok: false,
      transactionId: 'SG722NMVXQ',
      parameters: {},
    });
  });

  test('parses a transaction status result, skipping keys without a Value', () => {
    const body = fixture('status-result-partial.json');
    body.Result!.ResultCode = 0;

    const result = parseResult(body);

    expect(result.ok).toBe(true);
    expect(result.parameters).toEqual({
      DebitAccountType: 'Utility Account',
      DebitPartyCharges: 'Fee For B2C Payment|KES|22.40',
      ReasonType: 'Business Payment to Customer via API',
      TransactionStatus: 'Completed',
      FinalisedTime: new Date('2018-02-23T02:41:12Z'),
      Amount: '300',
      ConversationID: 'AG_20180223_000041b09c22e613d6c9',
      ReceiptNo: 'MBN31H462N',
    });
    expect(result.referenceData).toEqual({});
  });

  test('parses an Account Balance result whose codes are strings', () => {
    const result = parseResult(fixture('balance-result.json'));

    expect(result).toMatchObject({ resultType: 0, resultCode: 0, ok: true });
    expect(result.parameters.BOCompletedTime).toEqual(new Date('2020-01-09T09:57:10Z'));
    expect(result.parameters.AccountBalance).toMatch(/^Working Account\|KES\|700000\.00/);
  });

  test('parses a reversal success with a numeric completion time', () => {
    const result = parseResult(fixture('reversal-result-success.json'));

    expect(result.ok).toBe(true);
    expect(result.parameters).toMatchObject({
      DebitAccountBalance: 'Utility Account|KES|7722179.62|7722179.62|0.00|0.00',
      Amount: 1,
      TransCompletedTime: new Date('2021-11-14T10:27:11Z'),
      OriginalTransactionID: 'SKC82PACB8',
      Charge: 0,
    });
  });

  test('keeps a non-numeric reversal result code as a string', () => {
    const result = parseResult(fixture('reversal-result-failure.json'));

    expect(result.resultCode).toBe('R000002');
    expect(result.ok).toBe(false);
  });

  test('accepts a single ResultParameter and a ReferenceItem array', () => {
    const result = parseResult({
      Result: {
        ...minimal,
        ResultParameters: { ResultParameter: { Key: 'Amount', Value: 5 } },
        ReferenceData: {
          ReferenceItem: [
            { Key: 'A', Value: 'a' },
            { Key: 'B', Value: 2 },
          ],
        },
      },
    });

    expect(result.parameters).toEqual({ Amount: 5 });
    expect(result.referenceData).toEqual({ A: 'a', B: '2' });
    expect(result.transactionId).toBe('');
    expect(result.resultDesc).toBe('');
  });

  test('keeps unknown keys and drops non-primitive values from parameters', () => {
    const result = parseResult({
      Result: {
        ...minimal,
        ResultParameters: {
          ResultParameter: [
            { Key: 'NewKey', Value: 'x' },
            { Key: 'Flag', Value: true },
            { Key: 'Nested', Value: { a: 1 } },
          ],
        },
      },
    });

    expect(result.parameters).toEqual({ NewKey: 'x', Flag: 'true' });
  });

  test.each([
    ['a non-object body', 'x', [{ path: 'Result', message: 'is required' }]],
    ['a body without Result', {}, [{ path: 'Result', message: 'is required' }]],
    [
      'missing required keys',
      { Result: { ResultDesc: 'x' } },
      [
        { path: 'Result.ResultType', message: 'is required' },
        { path: 'Result.ResultCode', message: 'is required' },
        { path: 'Result.OriginatorConversationID', message: 'is required' },
        { path: 'Result.ConversationID', message: 'is required' },
      ],
    ],
    [
      'a non-numeric ResultType',
      { Result: { ...minimal, ResultType: 'x' } },
      [{ path: 'Result.ResultType', message: 'must be a number' }],
    ],
    [
      'malformed dates',
      {
        Result: {
          ...minimal,
          ResultParameters: {
            ResultParameter: [
              { Key: 'TransactionCompletedDateTime', Value: '2024-07-06' },
              { Key: 'FinalisedTime', Value: 'soon' },
            ],
          },
        },
      },
      [
        {
          path: 'Result.ResultParameters.TransactionCompletedDateTime',
          message: 'must be a dd.MM.yyyy HH:mm:ss timestamp',
        },
        {
          path: 'Result.ResultParameters.FinalisedTime',
          message: 'must be a YYYYMMDDHHmmss timestamp',
        },
      ],
    ],
  ])('rejects %s', (_, body, issues) => {
    expect(issuesOf(body)).toEqual(issues);
  });
});

describe('parseResult hostile and odd input', () => {
  test('keeps a __proto__ key as an own property without changing the prototype', () => {
    const body: unknown = JSON.parse(
      `{"Result":${JSON.stringify(minimal).slice(0, -1)},"ResultParameters":{"ResultParameter":[{"Key":"__proto__","Value":"x"}]},` +
        '"ReferenceData":{"ReferenceItem":{"Key":"__proto__","Value":"y"}}}}',
    );

    const result = parseResult(body);

    expect(Object.getPrototypeOf(result.parameters)).toBe(Object.prototype);
    expect(Object.hasOwn(result.parameters, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(result.parameters, '__proto__')?.value).toBe('x');
    expect(Object.getOwnPropertyDescriptor(result.referenceData, '__proto__')?.value).toBe('y');
  });

  test('converts InitiatedTime', () => {
    const result = parseResult({
      Result: {
        ...minimal,
        ResultParameters: { ResultParameter: { Key: 'InitiatedTime', Value: 20180223054112 } },
      },
    });

    expect(result.parameters.InitiatedTime).toEqual(new Date('2018-02-23T02:41:12Z'));
  });

  test.each([
    ['an object ResultType', { ResultType: {} }, 'Result.ResultType', 'must be a string or number'],
    ['an array ResultCode', { ResultCode: [] }, 'Result.ResultCode', 'must be a string or number'],
    [
      'an array OriginatorConversationID',
      { OriginatorConversationID: ['o'] },
      'Result.OriginatorConversationID',
      'must be a string or number',
    ],
    ['a blank ConversationID', { ConversationID: '  ' }, 'Result.ConversationID', 'is required'],
  ])('rejects %s', (_, override, path, message) => {
    expect(issuesOf({ Result: { ...minimal, ...override } })).toEqual([{ path, message }]);
  });
});
