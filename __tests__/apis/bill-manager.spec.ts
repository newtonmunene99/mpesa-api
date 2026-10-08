import { describe, expect, test } from 'vite-plus/test';
import { billManager } from '../../src/apis/bill-manager';
import { createContext, createMpesa, type Environment } from '../../src/client';
import { DarajaApiError, ValidationError } from '../../src/core/errors';
import { fakeFetch, type FakeResponse } from '../helpers/fake-fetch';
import { sandboxCapture } from '../helpers/sandbox-capture';

const token: FakeResponse = { status: 200, body: { access_token: 'tok', expires_in: 3599 } };

function setup(responses: FakeResponse[], environment: Environment = 'sandbox') {
  const { fetch, calls } = fakeFetch(responses);
  const ctx = createContext({ environment, consumerKey: 'key', consumerSecret: 'secret', fetch });
  return { api: billManager(ctx), calls };
}

const base = 'https://sandbox.safaricom.co.ke/v1/billmanager-invoice';

// The opt-in response sample from the Bill Manager portal page.
const optedIn = { app_key: 'AG_2376487236_126732989KJ', resmsg: 'Success', rescode: '200' };
const optIn = {
  shortCode: 718003,
  email: 'billing@example.com',
  officialContact: '+254 710 000 000',
  sendReminders: true,
  callbackUrl: 'https://example.com/payments/bill-manager',
};

describe('billManager.optIn', () => {
  test('posts the opt-in without an initiator and returns the app key', async () => {
    const { api, calls } = setup([token, { status: 200, body: optedIn }]);

    const res = await api.optIn(optIn);

    expect(calls[1]!.url).toBe(`${base}/optin`);
    expect(calls[1]!.body).toEqual({
      shortcode: '718003',
      email: 'billing@example.com',
      officialContact: '0710000000',
      sendReminders: '1',
      callbackurl: 'https://example.com/payments/bill-manager',
    });
    expect(res).toEqual({
      appKey: 'AG_2376487236_126732989KJ',
      message: 'Success',
      code: '200',
      raw: optedIn,
    });
  });

  test('sends sendReminders false as "0", and an 01… number as 01…', async () => {
    const { api, calls } = setup([token, { status: 200, body: optedIn }]);

    await api.optIn({ ...optIn, sendReminders: false, officialContact: '254110000000' });

    expect(calls[1]!.body).toMatchObject({ sendReminders: '0', officialContact: '0110000000' });
  });

  test('leaves appKey out when Daraja sends none', async () => {
    const { api } = setup([token, { status: 200, body: { resmsg: 'Success', rescode: '200' } }]);

    expect(await api.optIn(optIn)).not.toHaveProperty('appKey');
  });

  test('rejects a 2xx answer whose rescode is not 200', async () => {
    const body = {
      Status_Message: 'Biller already Registered',
      resmsg: 'Action Forbidden',
      rescode: '409',
    };
    const { api } = setup([token, { status: 200, body }]);

    const error = await api.optIn(optIn).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({
      status: 200,
      errorCode: '409',
      errorMessage: 'Biller already Registered',
      body,
    });
  });

  test('falls back to resmsg when a 2xx refusal has no Status_Message', async () => {
    const { api } = setup([token, { status: 200, body: { resmsg: 'Conflict', rescode: '409' } }]);

    await expect(api.optIn(optIn)).rejects.toMatchObject({
      errorCode: '409',
      errorMessage: 'Conflict',
    });
  });

  test('rejects the same answer sent as HTTP 409', async () => {
    const body = { resmsg: 'Action Forbidden', rescode: '409' };
    const { api } = setup([token, { status: 409, body }]);

    await expect(api.optIn(optIn)).rejects.toMatchObject({
      status: 409,
      errorCode: '409',
      errorMessage: 'Action Forbidden',
    });
  });

  test('rejects an answer without a rescode', async () => {
    const { api } = setup([token, { status: 200, body: { resmsg: 'Success' } }]);

    const error = await api.optIn(optIn).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DarajaApiError);
    expect((error as DarajaApiError).errorCode).toBeUndefined();
  });

  test("surfaces the sandbox's gateway timeout (billmanager-optin.json)", async () => {
    const captured = sandboxCapture('billmanager-optin');
    const { api, calls } = setup([token, { status: captured.status, body: captured.response }]);

    await expect(api.optIn(optIn)).rejects.toMatchObject({ status: 504 });
    expect(calls).toHaveLength(2);
  });

  test('is wired on createMpesa', async () => {
    const { fetch, calls } = fakeFetch([token, { status: 200, body: optedIn }]);
    const mpesa = createMpesa({
      environment: 'sandbox',
      consumerKey: 'key',
      consumerSecret: 'secret',
      fetch,
    });

    await mpesa.billManager.optIn(optIn);

    expect(calls[1]!.url).toBe(`${base}/optin`);
  });

  test.each([
    ['short shortCode', { shortCode: 12 }, 'shortCode', 'must be a 5 to 7 digit shortcode'],
    ['email without @', { email: 'billing.example.com' }, 'email', 'must be an email address'],
    [
      'invalid officialContact',
      { officialContact: '12345' },
      'officialContact',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    ['relative callbackUrl', { callbackUrl: '/cb' }, 'callbackUrl', 'must be an absolute URL'],
    [
      'non-boolean sendReminders',
      { sendReminders: '1' as never },
      'sendReminders',
      'must be true or false',
    ],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.optIn({ ...optIn, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('billManager.optIn');
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });

  test('requires an https callbackUrl in production', async () => {
    const { api, calls } = setup([], 'production');

    const error = await api
      .optIn({ ...optIn, callbackUrl: 'http://example.com/cb' })
      .catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'callbackUrl', message: 'must use https in production' },
    ]);
    expect(calls).toHaveLength(0);
  });
});

