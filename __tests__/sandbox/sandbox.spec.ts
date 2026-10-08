/**
 * Opt-in suite against the live Daraja sandbox. Run with `pnpm test:sandbox` after filling in
 * `.env` (see `.env.example`). It moves sandbox money, so it never runs without MPESA_SANDBOX=1.
 *
 * Each call's response (or Daraja's error body) is redacted and written to
 * `__tests__/fixtures/sandbox/<call>.json`. Only what Daraja sent back is saved, never the
 * request the SDK built, so the fixtures can check the SDK's assumptions.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { createContext, type MpesaConfig } from '../../src/client';
import { parseCertificate } from '../../src/core/certificate';
import { DarajaApiError } from '../../src/core/errors';
import { createMpesa, MemoryTokenStore } from '../../src/index';
import { redact } from '../helpers/redact';

// Read the opt-in flag before loading .env, so a .env that sets MPESA_SANDBOX can never make
// a plain `vp test` call the live sandbox. `pnpm test:sandbox` sets it on the command line.
const optIn = process.env.MPESA_SANDBOX === '1';
if (optIn) {
  try {
    process.loadEnvFile?.('.env');
  } catch {
    // No .env file: the variables must be set another way.
  }
}

const env = process.env;
const enabled = optIn && Boolean(env.MPESA_CONSUMER_KEY);
const OUT = new URL('../fixtures/sandbox/', import.meta.url);

function save(name: string, status: number, response: unknown): void {
  mkdirSync(OUT, { recursive: true });
  const file = new URL(`${name}.json`, OUT);
  writeFileSync(file, `${JSON.stringify(redact({ status, response }), null, 2)}\n`);
}

/** Runs a call and saves Daraja's answer. Daraja errors are recorded, not thrown. */
async function capture<T extends { raw: unknown }>(
  name: string,
  call: () => Promise<T>,
): Promise<T | undefined> {
  try {
    const result = await call();
    save(name, 200, result.raw);
    return result;
  } catch (error) {
    if (!(error instanceof DarajaApiError)) throw error;
    save(name, error.status, error.body);
    console.info(`[sandbox] ${name}: ${error.message}`);
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!enabled)('Daraja sandbox', () => {
  const need = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set; see .env.example`);
    return value;
  };

  const certificateText = (): string | Uint8Array => {
    const bytes = readFileSync(need('MPESA_CERTIFICATE_PATH'));
    const text = new TextDecoder().decode(bytes);
    return text.includes('-----BEGIN') ? text : new Uint8Array(bytes);
  };

  const base = () => need('MPESA_CALLBACK_URL').replace(/\/+$/, '');
  const url = (path: string) => `${base()}/${path}`;
  const org = () => Number(need('MPESA_B2C_SHORTCODE'));
  const msisdn = () => need('MPESA_TEST_MSISDN');
  const receipt = () => env.MPESA_TEST_TRANSACTION_ID || 'OEI2AK4Q16';

  // One store for the client and the raw context: each new token invalidates the previous one.
  const tokenStore = new MemoryTokenStore();
  const config = (): MpesaConfig => ({
    environment: 'sandbox',
    consumerKey: need('MPESA_CONSUMER_KEY'),
    consumerSecret: need('MPESA_CONSUMER_SECRET'),
    passkey: need('MPESA_PASSKEY'),
    // Prefer the password and certificate so the SDK's own encryption is tested
    // (Verification 5); otherwise use a SecurityCredential generated on the portal.
    initiator:
      env.MPESA_INITIATOR_PASSWORD && env.MPESA_CERTIFICATE_PATH
        ? {
            name: need('MPESA_INITIATOR_NAME'),
            password: need('MPESA_INITIATOR_PASSWORD'),
            certificate: certificateText(),
          }
        : {
            name: need('MPESA_INITIATOR_NAME'),
            securityCredential: need('MPESA_SECURITY_CREDENTIAL'),
          },
    tokenStore,
    onWarning: (message) => console.warn(`[sandbox] ${message}`),
  });

  const state: { checkoutRequestId?: string; b2cOriginatorId?: string } = {};

  test.skipIf(!env.MPESA_CERTIFICATE_PATH)('the portal certificate parses (Verification 5)', () => {
    const key = parseCertificate(certificateText());

    expect(key.n.toString(2)).toHaveLength(2048);
    console.info(`[sandbox] certificate notAfter: ${key.notAfter?.toISOString() ?? 'none'}`);
  });

  test('stkPush.send (Verification 4)', async () => {
    const res = await capture('stk-push', () =>
      createMpesa(config()).stkPush.send({
        shortCode: Number(need('MPESA_SHORTCODE')),
        type: 'paybill',
        amount: 1,
        phoneNumber: msisdn(),
        callbackUrl: url('stk'),
        accountReference: 'SDK test',
        description: 'SDK test',
      }),
    );
    state.checkoutRequestId = res?.checkoutRequestId;
  });

  test('stkPush.query after 30 s (Verification 6)', async () => {
    if (!state.checkoutRequestId) return console.info('[sandbox] no CheckoutRequestID; skipped');
    // After 20 s the sandbox still answered 500.001.1001 "The transaction does not Exist".
    await sleep(30_000);
    await capture('stk-query', () =>
      createMpesa(config()).stkPush.query({
        shortCode: Number(need('MPESA_SHORTCODE')),
        checkoutRequestId: state.checkoutRequestId!,
      }),
    );
  });

  test('c2b.registerUrls', async () => {
    await capture('c2b-register', () =>
      createMpesa(config()).c2b.registerUrls({
        shortCode: org(),
        confirmationUrl: url('c2b/confirmation'),
        validationUrl: url('c2b/validation'),
        defaultAction: 'Completed',
      }),
    );
  });

  test('c2b.simulate', async () => {
    await capture('c2b-simulate', () =>
      createMpesa(config()).c2b.simulate({
        shortCode: org(),
        type: 'paybill',
        amount: 1,
        phoneNumber: msisdn(),
        billRefNumber: 'SDK test',
      }),
    );
  });

  test('b2c.pay with Occassion (Verification 2 and 5)', async () => {
    const res = await capture('b2c.occassion', () =>
      createMpesa(config()).b2c.pay({
        commandId: 'BusinessPayment',
        amount: 10,
        shortCode: org(),
        phoneNumber: msisdn(),
        remarks: 'SDK sandbox test',
        resultUrl: url('b2c/occassion/result'),
        queueTimeoutUrl: url('b2c/timeout'),
        occasion: 'Sandbox',
      }),
    );
    state.b2cOriginatorId = res?.originatorConversationId;
  });

  test('b2c with the alternate Occasion spelling (Verification 2)', async () => {
    const ctx = createContext(config());
    const { name, credential } = await ctx.securityCredential('b2c.pay');
    await capture('b2c.occasion', async () => ({
      raw: await ctx.post('/mpesa/b2c/v3/paymentrequest', {
        OriginatorConversationID: crypto.randomUUID(),
        InitiatorName: name,
        SecurityCredential: credential,
        CommandID: 'BusinessPayment',
        Amount: 10,
        PartyA: org(),
        PartyB: msisdn(),
        Remarks: 'SDK sandbox test',
        QueueTimeOutURL: url('b2c/timeout'),
        ResultURL: url('b2c/occasion/result'),
        Occasion: 'Sandbox',
      }),
    }));
  });

  // The disbursement products, sent once each from the sandbox org shortcode (the shortcode
  // the test initiator belongs to). 600000 is the portal's sample receiving shortcode.
  test('b2b.payBill', async () => {
    await capture('b2b-paybill', () =>
      createMpesa(config()).b2b.payBill({
        amount: 10,
        shortCode: org(),
        partyB: 600000,
        accountReference: '353353',
        requester: msisdn(),
        remarks: 'SDK sandbox test',
        resultUrl: url('b2b/paybill/result'),
        queueTimeoutUrl: url('b2b/timeout'),
      }),
    );
  });

  test('b2b.buyGoods', async () => {
    await capture('b2b-buygoods', () =>
      createMpesa(config()).b2b.buyGoods({
        amount: 10,
        shortCode: org(),
        partyB: 600000,
        accountReference: '353353',
        requester: msisdn(),
        remarks: 'SDK sandbox test',
        resultUrl: url('b2b/buygoods/result'),
        queueTimeoutUrl: url('b2b/timeout'),
      }),
    );
  });

  // Tops up 600997, the portal's sample B2C shortcode, from the org shortcode.
  test('b2b.topUpB2C', async () => {
    await capture('b2b-topup', () =>
      createMpesa(config()).b2b.topUpB2C({
        amount: 10,
        shortCode: org(),
        partyB: 600997,
        remarks: 'SDK sandbox test',
        resultUrl: url('b2b/topup/result'),
        queueTimeoutUrl: url('b2b/timeout'),
      }),
    );
  });

  test('b2b.remitTax', async () => {
    await capture('b2b-tax', () =>
      createMpesa(config()).b2b.remitTax({
        amount: 10,
        shortCode: org(),
        accountReference: 'PRN1234XN',
        remarks: 'SDK sandbox test',
        resultUrl: url('b2b/tax/result'),
        queueTimeoutUrl: url('b2b/timeout'),
      }),
    );
  });

  test('b2c.payToPochi', async () => {
    await capture('b2c-pochi', () =>
      createMpesa(config()).b2c.payToPochi({
        amount: 10,
        shortCode: org(),
        phoneNumber: msisdn(),
        remarks: 'SDK sandbox test',
        resultUrl: url('b2c/pochi/result'),
        queueTimeoutUrl: url('b2c/timeout'),
      }),
    );
  });

  // Probe: the portal's Dynamic QR request sample, sent raw to learn what the sandbox answers.
  test('probe: Dynamic QR', async () => {
    const ctx = createContext(config());
    await capture('qr-generate', async () => ({
      raw: await ctx.post(
        '/mpesa/qrcode/v1/generate',
        {
          MerchantName: 'TEST SUPERMARKET',
          RefNo: 'Invoice Test',
          Amount: 1,
          TrxCode: 'BG',
          CPI: '373132',
          Size: '300',
        },
        { success: () => true },
      ),
    }));
  });

  // Probe: the portal's B2B Express CheckOut request sample. The acknowledgement has `code`,
  // not `ResponseCode`, so the default success rule never fires.
  test('probe: B2B Express CheckOut', async () => {
    const ctx = createContext(config());
    await capture('b2b-express-checkout', async () => ({
      raw: await ctx.post('/v1/ussdpush/get-msisdn', {
        primaryShortCode: '000001',
        receiverShortCode: '000002',
        amount: '100',
        paymentRef: 'paymentRef',
        callbackUrl: url('b2b/express/callback'),
        partnerName: 'Vendor',
        RequestRefID: crypto.randomUUID(),
      }),
    }));
  });

  // Probes: Pull Transactions register and query from the sandbox org shortcode. Register
  // answers with ResponseStatus, so any answer is recorded.
  test('probe: Pull Transactions register', async () => {
    const ctx = createContext(config());
    await capture('pull-register', async () => ({
      raw: await ctx.post(
        '/pulltransactions/v1/register',
        {
          ShortCode: String(org()),
          RequestType: 'Pull',
          NominatedNumber: msisdn(),
          CallBackURL: url('pull/callback'),
        },
        { success: () => true },
      ),
    }));
  });

  test('probe: Pull Transactions query', async () => {
    // EAT (UTC+3) as YYYY-MM-DD HH:mm:ss, for the last 24 hours.
    const eat = (date: Date) =>
      new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
    const now = new Date();
    const ctx = createContext(config());
    await capture('pull-query', async () => ({
      raw: await ctx.post(
        '/pulltransactions/v1/query',
        {
          ShortCode: String(org()),
          StartDate: eat(new Date(now.getTime() - 24 * 3_600_000)),
          EndDate: eat(now),
          OffSetValue: '0',
        },
        { success: () => true },
      ),
    }));
  });

  // Probe: M-Pesa Ratiba with the STK shortcode (MPESA_SHORTCODE). The sandbox refuses it, the
  // portal sample's 300584 and the org shortcode 600999 alike, as not issued to the app. It
  // sends a consent STK prompt to the test number. Dates are EAT yyyymmdd, starting tomorrow.
  test('probe: Ratiba create', async () => {
    const ymd = (days: number) =>
      new Date(Date.now() + 3 * 3_600_000 + days * 86_400_000)
        .toISOString()
        .slice(0, 10)
        .replaceAll('-', '');
    const ctx = createContext(config());
    await capture('ratiba-create', async () => ({
      raw: await ctx.post(
        '/standingorder/v1/createStandingOrderExternal',
        {
          StandingOrderName: `SDK probe ${Date.now()}`,
          ReceiverPartyIdentifierType: '4',
          TransactionType: 'Standing Order Pay Bill Ext-Third Party',
          BusinessShortCode: need('MPESA_SHORTCODE'),
          PartyA: msisdn(),
          Amount: '1',
          StartDate: ymd(1),
          EndDate: ymd(31),
          Frequency: '5',
          CustomStoId: crypto.randomUUID(),
          AccountReference: 'SDKPROBE',
          TransactionDesc: 'SDK probe',
          CallBackURL: url('ratiba/callback'),
        },
        { success: () => true },
      ),
    }));
  });

  // Probes: Lipa na Bonga. Redeem sends an STK prompt to the test number; 40 points at 0.2 is
  // KES 8.
  test('probe: Bonga calculate', async () => {
    const ctx = createContext(config());
    await capture('bonga-calculate', async () => ({
      raw: await ctx.post(
        '/v1/lipa/na/bonga/calculate-points',
        { points: '40' },
        { success: () => true },
      ),
    }));
  });

  test('probe: Bonga redeem', async () => {
    const ctx = createContext(config());
    await capture('bonga-redeem', async () => ({
      raw: await ctx.post(
        '/v1/lipa/na/bonga/redeem-paybill',
        {
          msisdn: msisdn(),
          amount: 8,
          bongaPoints: 40,
          conversionRate: 0.2,
          shortCode: String(org()),
          accountNumber: 'SDKPROBE',
        },
        { success: () => true },
      ),
    }));
  });

  // Probes: Bill Manager opt-in on the shared sandbox org shortcode. Another developer may have
  // opted it in already ("Biller already Registered"), so re-runs are expected. An app_key in
  // the answer is a credential: the fixture drops it, and it is written only to the file named
  // by BILLMANAGER_APP_KEY_OUT (a scratch path outside the repo) for the invoicing probes.
  const billManagerOptIn = () => ({
    shortcode: String(org()),
    email: 'sdk-probe@example.com',
    officialContact: `0${msisdn().slice(-9)}`,
    sendReminders: '0',
    callbackurl: url('billmanager/payment'),
  });

  test('probe: Bill Manager opt-in', async () => {
    const ctx = createContext(config());
    const res = await capture('billmanager-optin', async () => ({
      raw: await ctx.post<Record<string, unknown>>(
        '/v1/billmanager-invoice/optin',
        billManagerOptIn(),
        { success: () => true },
      ),
    }));
    const key = (res?.raw as Record<string, unknown> | undefined)?.app_key;
    if (typeof key === 'string' && env.BILLMANAGER_APP_KEY_OUT) {
      writeFileSync(env.BILLMANAGER_APP_KEY_OUT, key);
    }
  });

  test('transactionStatus.query with each ID and both (Verification 3)', async () => {
    const mpesa = createMpesa(config());
    const common = {
      partyA: org(),
      identifierType: 'shortcode' as const,
      resultUrl: url('status/result'),
      queueTimeoutUrl: url('status/timeout'),
    };
    const originalConversationId = state.b2cOriginatorId;
    await capture('status.both', () =>
      mpesa.transactionStatus.query({
        ...common,
        transactionId: receipt(),
        ...(originalConversationId ? { originalConversationId } : {}),
      }),
    );
    await capture('status.transaction-id', () =>
      mpesa.transactionStatus.query({ ...common, transactionId: receipt() }),
    );
    if (originalConversationId) {
      await capture('status.conversation-id', () =>
        mpesa.transactionStatus.query({ ...common, originalConversationId }),
      );
    }
  });

  test('accountBalance.query', async () => {
    await capture('account-balance', () =>
      createMpesa(config()).accountBalance.query({
        partyA: org(),
        identifierType: 'shortcode',
        resultUrl: url('balance/result'),
        queueTimeoutUrl: url('balance/timeout'),
      }),
    );
  });

  test('reversal.request', async () => {
    await capture('reversal', () =>
      createMpesa(config()).reversal.request({
        transactionId: receipt(),
        amount: 1,
        receiverParty: org(),
        remarks: 'SDK sandbox test',
        resultUrl: url('reversal/result'),
        queueTimeoutUrl: url('reversal/timeout'),
      }),
    );
  });
});
