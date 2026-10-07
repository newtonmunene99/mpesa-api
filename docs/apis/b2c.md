# Business to Customer (B2C)

Pays a customer from a B2C shortcode. The acknowledgement only confirms that Daraja received the request; the outcome is posted to `resultUrl`.

```ts
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
```

| Field                      | Daraja field               | Notes                                                           |
| -------------------------- | -------------------------- | --------------------------------------------------------------- |
| `originatorConversationId` | `OriginatorConversationID` | Optional. Your unique ID; defaults to a random UUID.            |
| `commandId`                | `CommandID`                | `'SalaryPayment'`, `'BusinessPayment'` or `'PromotionPayment'`. |
| `amount`                   | `Amount`                   | Whole shillings, 10 to 250 000.                                 |
| `shortCode`                | `PartyA`                   | The B2C shortcode paying out.                                   |
| `phoneNumber`              | `PartyB`                   | The customer's number.                                          |
| `remarks`                  | `Remarks`                  | 2 to 100 characters.                                            |
| `resultUrl`                | `ResultURL`                | Receives the result.                                            |
| `queueTimeoutUrl`          | `QueueTimeOutURL`          | Receives a notice if the request times out in the queue.        |
| `occasion`                 | `Occassion`                | Optional. 1 to 100 characters. See the note below.              |

If the request to Daraja fails (a network error, timeout or `DarajaApiError`), the thrown error carries `originatorConversationId`. Query the payment's status with that ID before retrying, so the customer isn't paid twice. Errors thrown before sending, such as a `ValidationError`, don't carry it.

`Occassion` is the spelling in the Daraja 3.0 docs and the portal simulator; B2C v1 used `Occasion`. The sandbox acknowledged both when 4.0 was tested, but no result arrived to show which one Daraja reads. It is a free-text note, so a wrong spelling probably at worst drops it.

## Business To Pochi

Pays a customer's Pochi la Biashara (business wallet) from a B2C shortcode. It has its own endpoint, `/mpesa/b2pochi/v1/paymentrequest`, but the same fields, limits and result as `pay`, without `commandId` (the SDK sends `BusinessPayToPochi`).

```ts
const pochi = await mpesa.b2c.payToPochi({
  amount: 250,
  shortCode: 600999,
  phoneNumber: '0712345678',
  remarks: 'Supplier payment',
  resultUrl: 'https://example.com/payments/pochi/result',
  queueTimeoutUrl: 'https://example.com/payments/pochi/timeout',
});
console.log(pochi.originatorConversationId);
```

`phoneNumber` is the wallet owner's number; the portal calls it a number, but the SDK takes a string in any of the accepted formats, as `pay` does.
