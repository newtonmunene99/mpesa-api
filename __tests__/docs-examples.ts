/**
 * Every code block in the docs site (`docs/`) and README.md, kept here so `vp check` type-checks
 * them. Never run. `docs-examples.spec.ts` fails when a docs code line is missing from this file.
 * Express, Hono and Redis are declared as minimal stand-ins, so no extra dependencies are needed.
 */
import { readFile } from 'node:fs/promises';
import {
  AuthError,
  billManagerPaymentResponse,
  c2bValidationResponse,
  type CachedToken,
  createMpesa,
  DarajaApiError,
  type Mpesa,
  NetworkError,
  parseBalances,
  parseBillManagerPayment,
  parseC2BNotification,
  parseExpressCheckoutCallback,
  parseRatibaCallback,
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
    callbackUrl: 'https://example.com/payments/stk',
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
    callbackUrl: 'https://example.com/payments/stk',
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
    confirmationUrl: 'https://example.com/payments/c2b/confirmation',
    validationUrl: 'https://example.com/payments/c2b/validation',
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
    resultUrl: 'https://example.com/payments/b2c/result',
    queueTimeoutUrl: 'https://example.com/payments/b2c/timeout',
  });
  // Store this: it identifies the payment in the result and in status queries.
  console.log(payment.originatorConversationId);
}

// B2C: Business To Pochi
export async function payToPochi(mpesa: Mpesa): Promise<void> {
  const pochi = await mpesa.b2c.payToPochi({
    amount: 250,
    shortCode: 600999,
    phoneNumber: '0712345678',
    remarks: 'Supplier payment',
    resultUrl: 'https://example.com/payments/pochi/result',
    queueTimeoutUrl: 'https://example.com/payments/pochi/timeout',
  });
  console.log(pochi.originatorConversationId);
}

// B2B
export async function b2b(mpesa: Mpesa): Promise<void> {
  await mpesa.b2b.payBill({
    amount: 1500,
    shortCode: 600979,
    partyB: 600000,
    accountReference: 'INV-2042',
    requester: '0712345678',
    remarks: 'Electricity for unit G70',
    resultUrl: 'https://example.com/payments/b2b/result',
    queueTimeoutUrl: 'https://example.com/payments/b2b/timeout',
  });
  await mpesa.b2b.buyGoods({
    amount: 800,
    shortCode: 600979,
    partyB: 600000,
    remarks: 'Office supplies',
    resultUrl: 'https://example.com/payments/b2b/result',
    queueTimeoutUrl: 'https://example.com/payments/b2b/timeout',
  });
  await mpesa.b2b.topUpB2C({
    amount: 50000,
    shortCode: 600979,
    partyB: 600997,
    remarks: 'Float for salaries',
    resultUrl: 'https://example.com/payments/b2b/result',
    queueTimeoutUrl: 'https://example.com/payments/b2b/timeout',
  });
  await mpesa.b2b.remitTax({
    amount: 3000,
    shortCode: 888880,
    accountReference: 'PRN1234XN',
    remarks: 'VAT for September',
    resultUrl: 'https://example.com/payments/tax/result',
    queueTimeoutUrl: 'https://example.com/payments/tax/timeout',
  });
}

// B2B: Express CheckOut
export async function expressCheckout(mpesa: Mpesa): Promise<void> {
  const push = await mpesa.b2b.expressCheckout({
    shortCode: 600000,
    merchantTill: 123456,
    amount: 100,
    paymentReference: 'INV-7',
    partnerName: 'Vendor',
    callbackUrl: 'https://example.com/payments/b2b/express',
  });
  console.log(push.requestRefId);

  app.post('/payments/b2b/express', (req, res) => {
    const result = parseExpressCheckoutCallback(req.body);
    if (result.ok) console.log('paid', result.transactionId, result.amountCents);
    else console.log('not paid', result.resultCode, result.resultDesc);
    res.json({ ok: true });
  });
}

// Dynamic QR
export async function dynamicQr(mpesa: Mpesa): Promise<string> {
  const { qrCode } = await mpesa.qr.generate({
    merchantName: 'TEST SUPERMARKET',
    reference: 'Invoice Test',
    amount: 1,
    type: 'buyGoods',
    creditParty: 373132,
  });

  const src = `data:image/png;base64,${qrCode}`;
  return src;
}

// Pull Transactions
export async function pullTransactions(mpesa: Mpesa, from: Date, to: Date): Promise<void> {
  const registration = await mpesa.pullTransactions.register({
    shortCode: 600000,
    nominatedNumber: '0722000000',
    callbackUrl: 'https://example.com/payments/pull',
  });
  console.log(registration.alreadyRegistered);

  const now = new Date();
  const page = await mpesa.pullTransactions.query({
    shortCode: 600000,
    from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    to: now,
  });
  for (const t of page.transactions) console.log(t.transactionId, t.amountCents);

  for await (const t of mpesa.pullTransactions.all({ shortCode: 600000, from, to })) {
    console.log(t.transactionId, t.date, t.amountCents);
  }
}

