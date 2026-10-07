# Pull Transactions

Lists the C2B payments made to your paybill or till in the last 48 hours, including any whose notifications you missed, for reconciliation. Register the shortcode once, then query it. No initiator is needed.

## Register a shortcode

A one-time step. The shortcode must be live in production. Registering it again is not an error: `alreadyRegistered` is `true`.

```ts
const registration = await mpesa.pullTransactions.register({
  shortCode: 600000,
  nominatedNumber: '0722000000',
  callbackUrl: 'https://example.com/payments/pull',
});
```

| Field             | Daraja field      | Notes                                                                                                 |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `shortCode`       | `ShortCode`       | Your paybill or till number.                                                                          |
| `nominatedNumber` | `NominatedNumber` | The Safaricom number on the shortcode's KYC records: `07…`, `01…`, `+254…` or `254…`, sent as `254…`. |
| `callbackUrl`     | `CallBackURL`     | Where Daraja may push transactions. The SDK doesn't parse these: Daraja doesn't document their shape. |

The SDK always sends `RequestType` `"Pull"`. The response (`PullRegisterResponse`) has `responseRefId`, `status` (`"1000"` registered, `"1001"` already registered), `shortCode`, `description`, `alreadyRegistered` and `raw`. Any other status throws `DarajaApiError`.

## Query one page

```ts
const now = new Date();
const page = await mpesa.pullTransactions.query({
  shortCode: 600000,
  from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  to: now,
});
for (const t of page.transactions) console.log(t.transactionId, t.amountCents);
```

| Field       | Daraja field  | Notes                                                        |
| ----------- | ------------- | ------------------------------------------------------------ |
| `shortCode` | `ShortCode`   | Your registered paybill or till number.                      |
| `from`      | `StartDate`   | A `Date`, sent as `YYYY-MM-DD HH:mm:ss` in East Africa Time. |
| `to`        | `EndDate`     | The same; must not be before `from`.                         |
| `offset`    | `OffSetValue` | Optional. How many transactions to skip. Defaults to 0.      |

Daraja only keeps the last 48 hours; the SDK leaves that limit to Daraja. The response (`PullQueryResponse`) has `transactions`, `responseRefId`, `responseCode` and `raw`. `transactions` is empty when there are none (`"1001"`). Each `PullTransaction` has:

| Field              | Daraja field       | Notes                                                                |
| ------------------ | ------------------ | -------------------------------------------------------------------- |
| `transactionId`    | `transactionId`    | The M-Pesa receipt number.                                           |
| `date`             | `trxDate`          | A `Date`. A value without a time zone is read as East Africa Time.   |
| `msisdn`           | `msisdn`           | The customer's number as Daraja sends it, for example `"722000000"`. |
| `sender`           | `sender`           |                                                                      |
| `type`             | `transactiontype`  | For example `"c2b-pay-bill-debit"`.                                  |
| `billReference`    | `billreference`    | The account number the customer entered; absent when blank.          |
| `amountCents`      | `amount`           | In cents: `"168.00"` is 16800.                                       |
| `organizationName` | `organizationname` |                                                                      |

## Every page

`all` queries page after page, moving the offset on each time, and yields each transaction once. It stops at the first empty page.

```ts
for await (const t of mpesa.pullTransactions.all({ shortCode: 600000, from, to })) {
  console.log(t.transactionId, t.date, t.amountCents);
}
```

An error on any page rejects the loop after the earlier transactions were yielded. That includes the HTTP 500 that Daraja documents for "no transactions available". Invalid input throws `ValidationError` on the first iteration, before any request is sent.

## Tested live

Not yet. The sandbox refused both registration and query with `401.001` ("Invalid Access Token"), using a token that worked for other APIs. The sandbox app most likely doesn't have the Pull Transactions product. The parsing is tested against the portal's samples.
