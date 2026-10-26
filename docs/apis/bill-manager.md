# Bill Manager

E-invoicing for a paybill. No initiator is needed. The flow:

1. **Opt in:** opting in once whitelists your shortcode for the other calls.
2. **Send invoices:** Safaricom texts them to your customers, with reminders 7 and 3 days before the due date and on it, if you enabled them.
3. **Receive payments:** when a customer pays, Bill Manager pushes the payment to your `callbackUrl`.
4. **Acknowledge:** you acknowledge each payment, and the customer gets an e-receipt.

## Opt in

```ts
const { appKey } = await mpesa.billManager.optIn({
  shortCode: 718003,
  email: 'billing@example.com',
  officialContact: '0710000000',
  sendReminders: true,
  callbackUrl: 'https://example.com/payments/bill-manager',
});
```

| Field             | Daraja field      | Notes                                                                                 |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `shortCode`       | `shortcode`       | Your paybill or till.                                                                 |
| `email`           | `email`           | Shown on invoices and receipts.                                                       |
| `officialContact` | `officialContact` | Shown on invoices and receipts: `07…`, `01…`, `+254…` or `254…`, sent as `07…`/`01…`. |
| `sendReminders`   | `sendReminders`   | `true` or `false`, sent as `"1"`/`"0"`.                                               |
| `callbackUrl`     | `callbackurl`     | Receives payment pushes.                                                              |

The response (`BillManagerOptInResponse`) has `appKey` (Daraja's `app_key`, when it sends one), `message`, `code` and `raw`. Opting in again answers 409, "Biller already Registered".

The logo isn't supported: the portal doesn't say what format it takes. Updating your opt-in details isn't supported for the same reason, because the portal marks the logo as required there.

### The app key

The portal says the `app_key` from opting in goes "in the Header of every Service Request", but it doesn't name the header. Pass the key to `createMpesa`, and the SDK sends it as the `appKey` header on every Bill Manager call except `optIn`:

```ts
const billing = createMpesa({
  environment: 'production',
  consumerKey: process.env.MPESA_CONSUMER_KEY!,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
  billManager: { appKey: process.env.MPESA_BILL_MANAGER_APP_KEY! },
});
```

The header name hasn't been confirmed against Daraja. Treat the key as a secret, like your consumer secret.

## Send invoices

```ts
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
```

| Field               | Daraja field        | Notes                                                                                    |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `externalReference` | `externalReference` | Your unique ID for the invoice; used to cancel it. A duplicate answers 409.              |
| `billedFullName`    | `billedFullName`    | The customer's name, shown in the SMS.                                                   |
| `billedPhoneNumber` | `billedPhoneNumber` | The Safaricom number that gets the SMS, sent as `07…`/`01…`.                             |
| `billedPeriod`      | `billedPeriod`      | For example `"October 2026"`.                                                            |
| `invoiceName`       | `invoiceName`       | What the customer is billed for, shown in the SMS.                                       |
| `dueDate`           | `dueDate`           | A `Date`, sent as `YYYY-MM-DD` in East Africa Time.                                      |
| `accountReference`  | `accountReference`  | The account number the customer pays to.                                                 |
| `amount`            | `amount`            | Whole shillings, at least 1, sent as a string.                                           |
| `invoiceItems`      | `invoiceItems`      | Optional lines, `{ itemName, amount }`, shown on the invoice. An empty list is left out. |

`sendInvoices([…])` sends 1 to 1000 invoices in one call. A problem with one of them is reported by its position, for example `invoices[3].amount`. Both return a `BillManagerResponse`: `statusMessage` (when Daraja sends one), `message`, `code` and `raw`.

## Cancel invoices

```ts
await mpesa.billManager.cancelInvoice('INV-2042');
await mpesa.billManager.cancelInvoices(['INV-2043', 'INV-2044']);
```

Both return a `BillManagerCancelResponse`: the fields above, plus `errors`, Daraja's list as is. You can't cancel an invoice that is partly or fully paid: Daraja answers 409, which throws `DarajaApiError`.

## Payments

Read each payment push with `parseBillManagerPayment` and reply with `billManagerPaymentResponse`. Bill Manager says it tries a push up to 5 times. After reconciling a payment, acknowledge it, and the customer gets an e-receipt:

```ts
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
```

`parseBillManagerPayment` returns a `BillManagerPayment`:

- `transactionId`.
- `paidAmountCents`: exact cents.
- `msisdn`.
- `dateCreated`: a `Date` at midnight East Africa Time.
- `accountReference`, `shortCode` and `raw`.

It throws `ValidationError` if `transactionId`, `paidAmount` or `dateCreated` is missing or malformed. `acknowledgePayment` sends `paymentDate` as `YYYY-MM-DD`, `paidAmount` as a whole-shilling string, and the phone as `07…`/`01…`.

## Errors

Every Bill Manager answer carries `rescode`; anything but `"200"` throws `DarajaApiError`, with the rescode as `errorCode` and `Status_Message` (or `resmsg`) as `errorMessage`. The portal lists 409 for most refusals:

- a shortcode already opted in;
- a wrong consumer key or shortcode;
- a duplicate `externalReference`;
- a wrong phone or date format;
- cancelling a paid invoice.

## Tested live

Not yet. Every Bill Manager call timed out at the sandbox gateway (HTTP 504), opt-in also on a retry. So it's untested whether the app key is needed, what its header is called, and how errors arrive (as HTTP 409, or as HTTP 200 with `rescode` `"409"`; the SDK handles both). The request formats follow the portal's samples. Where the portal contradicts itself (its error list asks for due dates as "yymmdd", but every sample uses `YYYY-MM-DD`), the SDK follows the samples.
