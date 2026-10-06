import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { redact } from './helpers/redact';

const b2cSuccess = (): unknown =>
  JSON.parse(
    readFileSync(new URL('./fixtures/daraja/b2c-result-success.json', import.meta.url), 'utf8'),
  );

const param = (body: unknown, key: string): unknown =>
  (
    body as { Result: { ResultParameters: { ResultParameter: { Key: string; Value: unknown }[] } } }
  ).Result.ResultParameters.ResultParameter.find((p) => p.Key === key)?.Value;

describe('redact', () => {
  test('drops secrets and the initiator name', () => {
    expect(
      redact({
        Password: 'p',
        SecurityCredential: 's',
        Authorization: 'Bearer t',
        access_token: 't',
        InitiatorName: 'testapi',
        expires_in: '3599',
      }),
    ).toEqual({
      Password: '<redacted>',
      SecurityCredential: '<redacted>',
      Authorization: '<redacted>',
      access_token: '<redacted>',
      InitiatorName: '<redacted>',
      expires_in: '3599',
    });
  });

  test('masks MSISDNs sent as strings or numbers', () => {
    expect(redact({ a: '254708374149', b: 254111222333, c: '254208374149' })).toEqual({
      a: '254XXXXXXXXX',
      b: '254XXXXXXXXX',
      c: '254208374149',
    });
  });

  test('masks receipt-like and conversation IDs in the B2C sample', () => {
    const out = redact(b2cSuccess()) as { Result: Record<string, unknown> };

    expect(out.Result.TransactionID).toBe('XXXXXXXXXX');
    expect(out.Result.ConversationID).toBe('AG_REDACTED');
    expect(out.Result.OriginatorConversationID).toBe('<redacted-id>');
    expect(redact({ OriginatorCoversationID: '6e06-4e59-9dc9' })).toEqual({
      OriginatorCoversationID: '<redacted-id>',
    });
    expect(redact({ CheckoutRequestID: 'ws_CO_191220191020363925' })).toEqual({
      CheckoutRequestID: 'ws_CO_REDACTED',
    });
  });

  test('masks C2B MSISDN in any format and the free-text BillRefNumber', () => {
    expect(
      redact({ MSISDN: '2547 ***** 126', BillRefNumber: 'Jane account', InvoiceNumber: '' }),
    ).toEqual({ MSISDN: '<redacted>', BillRefNumber: '<redacted>', InvoiceNumber: '' });
    expect(redact({ MSISDN: 'a'.repeat(64) })).toEqual({ MSISDN: '<redacted>' });
  });

  test('masks customer names', () => {
    expect(redact({ FirstName: 'NICHOLAS', MiddleName: '', LastName: 'SONGOK' })).toEqual({
      FirstName: '<name>',
      MiddleName: '',
      LastName: '<name>',
    });
  });

  test('masks sensitive Key/Value and Name/Value entries in the B2C sample', () => {
    const out = redact(b2cSuccess());

    expect(param(out, 'ReceiverPartyPublicName')).toBe('<redacted>');
    expect(param(out, 'TransactionReceipt')).toBe('<redacted>');
    expect(param(out, 'TransactionAmount')).toBe(10);
    expect(param(out, 'TransactionCompletedDateTime')).toBe('06.07.2024 22:48:52');
    expect(
      redact({
        Item: [
          { Name: 'PhoneNumber', Value: 254708374149 },
          { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
          { Name: 'Amount', Value: 1 },
        ],
      }),
    ).toEqual({
      Item: [
        { Name: 'PhoneNumber', Value: '<redacted>' },
        { Name: 'MpesaReceiptNumber', Value: '<redacted>' },
        { Name: 'Amount', Value: 1 },
      ],
    });
  });

  test('leaves the input untouched and keeps codes, amounts and timestamps', () => {
    const input = b2cSuccess();
    const before = JSON.stringify(input);

    const out = redact(input) as { Result: Record<string, unknown> };

    expect(JSON.stringify(input)).toBe(before);
    expect(out.Result).toMatchObject({ ResultType: 0, ResultCode: 0 });
    expect(redact({ Timestamp: '20240706224852', ShortCode: 600997, Code: 'R000002' })).toEqual({
      Timestamp: '20240706224852',
      ShortCode: 600997,
      Code: 'R000002',
    });
  });
});
