# Reversal

Reverses a C2B transaction. B2C payments can't be reversed through the API.

```ts
await mpesa.reversal.request({
  transactionId: 'UIU030F3PZ',
  amount: 100,
  receiverParty: 600984,
  remarks: 'Paid twice',
  resultUrl: 'https://example.com/payments/reversal/result',
  queueTimeoutUrl: 'https://example.com/payments/reversal/timeout',
});
```

| Field             | Daraja field      | Notes                                       |
| ----------------- | ----------------- | ------------------------------------------- |
| `transactionId`   | `TransactionID`   | The M-Pesa receipt number to reverse.       |
| `amount`          | `Amount`          | Whole shillings.                            |
| `receiverParty`   | `ReceiverParty`   | Your organisation's shortcode.              |
| `remarks`         | `Remarks`         | 2 to 100 characters.                        |
| `resultUrl`       | `ResultURL`       | Receives the result.                        |
| `queueTimeoutUrl` | `QueueTimeOutURL` | Receives a notice if the request times out. |

`RecieverIdentifierType` (Daraja's spelling) is always `"11"`.
