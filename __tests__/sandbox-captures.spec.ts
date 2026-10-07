/**
 * Pins the SDK's response mapping to what the Daraja sandbox actually sent on 2026-09-30
 * (redacted captures in __tests__/fixtures/sandbox/, written by `pnpm test:sandbox`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseResult, parseStkCallback } from '../src/callbacks';
import { createMpesa } from '../src/client';
import { fakeFetch, type FakeResponse } from './helpers/fake-fetch';
import { sandboxCapture } from './helpers/sandbox-capture';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };
const certificate = readFileSync(
  new URL('./fixtures/certs/test-cert.pem', import.meta.url),
  'utf8',
);

function client(name: string) {
  const { status, response } = sandboxCapture(name);
  const { fetch } = fakeFetch([token, { status, body: response }]);
  return createMpesa({
    environment: 'sandbox',
    consumerKey: 'key',
    consumerSecret: 'secret',
    passkey: 'passkey',
    initiator: { name: 'testapi', password: 'Safaricom999!*!', certificate },
    fetch,
  });
}

const urls = { resultUrl: 'https://example.com/r', queueTimeoutUrl: 'https://example.com/t' };
const accepted = {
  conversationId: 'AG_REDACTED',
  originatorConversationId: '<redacted-id>',
  responseCode: '0',
  responseDescription: 'Accept the service request successfully.',
};

describe('sandbox captures', () => {
  test('stkPush.send acknowledgement (stk-push.json)', async () => {
    const res = await client('stk-push').stkPush.send({
      shortCode: 174379,
      type: 'paybill',
      amount: 1,
      phoneNumber: '0708374149',
      callbackUrl: 'https://example.com/stk',
      accountReference: 'SDK test',
    });

    expect(res).toMatchObject({
      checkoutRequestId: 'ws_CO_REDACTED',
      responseCode: '0',
      customerMessage: 'Success. Request accepted for processing',
    });
    expect(res.merchantRequestId).not.toBe('');
  });

  // Verification 6: the query answers ResultCode as a string, mapped to a number.
  test('stkPush.query response fields (stk-query.json)', async () => {
    const res = await client('stk-query').stkPush.query({
      shortCode: 174379,
      checkoutRequestId: 'ws_CO_REDACTED',
    });

    expect(res).toMatchObject({
      checkoutRequestId: 'ws_CO_REDACTED',
      responseCode: '0',
      responseDescription: 'The service request has been accepted successfully',
      resultCode: 1037,
      resultDesc: 'No response from user.',
    });
  });

  test('the STK callback parses (callbacks/stk.json)', () => {
    const body: unknown = JSON.parse(
      readFileSync(new URL('./fixtures/sandbox/callbacks/stk.json', import.meta.url), 'utf8'),
    );

    expect(parseStkCallback(body)).toMatchObject({ resultCode: 1037, ok: false });
  });

  // The shared sandbox initiator was locked on every B2C shortcode on 2026-09-30.
  test('a live B2C failure result parses (callbacks/b2c-result-locked.json)', () => {
    const body: unknown = JSON.parse(
      readFileSync(
        new URL('./fixtures/sandbox/callbacks/b2c-result-locked.json', import.meta.url),
        'utf8',
      ),
    );

    expect(parseResult(body)).toMatchObject({
      resultType: 0,
      resultCode: 8006,
      resultDesc: 'The security credential is locked.',
      ok: false,
      transactionId: 'XXXXXXXXXX',
      parameters: {},
      referenceData: {
        QueueTimeoutURL: 'https://internalsandbox.safaricom.co.ke/mpesa/b2cresults/v1/submit',
      },
    });
  });

  // Live result callbacks from 2026-10-06, all failures: the shared sandbox initiator was
  // still locked, and the receipt sent was the docs' placeholder.
  const result = (name: string): unknown =>
    JSON.parse(
      readFileSync(new URL(`./fixtures/sandbox/callbacks/${name}.json`, import.meta.url), 'utf8'),
    );

  // A real STK payment approved on a phone in the sandbox, 2026-10-06.
  test('a live successful STK callback parses (callbacks/stk-success.json)', () => {
    const callback = parseStkCallback(result('stk-success'));

    expect(callback).toMatchObject({
      resultCode: 0,
      ok: true,
      checkoutRequestId: 'ws_CO_REDACTED',
    });
    // Balance arrives with no Value, so it is left out; Amount 1 is 100 cents.
    expect(callback.metadata).toEqual({
      amountCents: 100,
      mpesaReceiptNumber: '<redacted>',
      transactionDate: new Date('2026-10-06T06:52:33Z'),
      phoneNumber: '<redacted>',
    });
  });

  test('a failed Account Balance result still carries parameters (balance-result-locked.json)', () => {
    expect(parseResult(result('balance-result-locked'))).toMatchObject({
      resultCode: 8006,
      ok: false,
      parameters: {
        ActionType: 'AccountBalance',
        ErrorMsg: 'API Password is locked. ',
        BOCompletedTime: new Date('2026-10-06T06:32:45Z'),
      },
      // The ReferenceItem has a Key but no Value.
      referenceData: {},
    });
  });

  test('a Transaction Status result for an unknown receipt (status-result-not-found.json)', () => {
    expect(parseResult(result('status-result-not-found'))).toMatchObject({
      resultCode: 2032,
      resultDesc: 'The transaction receipt number does not exist.',
      ok: false,
      parameters: {},
    });
  });

  test('a Reversal result keeps its non-numeric code (reversal-result-invalid.json)', () => {
    expect(parseResult(result('reversal-result-invalid'))).toMatchObject({
      resultCode: 'R000002',
      resultDesc: 'The OriginalTransactionID is invalid.',
      ok: false,
      referenceData: {
        QueueTimeoutURL: 'https://internalsandbox.safaricom.co.ke/mpesa/reversalresults/v1/submit',
      },
    });
  });

  // Verification 2 (acknowledgement only; the result callbacks never arrived).
  test.each(['b2c.occassion', 'b2c.occasion'])('%s is acknowledged', async (name) => {
    const res = await client(name).b2c.pay({
      commandId: 'BusinessPayment',
      amount: 10,
      shortCode: 600978,
      phoneNumber: '0708374149',
      remarks: 'SDK sandbox test',
      ...urls,
    });

    expect(res).toMatchObject(accepted);
  });

  // Verification 3: each ID alone and both together are accepted.
  test.each([
    ['status.both', { transactionId: 'OEI2AK4Q16', originalConversationId: 'id' }],
    ['status.transaction-id', { transactionId: 'OEI2AK4Q16' }],
    ['status.conversation-id', { originalConversationId: 'id' }],
  ])('%s is acknowledged', async (name, ids) => {
    const res = await client(name).transactionStatus.query({ partyA: 600978, ...ids, ...urls });

    expect(res).toMatchObject(accepted);
  });

  test('accountBalance.query acknowledgement (account-balance.json)', async () => {
    await expect(
      client('account-balance').accountBalance.query({ partyA: 600978, ...urls }),
    ).resolves.toMatchObject(accepted);
  });

  test('reversal.request acknowledgement (reversal.json)', async () => {
    await expect(
      client('reversal').reversal.request({
        transactionId: 'OEI2AK4Q16',
        amount: 1,
        receiverParty: 600978,
        remarks: 'SDK sandbox test',
        ...urls,
      }),
    ).resolves.toMatchObject(accepted);
  });

  // Disbursement calls from the sandbox org shortcode on 2026-10-07 (pnpm test:sandbox).
  const b2bInput = { amount: 10, shortCode: 600999, remarks: 'SDK sandbox test', ...urls };

  test.each([
    [
      'b2b-paybill',
      (m: ReturnType<typeof client>) =>
        m.b2b.payBill({ ...b2bInput, partyB: 600000, accountReference: '353353' }),
    ],
    [
      'b2b-buygoods',
      (m: ReturnType<typeof client>) => m.b2b.buyGoods({ ...b2bInput, partyB: 600000 }),
    ],
    [
      'b2b-topup',
      (m: ReturnType<typeof client>) => m.b2b.topUpB2C({ ...b2bInput, partyB: 600997 }),
    ],
    [
      'b2b-tax',
      (m: ReturnType<typeof client>) =>
        m.b2b.remitTax({ ...b2bInput, accountReference: 'PRN1234XN' }),
    ],
  ])('%s acknowledgement', async (name, call) => {
    await expect(call(client(name))).resolves.toMatchObject(accepted);
  });

  // The sandbox app has no Business To Pochi product: the gateway refuses the token. The SDK
  // treats 401.002.01 as an expired token, refreshes once and gets the same answer.
  test('b2c.payToPochi without the product enabled (b2c-pochi.json)', async () => {
    const { status, response } = sandboxCapture('b2c-pochi');
    const refused = { status, body: response };
    const { fetch, calls } = fakeFetch([token, refused, token, refused]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      initiator: { name: 'testapi', password: 'Safaricom999!*!', certificate },
      fetch,
    });

    const error = await mpesa.b2c
      .payToPochi({ ...b2bInput, phoneNumber: '0708374149' })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 401, errorCode: '401.002.01' });
    expect(calls).toHaveLength(4);
  });

  // Every B2B result was 8006: the shared sandbox initiator is still locked. Buy Goods and
  // Top Up results carry no BillReferenceNumber, and each ends with a valueless Occassion.
  test.each([
    ['b2b-paybill-result-locked', { BillReferenceNumber: '353353' }],
    ['b2b-buygoods-result-locked', {}],
    ['b2b-topup-result-locked', {}],
    ['b2b-tax-result-locked', { BillReferenceNumber: 'PRN1234XN' }],
  ])('a live %s result parses', (name, reference) => {
    const parsed = parseResult(result(name));

    expect(parsed).toMatchObject({
      resultCode: 8006,
      ok: false,
      resultDesc: 'The security credential is locked.',
      parameters: {},
    });
    expect(parsed.referenceData).toEqual({
      ...reference,
      QueueTimeoutURL: 'https://internalsandbox.safaricom.co.ke/mpesa/b2bresults/v1/submit',
    });
  });
});
