# M-Pesa Express (STK push)

Sends a payment prompt to the customer's phone. The result is posted to `callbackUrl`; read it with [`parseStkCallback`](/guide/callbacks).

```ts
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
```

`stkPush.send`:

| Field              | Daraja field            | Notes                                                                     |
| ------------------ | ----------------------- | ------------------------------------------------------------------------- |
| `shortCode`        | `BusinessShortCode`     | Paybill, or the HO/store number for till payments.                        |
| `type`             | `TransactionType`       | `'paybill'` (CustomerPayBillOnline) or `'till'` (CustomerBuyGoodsOnline). |
| `amount`           | `Amount`                | Whole shillings, at least 1.                                              |
| `phoneNumber`      | `PartyA`, `PhoneNumber` | `07…`, `01…`, `+254…` or `254…`.                                          |
| `partyB`           | `PartyB`                | Optional. Defaults to `shortCode`; set it to the till number for tills.   |
| `callbackUrl`      | `CallBackURL`           | Receives the result.                                                      |
| `accountReference` | `AccountReference`      | Shown to the customer. 1 to 12 characters.                                |
| `description`      | `TransactionDesc`       | Optional. 1 to 13 characters; defaults to "Payment".                      |

`Password` and `Timestamp` are generated from the configured `passkey`.

`stkPush.query` takes `shortCode` (`BusinessShortCode`) and `checkoutRequestId` (`CheckoutRequestID`), and returns `resultCode` (0 means paid; 1032 means the customer cancelled, 1037 that they didn't respond). Querying within about 30 seconds of the push can fail with `500.001.1001` "The transaction does not Exist"; retry later, or rely on the callback.
