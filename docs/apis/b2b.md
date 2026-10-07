# Business to Business (B2B)

Daraja 3.0 brings business-to-business payments back as four products, all paid from your shortcode's working account through the initiator, plus [Express CheckOut](#express-checkout), which asks a merchant to pay you and needs no initiator. Each of the four needs the initiator to hold that product's org API role on M-Pesa (for example "Org Business Pay Bill API initiator", "Org Business Pay to Bulk API initiator" or "Tax Remittance to KRA API"). For those four, the acknowledgement only confirms that Daraja received the request; the outcome is posted to `resultUrl`, and you read it with [`parseResult`](/guide/callbacks).

| Method         | Daraja product     | `CommandID`         |
| -------------- | ------------------ | ------------------- |
| `b2b.payBill`  | Business Pay Bill  | `BusinessPayBill`   |
| `b2b.buyGoods` | Business Buy Goods | `BusinessBuyGoods`  |
| `b2b.topUpB2C` | B2C Account Top Up | `BusinessPayToBulk` |
| `b2b.remitTax` | Tax Remittance     | `PayTaxToKRA`       |

Every method sends `SenderIdentifierType` and `RecieverIdentifierType` (Daraja's spelling) as `"4"`, and none sends an `OriginatorConversationID`: track a payment by the `conversationId` and `originatorConversationId` Daraja returns.

## Pay a paybill

Pays a paybill for yourself or on behalf of a customer.

```ts
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
```

| Field              | Daraja field       | Notes                                                                                       |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------- |
| `amount`           | `Amount`           | Whole shillings, at least 1.                                                                |
| `shortCode`        | `PartyA`           | Your shortcode, which is debited.                                                           |
| `partyB`           | `PartyB`           | The paybill credited.                                                                       |
| `accountReference` | `AccountReference` | The account number at the paybill, 1 to 13 characters.                                      |
| `requester`        | `Requester`        | Optional. The customer you are paying for: `07…`, `01…`, `+254…` or `254…`, sent as `254…`. |
| `remarks`          | `Remarks`          | 1 to 100 characters.                                                                        |
| `occasion`         | `Occassion`        | Optional. 1 to 100 characters.                                                              |
| `resultUrl`        | `ResultURL`        | Receives the result.                                                                        |
| `queueTimeoutUrl`  | `QueueTimeOutURL`  | Receives a notice if the request times out in the queue.                                    |

## Pay a till or merchant

Pays a till, merchant store or merchant head office, for yourself or on behalf of a customer.

```ts
await mpesa.b2b.buyGoods({
  amount: 800,
  shortCode: 600979,
  partyB: 600000,
  remarks: 'Office supplies',
  resultUrl: 'https://example.com/payments/b2b/result',
  queueTimeoutUrl: 'https://example.com/payments/b2b/timeout',
});
```

The fields are the same as `payBill`'s, except that `accountReference` is optional.

## Top up a B2C account

Moves money from your working account to a B2C shortcode's utility account, ready for [B2C](/apis/b2c) payments.

```ts
await mpesa.b2b.topUpB2C({
  amount: 50000,
  shortCode: 600979,
  partyB: 600997,
  remarks: 'Float for salaries',
  resultUrl: 'https://example.com/payments/b2b/result',
  queueTimeoutUrl: 'https://example.com/payments/b2b/timeout',
});
```

The fields are `payBill`'s with an optional `accountReference` and no `occasion`; `partyB` is the B2C shortcode. An `occasion` passed from untyped JavaScript is ignored, not sent.

## Remit tax to KRA

Pays tax to the Kenya Revenue Authority against a payment registration number (PRN). You need a prior integration with KRA to generate PRNs. Tax always goes to KRA's shortcode, `572572`, which the SDK sends for you, so there is no `partyB`. A `partyB`, `requester` or `occasion` passed from untyped JavaScript is ignored, not sent.

```ts
await mpesa.b2b.remitTax({
  amount: 3000,
  shortCode: 888880,
  accountReference: 'PRN1234XN',
  remarks: 'VAT for September',
  resultUrl: 'https://example.com/payments/tax/result',
  queueTimeoutUrl: 'https://example.com/payments/tax/timeout',
});
```

| Field              | Daraja field       | Notes                                                    |
| ------------------ | ------------------ | -------------------------------------------------------- |
| `amount`           | `Amount`           | Whole shillings, at least 1.                             |
| `shortCode`        | `PartyA`           | Your shortcode, which is debited.                        |
| `accountReference` | `AccountReference` | The PRN issued by KRA, 1 to 13 characters.               |
| `remarks`          | `Remarks`          | 1 to 100 characters.                                     |
| `resultUrl`        | `ResultURL`        | Receives the result.                                     |
| `queueTimeoutUrl`  | `QueueTimeOutURL`  | Receives a notice if the request times out in the queue. |

## Express CheckOut

Asks a merchant to pay your paybill from their till. Daraja sends a USSD prompt to the till's nominated operator; when they enter their PIN, the merchant's till pays you. Unlike the methods above, it needs no initiator, and its acknowledgement and result are camelCase and shaped differently.

```ts
const push = await mpesa.b2b.expressCheckout({
  shortCode: 600000,
  merchantTill: 123456,
  amount: 100,
  paymentReference: 'INV-7',
  partnerName: 'Vendor',
  callbackUrl: 'https://example.com/payments/b2b/express',
});
```

| Field              | Daraja field        | Notes                                                              |
| ------------------ | ------------------- | ------------------------------------------------------------------ |
| `shortCode`        | `receiverShortCode` | Your paybill, which is credited.                                   |
| `merchantTill`     | `primaryShortCode`  | The merchant's till, which is debited.                             |
| `amount`           | `amount`            | Whole shillings, at least 1.                                       |
| `paymentReference` | `paymentRef`        | Shown to the merchant in the prompt.                               |
| `partnerName`      | `partnerName`       | Your name as the merchant knows it, shown in the prompt.           |
| `callbackUrl`      | `callbackUrl`       | Receives the result.                                               |
| `requestRefId`     | `RequestRefID`      | Optional. Your unique ID for this push. Defaults to a random UUID. |

Shortcodes and the amount are sent as strings, as in the portal's sample. The response (`B2BExpressCheckoutResponse`) has `code` (`"0"`), `status`, the `requestRefId` sent and `raw`. A non-zero `code` throws `DarajaApiError`, with the code as `errorCode`.

The result is posted to `callbackUrl`. Read it with `parseExpressCheckoutCallback`:

```ts
app.post('/payments/b2b/express', (req, res) => {
  const result = parseExpressCheckoutCallback(req.body);
  if (result.ok) console.log('paid', result.transactionId, result.amountCents);
  else console.log('not paid', result.resultCode, result.resultDesc);
  res.json({ ok: true });
});
```

It returns an `ExpressCheckoutCallback`: `resultCode` (0 on success, 4001 when the merchant cancelled), `resultDesc`, `ok`, `requestId`, `amountCents`, `raw` and, when Daraja sends them, `paymentReference`, `transactionId`, `conversationId` and `status`.

Not tested live: the sandbox refused the push with a 401, most likely because the sandbox app doesn't have the product. The request follows the portal's sample, and the parser is tested against the portal's cancelled and successful callbacks.

## Results

A successful B2B result's `parameters` include `Amount`, `TransCompletedTime` (a `Date`), `ReceiverPartyPublicName`, `Currency`, `DebitPartyAffectedAccountBalance` (the packed balance format; split it with [`parseBalances`](/guide/callbacks)) and `DebitAccountBalance` (a `{Amount={…}}` string, kept as is); Pay Bill and Tax Remittance results echo the account reference as `referenceData.BillReferenceNumber`; in the sandbox, a Buy Goods result didn't echo the reference it was sent (Top Up wasn't sent one). A failed request carries few or no `parameters` (the portal samples show only `BOCompletedTime`).

The portal documents `PartyA` as a 5 or 6 digit shortcode; the SDK accepts 5 to 7 digits, as it does for the other APIs.
