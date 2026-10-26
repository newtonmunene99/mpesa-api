# M-Pesa Ratiba

Sets up standing orders: collections that run from a customer's M-Pesa on a schedule, such as loan repayments, premiums or subscriptions. Ratiba is a commercial API. Safaricom charges 5% of each payment, capped at KES 5, plus the usual C2B tariff, and going live needs a signed agreement through apisupport@safaricom.co.ke. No initiator is needed.

The flow is asynchronous:

1. You send the order.
2. Daraja sends the customer an M-Pesa prompt, and their PIN is their consent.
3. Daraja opts them in to Ratiba and creates the order.
4. Daraja posts the result to `callbackUrl`.

```ts
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
```

| Field              | Daraja field                                     | Notes                                                                                        |
| ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `name`             | `StandingOrderName`                              | Unique among the customer's standing orders. A duplicate fails in the callback with 1050.    |
| `type`             | `ReceiverPartyIdentifierType`, `TransactionType` | `'paybill'` (`"4"`) or `'till'` (`"2"`). The SDK sends the matching transaction type.        |
| `shortCode`        | `BusinessShortCode`                              | Your paybill or till, which is paid.                                                         |
| `phoneNumber`      | `PartyA`                                         | The customer who pays: `07…`, `01…`, `+254…` or `254…`, sent as `254…`.                      |
| `amount`           | `Amount`                                         | Whole shillings per payment, at least 1.                                                     |
| `startDate`        | `StartDate`                                      | A `Date`, sent as `yyyymmdd` in East Africa Time.                                            |
| `endDate`          | `EndDate`                                        | The same; not before `startDate`'s day.                                                      |
| `frequency`        | `Frequency`                                      | See below.                                                                                   |
| `accountReference` | `AccountReference`                               | The account number at your paybill, 1 to 12 characters.                                      |
| `description`      | `TransactionDesc`                                | 1 to 13 characters.                                                                          |
| `callbackUrl`      | `CallBackURL`                                    | Receives the result.                                                                         |
| `requestRefId`     | `CustomStoId`                                    | Optional. Your unique ID for the request, echoed in the callback. Defaults to a random UUID. |

| `frequency`  | `Frequency` |
| ------------ | ----------- |
| `once`       | `1`         |
| `daily`      | `2`         |
| `weekly`     | `3`         |
| `biweekly`   | `4`         |
| `monthly`    | `5`         |
| `bimonthly`  | `6`         |
| `quarterly`  | `7`         |
| `halfYearly` | `8`         |
| `yearly`     | `9`         |

The response (`RatibaResponse`) has `responseRefId`, `responseCode` (`"200"`), `responseDescription`, the `requestRefId` sent and `raw`. Any other `responseCode` throws `DarajaApiError`.

## The result

Read the callback with `parseRatibaCallback`. Daraja sends successes in camelCase and failures in PascalCase, and the parser reads both:

```ts
app.post('/payments/ratiba', (req, res) => {
  const result = parseRatibaCallback(req.body);
  if (result.ok) console.log('order', result.standingOrderId, result.status);
  else console.log('not created', result.resultCode, result.responseDescription);
  res.json({ ok: true });
});
```

It returns a `RatibaCallback` with these fields:

- `resultCode`: 0 on success. Other codes include 1032 (cancelled), 2001 (wrong PIN), 1037 (prompt not answered in time) and 1050 (duplicate name).
- `ok`, `responseDescription`, `responseRefId`, `requestRefId` (your `CustomStoId`) and `raw`.
- `data`: every name/value pair Daraja sent.
- When present: `standingOrderId` (`reminderScheduleId`), `transactionId` and `status` (for example `"ACTIVE"`).

## Tested live

Not yet. The sandbox refused every shortcode tried with HTTP 400, "Value in field 'BusinessShortCode' can only be what was issued for this application". It seems a Ratiba shortcode has to be issued to the app. The request follows the portal's sample, and the parser is tested against the portal's success and failure callbacks.
