/**
 * Every code block in README.md, kept here so `vp check` type-checks them. Never run.
 * Express, Hono and Redis are declared as minimal stand-ins, so no extra dependencies are needed.
 */
import { readFile } from 'node:fs/promises';
import {
  AuthError,
  c2bValidationResponse,
  type CachedToken,
  createMpesa,
  DarajaApiError,
  type Mpesa,
  NetworkError,
  parseBalances,
  parseC2BNotification,
  parseResult,
  parseStkCallback,
  type TokenStore,
  ValidationError,
} from '../src/index';

declare const app: {
  post(
    path: string,
    handler: (req: { body: unknown }, res: { json(body: unknown): void }) => void,
  ): void;
};
declare const hono: {
  post(
    path: string,
    handler: (c: {
      req: { json(): Promise<unknown> };
      json(body: unknown): Response;
    }) => Promise<Response>,
  ): void;
};
declare const redis: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PXAT', at: number): Promise<unknown>;
};
declare function savePayment(id: string, receipt: string | undefined): Promise<void>;
declare function accountExists(account: string): boolean;

// Quick start
export async function quickStart(): Promise<void> {
  const mpesa = createMpesa({
    environment: 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    passkey: process.env.MPESA_PASSKEY!,
  });

  const { checkoutRequestId } = await mpesa.stkPush.send({
    shortCode: 174379,
    type: 'paybill',
    amount: 1,
    phoneNumber: '0708374149',
    callbackUrl: 'https://example.com/mpesa/stk',
    accountReference: 'INV-001',
  });
  console.log(checkoutRequestId);
}

// Certificates: password and certificate (Node)
export async function withCertificate(): Promise<Mpesa> {
  return createMpesa({
    environment: 'production',
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    initiator: {
      name: 'apiuser',
      password: process.env.MPESA_INITIATOR_PASSWORD!,
      certificate: await readFile('certs/ProductionCertificate.cer', 'utf8'),
    },
  });
}

// Certificates: edge runtimes read the PEM from an environment variable
export function withCertificateFromEnv(): Mpesa {
  return createMpesa({
    environment: 'production',
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    initiator: {
      name: 'apiuser',
      password: process.env.MPESA_INITIATOR_PASSWORD!,
      certificate: process.env.MPESA_CERTIFICATE_PEM!,
    },
  });
}

// Certificates: a security credential generated on the Daraja portal
export function withSecurityCredential(): Mpesa {
  return createMpesa({
    environment: 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    initiator: { name: 'testapi', securityCredential: process.env.MPESA_SECURITY_CREDENTIAL! },
  });
}

// M-Pesa Express
export async function stkPush(mpesa: Mpesa): Promise<void> {
  const sent = await mpesa.stkPush.send({
    shortCode: 174379,
    type: 'paybill',
    amount: 100,
    phoneNumber: '0712345678',
    callbackUrl: 'https://example.com/mpesa/stk',
    accountReference: 'INV-001',
    description: 'Invoice 001',
  });

  const status = await mpesa.stkPush.query({
    shortCode: 174379,
    checkoutRequestId: sent.checkoutRequestId,
  });
  if (status.resultCode === 0) console.log('paid');
}

// C2B
export async function c2b(mpesa: Mpesa): Promise<void> {
  await mpesa.c2b.registerUrls({
    shortCode: 600984,
    confirmationUrl: 'https://example.com/mpesa/c2b/confirmation',
    validationUrl: 'https://example.com/mpesa/c2b/validation',
    defaultAction: 'Completed',
  });

  // Sandbox only.
  await mpesa.c2b.simulate({
    shortCode: 600984,
    type: 'paybill',
    amount: 100,
    phoneNumber: '0708374149',
    billRefNumber: 'ACC-001',
  });
}

// B2C
export async function b2c(mpesa: Mpesa): Promise<void> {
  const payment = await mpesa.b2c.pay({
    commandId: 'BusinessPayment',
    amount: 500,
    shortCode: 600999,
    phoneNumber: '0712345678',
    remarks: 'Refund for order 42',
    resultUrl: 'https://example.com/mpesa/b2c/result',
    queueTimeoutUrl: 'https://example.com/mpesa/b2c/timeout',
  });
  // Store this before anything else: it identifies the payment in the result callback
  // and in Transaction Status queries.
  console.log(payment.originatorConversationId);
}

// Transaction Status
export async function transactionStatus(mpesa: Mpesa): Promise<void> {
  await mpesa.transactionStatus.query({
    originalConversationId: 'the ID returned by b2c.pay',
    partyA: 600999,
    resultUrl: 'https://example.com/mpesa/status/result',
    queueTimeoutUrl: 'https://example.com/mpesa/status/timeout',
  });
}

// Account Balance
export async function accountBalance(mpesa: Mpesa): Promise<void> {
  await mpesa.accountBalance.query({
    partyA: 600999,
    resultUrl: 'https://example.com/mpesa/balance/result',
    queueTimeoutUrl: 'https://example.com/mpesa/balance/timeout',
  });
}

// Reversal
export async function reversal(mpesa: Mpesa): Promise<void> {
  await mpesa.reversal.request({
    transactionId: 'UIU030F3PZ',
    amount: 100,
    receiverParty: 600984,
    remarks: 'Paid twice',
    resultUrl: 'https://example.com/mpesa/reversal/result',
    queueTimeoutUrl: 'https://example.com/mpesa/reversal/timeout',
  });
}

// Callbacks: Express
export function expressCallbacks(): void {
  app.post('/mpesa/stk', (req, res) => {
    const callback = parseStkCallback(req.body);
    if (callback.ok) {
      void savePayment(callback.checkoutRequestId, callback.metadata?.mpesaReceiptNumber);
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  app.post('/mpesa/c2b/validation', (req, res) => {
    const payment = parseC2BNotification(req.body);
    res.json(
      accountExists(payment.billRefNumber)
        ? c2bValidationResponse.accept()
        : c2bValidationResponse.reject('C2B00012'),
    );
  });

  app.post('/mpesa/balance/result', (req, res) => {
    const result = parseResult(req.body);
    if (result.ok) console.log(parseBalances(result.parameters.AccountBalance));
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });
}

// Callbacks: Hono and other fetch-based runtimes
export function honoCallbacks(): void {
  hono.post('/mpesa/b2c/result', async (c) => {
    const result = parseResult(await c.req.json());
    if (!result.ok) console.warn(result.resultCode, result.resultDesc);
    return c.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });
}

// Errors
export async function errors(mpesa: Mpesa): Promise<void> {
  try {
    await mpesa.accountBalance.query({
      partyA: 600999,
      resultUrl: 'https://example.com/mpesa/balance/result',
      queueTimeoutUrl: 'https://example.com/mpesa/balance/timeout',
    });
  } catch (error) {
    if (error instanceof ValidationError) console.error(error.issues);
    else if (error instanceof DarajaApiError) console.error(error.errorCode, error.errorMessage);
    else if (error instanceof AuthError) console.error('Check the consumer key and secret');
    else if (error instanceof NetworkError) console.error('Retry later', error.cause);
    else throw error;
  }
}

// Token store: Redis
export function redisTokenStore(): TokenStore {
  return {
    async get(key) {
      const value = await redis.get(key);
      return value ? (JSON.parse(value) as CachedToken) : undefined;
    },
    async set(key, token) {
      await redis.set(key, JSON.stringify(token), 'PXAT', token.expiresAt);
    },
  };
}