// M-Pesa Ratiba
export async function standingOrder(mpesa: Mpesa): Promise<void> {
  const order = await mpesa.ratiba.createStandingOrder({
    name: 'Phone loan',
    type: 'paybill',
    shortCode: 600000,
    phoneNumber: '0712345678',
    amount: 500,
    startDate: new Date('2026-11-01'),
    endDate: new Date('2027-10-31'),
    frequency: 'monthly',
    accountReference: 'PHONE-42',
    description: 'Phone loan',
    callbackUrl: 'https://example.com/payments/ratiba',
  });
  console.log(order.requestRefId);

  app.post('/payments/ratiba', (req, res) => {
    const result = parseRatibaCallback(req.body);
    if (result.ok) console.log('order', result.standingOrderId, result.status);
    else console.log('not created', result.resultCode, result.responseDescription);
    res.json({ ok: true });
  });
}

// Lipa na Bonga
export async function bongaPoints(mpesa: Mpesa): Promise<void> {
  const quote = await mpesa.bonga.calculatePoints({ points: 40 });
  console.log(quote.amountCents, quote.rate); // 800, 0.2

  await mpesa.bonga.redeem({
    phoneNumber: '0720776155',
    shortCode: 888880,
    accountNumber: 'INV-7',
    points: quote.points,
    amount: quote.amountCents / 100,
    rate: quote.rate,
  });
}

// Bill Manager
export async function billManagerExamples(mpesa: Mpesa): Promise<Mpesa> {
  const { appKey } = await mpesa.billManager.optIn({
    shortCode: 718003,
    email: 'billing@example.com',
    officialContact: '0710000000',
    sendReminders: true,
    callbackUrl: 'https://example.com/payments/bill-manager',
  });
  console.log(appKey);

  const billing = createMpesa({
    environment: 'production',
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    billManager: { appKey: process.env.MPESA_BILL_MANAGER_APP_KEY! },
  });

  await mpesa.billManager.sendInvoice({
    externalReference: 'INV-2042',
    billedFullName: 'John Doe',
    billedPhoneNumber: '0722000000',
    billedPeriod: 'October 2026',
    invoiceName: 'Water',
    dueDate: new Date('2026-10-31'),
    accountReference: 'G70',
    amount: 800,
    invoiceItems: [
      { itemName: 'Water', amount: 700 },
      { itemName: 'Meter rent', amount: 100 },
    ],
  });

  await mpesa.billManager.cancelInvoice('INV-2042');
  await mpesa.billManager.cancelInvoices(['INV-2043', 'INV-2044']);

  app.post('/payments/bill-manager', (req, res) => {
    const payment = parseBillManagerPayment(req.body);
    console.log(payment.transactionId, payment.paidAmountCents, payment.accountReference);
    res.json(billManagerPaymentResponse);
  });

  await mpesa.billManager.acknowledgePayment({
    paymentDate: new Date('2026-10-20'),
    paidAmount: 800,
    accountReference: 'G70',
    transactionId: 'PJB53MYR1N',
    phoneNumber: '0722000000',
    fullName: 'John Doe',
    invoiceName: 'Water',
    externalReference: 'INV-2042',
  });
  return billing;
}

// Transaction Status
export async function transactionStatus(mpesa: Mpesa): Promise<void> {
  await mpesa.transactionStatus.query({
    originalConversationId: 'the ID returned by b2c.pay',
    partyA: 600999,
    resultUrl: 'https://example.com/payments/status/result',
    queueTimeoutUrl: 'https://example.com/payments/status/timeout',
  });
}

// Account Balance
export async function accountBalance(mpesa: Mpesa): Promise<void> {
  await mpesa.accountBalance.query({
    partyA: 600999,
    resultUrl: 'https://example.com/payments/balance/result',
    queueTimeoutUrl: 'https://example.com/payments/balance/timeout',
  });
}

// Reversal
export async function reversal(mpesa: Mpesa): Promise<void> {
  await mpesa.reversal.request({
    transactionId: 'UIU030F3PZ',
    amount: 100,
    receiverParty: 600984,
    remarks: 'Paid twice',
    resultUrl: 'https://example.com/payments/reversal/result',
    queueTimeoutUrl: 'https://example.com/payments/reversal/timeout',
  });
}

// Callbacks: Express
export function expressCallbacks(): void {
  app.post('/payments/stk', (req, res) => {
    const callback = parseStkCallback(req.body);
    if (callback.ok) {
      void savePayment(callback.checkoutRequestId, callback.metadata?.mpesaReceiptNumber);
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  app.post('/payments/c2b/validation', (req, res) => {
    const payment = parseC2BNotification(req.body);
    res.json(
      accountExists(payment.billRefNumber)
        ? c2bValidationResponse.accept()
        : c2bValidationResponse.reject('C2B00012'),
    );
  });

  app.post('/payments/balance/result', (req, res) => {
    const result = parseResult(req.body);
    const packed = result.parameters.AccountBalance;
    if (result.ok && typeof packed === 'string') console.log(parseBalances(packed));
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });
}

// Callbacks: Hono and other fetch-based runtimes
export function honoCallbacks(): void {
  const app = hono;
  app.post('/payments/b2c/result', async (c) => {
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
      resultUrl: 'https://example.com/payments/balance/result',
      queueTimeoutUrl: 'https://example.com/payments/balance/timeout',
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
  const tokenStore: TokenStore = {
    async get(key) {
      const value = await redis.get(key);
      return value ? (JSON.parse(value) as CachedToken) : undefined;
    },
    async set(key, token) {
      await redis.set(key, JSON.stringify(token), 'PXAT', token.expiresAt);
    },
  };
  return tokenStore;
}