// The single-invoicing response sample from the portal page.
const sent = { Status_Message: 'Invoice sent successfully', resmsg: 'Success', rescode: '200' };
const invoice = {
  externalReference: '#9932340',
  billedFullName: 'John Doe',
  billedPhoneNumber: '254722000000',
  billedPeriod: 'August 2021',
  invoiceName: 'Jentrys',
  // 22:00 EAT on 11 October, so a UTC formatter would send the wrong day.
  dueDate: new Date('2021-10-11T19:00:00Z'),
  accountReference: '1ASD678H',
  amount: 800,
  invoiceItems: [
    { itemName: 'food', amount: 700 },
    { itemName: 'water', amount: 100 },
  ],
};

describe('billManager.sendInvoice', () => {
  test('posts the invoice in the portal form and maps the answer', async () => {
    const { api, calls } = setup([token, { status: 200, body: sent }]);

    const res = await api.sendInvoice(invoice);

    expect(calls[1]!.url).toBe(`${base}/single-invoicing`);
    expect(calls[1]!.body).toEqual({
      externalReference: '#9932340',
      billedFullName: 'John Doe',
      billedPhoneNumber: '0722000000',
      billedPeriod: 'August 2021',
      invoiceName: 'Jentrys',
      dueDate: '2021-10-11',
      accountReference: '1ASD678H',
      amount: '800',
      invoiceItems: [
        { itemName: 'food', amount: '700' },
        { itemName: 'water', amount: '100' },
      ],
    });
    expect(res).toEqual({
      statusMessage: 'Invoice sent successfully',
      message: 'Success',
      code: '200',
      raw: sent,
    });
  });

  test('sends the due date as the EAT day, across UTC midnight', async () => {
    const { api, calls } = setup([token, { status: 200, body: sent }]);

    await api.sendInvoice({ ...invoice, dueDate: new Date('2021-10-11T21:30:00Z') });

    expect(calls[1]!.body).toMatchObject({ dueDate: '2021-10-12' });
  });

  test('leaves out invoiceItems when there are none', async () => {
    const { api, calls } = setup([token, { status: 200, body: sent }]);
    const { invoiceItems: _, ...plain } = invoice;

    await api.sendInvoice(plain);

    expect(calls[1]!.body).not.toHaveProperty('invoiceItems');
  });

  test('rejects a duplicate externalReference (rescode 409)', async () => {
    const body = {
      Status_Message: 'Another entry exist with the same externalReference number',
      resmsg: 'Action forbidden',
      rescode: '409',
    };
    const { api } = setup([token, { status: 200, body }]);

    await expect(api.sendInvoice(invoice)).rejects.toMatchObject({
      name: 'DarajaApiError',
      errorCode: '409',
    });
  });

  test("surfaces the sandbox's gateway timeout (billmanager-invoice.json)", async () => {
    const captured = sandboxCapture('billmanager-invoice');
    const { api } = setup([token, { status: captured.status, body: captured.response }]);

    await expect(api.sendInvoice(invoice)).rejects.toMatchObject({ status: 504 });
  });

  test.each([
    ['empty externalReference', { externalReference: ' ' }, 'externalReference', 'is required'],
    ['empty billedFullName', { billedFullName: '' }, 'billedFullName', 'is required'],
    ['empty billedPeriod', { billedPeriod: '' }, 'billedPeriod', 'is required'],
    ['empty invoiceName', { invoiceName: '' }, 'invoiceName', 'is required'],
    ['empty accountReference', { accountReference: '' }, 'accountReference', 'is required'],
    [
      'invalid billedPhoneNumber',
      { billedPhoneNumber: '0812345678' },
      'billedPhoneNumber',
      'must be a Safaricom number like 2547XXXXXXXX or 07XXXXXXXX',
    ],
    ['amount 0', { amount: 0 }, 'amount', 'must be at least 1'],
    ['fractional amount', { amount: 1.5 }, 'amount', 'must be an integer'],
    ['invalid dueDate', { dueDate: new Date('x') }, 'dueDate', 'must be a valid date'],
    [
      'an item without a name',
      { invoiceItems: [{ itemName: '', amount: 1 }] },
      'invoiceItems[0].itemName',
      'is required',
    ],
    [
      'an item with amount 0',
      { invoiceItems: [{ itemName: 'x', amount: 0 }] },
      'invoiceItems[0].amount',
      'must be at least 1',
    ],
  ])('rejects %s', async (_, override, path, message) => {
    const { api, calls } = setup([]);

    const error = await api.sendInvoice({ ...invoice, ...override }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('billManager.sendInvoice');
    expect((error as ValidationError).issues).toEqual([{ path, message }]);
    expect(calls).toHaveLength(0);
  });
});

describe('billManager.sendInvoices', () => {
  test('posts the invoices as an array', async () => {
    const { api, calls } = setup([token, { status: 200, body: sent }]);

    const res = await api.sendInvoices([invoice, { ...invoice, externalReference: '967' }]);

    expect(calls[1]!.url).toBe(`${base}/bulk-invoicing`);
    const body = calls[1]!.body as Record<string, unknown>[];
    expect(body).toHaveLength(2);
    expect(body[1]).toMatchObject({ externalReference: '967', billedPhoneNumber: '0722000000' });
    expect(res).toMatchObject({ statusMessage: 'Invoice sent successfully', code: '200' });
  });

  test('accepts 1000 invoices', async () => {
    const { api, calls } = setup([token, { status: 200, body: sent }]);

    await api.sendInvoices(Array.from({ length: 1000 }, () => invoice));

    expect(calls[1]!.body).toHaveLength(1000);
  });

  test("reports each invoice's issues by its index", async () => {
    const { api, calls } = setup([]);

    const error = await api
      .sendInvoices([
        invoice,
        { ...invoice, amount: 0, invoiceItems: [{ itemName: '', amount: 1 }] },
      ])
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain('billManager.sendInvoices');
    expect((error as ValidationError).issues).toEqual([
      { path: 'invoices[1].amount', message: 'must be at least 1' },
      { path: 'invoices[1].invoiceItems[0].itemName', message: 'is required' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test.each([
    ['no invoices', []],
    ['1001 invoices', Array.from({ length: 1001 }, () => invoice)],
  ])('rejects %s', async (_, invoices) => {
    const { api, calls } = setup([]);

    const error = await api.sendInvoices(invoices).catch((e: unknown) => e);

    expect((error as ValidationError).issues).toEqual([
      { path: 'invoices', message: 'must hold 1 to 1000 invoices' },
    ]);
    expect(calls).toHaveLength(0);
  });

  test("surfaces the sandbox's gateway timeout (billmanager-invoices.json)", async () => {
    const captured = sandboxCapture('billmanager-invoices');
    const { api } = setup([token, { status: captured.status, body: captured.response }]);

    await expect(api.sendInvoices([invoice])).rejects.toMatchObject({ status: 504 });
  });
});
