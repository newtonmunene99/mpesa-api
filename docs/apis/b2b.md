# Business to Business (B2B)

Daraja 3.0 brings business-to-business payments back as four products, all paid from your shortcode's working account through the initiator. Each needs the initiator to hold that product's org API role on M-Pesa (for example "Org Business Pay Bill API initiator", "Org Business Pay to Bulk API initiator" or "Tax Remittance to KRA API"). The acknowledgement only confirms that Daraja received the request; the outcome is posted to `resultUrl`, and you read it with [`parseResult`](/guide/callbacks).

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

The fields are `payBill`'s with an optional `accountReference` and no `occasion`; `partyB` is the B2C shortcode.

## Remit tax to KRA

Pays tax to the Kenya Revenue Authority against a payment registration number (PRN). You need a prior integration with KRA to generate PRNs. Tax always goes to KRA's shortcode, `572572`, which the SDK sends for you, so there is no `partyB`.

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

## Results

A successful B2B result's `parameters` include `Amount`, `TransCompletedTime` (a `Date`), `ReceiverPartyPublicName`, `Currency`, `DebitPartyAffectedAccountBalance` (the packed balance format; split it with [`parseBalances`](/guide/callbacks)) and `DebitAccountBalance` (a `{Amount={…}}` string, kept as is); Pay Bill and Tax Remittance results echo the account reference as `referenceData.BillReferenceNumber`; in the sandbox, Buy Goods and Top Up results didn't. A failed request carries few or no `parameters` (the portal samples show only `BOCompletedTime`).

The portal documents `PartyA` as a 5 or 6 digit shortcode; the SDK accepts 5 to 7 digits, as it does for the other APIs.
