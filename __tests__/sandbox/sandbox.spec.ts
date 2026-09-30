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

try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file: the suite is skipped below unless the variables are set another way.
}

const env = process.env;
const enabled = env.MPESA_SANDBOX === '1' && Boolean(env.MPESA_CONSUMER_KEY);
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
    // The portal's Test Credentials page generates a SecurityCredential; a certificate is only
    // needed to check the SDK's own encryption (Verification 5).
    initiator: env.MPESA_SECURITY_CREDENTIAL
      ? { name: need('MPESA_INITIATOR_NAME'), securityCredential: env.MPESA_SECURITY_CREDENTIAL }
      : {
          name: need('MPESA_INITIATOR_NAME'),
          password: need('MPESA_INITIATOR_PASSWORD'),
          certificate: certificateText(),
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

  test('stkPush.query after 20 s (Verification 6)', async () => {
    if (!state.checkoutRequestId) return console.info('[sandbox] no CheckoutRequestID; skipped');
    await sleep(20_000);
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
        resultUrl: url('b2c/result'),
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
        ResultURL: url('b2c/result'),
        Occasion: 'Sandbox',
      }),
    }));
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
