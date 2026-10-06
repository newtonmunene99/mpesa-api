# Transaction Status

```ts
await mpesa.transactionStatus.query({
  originalConversationId: 'the ID returned by b2c.pay',
  partyA: 600999,
  resultUrl: 'https://example.com/payments/status/result',
  queueTimeoutUrl: 'https://example.com/payments/status/timeout',
});
```

| Field                    | Daraja field             | Notes                                                                    |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| `transactionId`          | `TransactionID`          | The M-Pesa receipt number. Give this, `originalConversationId`, or both. |
| `originalConversationId` | `OriginalConversationID` | The `OriginatorConversationID` of the request to check.                  |
| `partyA`                 | `PartyA`                 | The shortcode or phone number involved.                                  |
| `identifierType`         | `IdentifierType`         | Optional. `'shortcode'` (default), `'till'` or `'msisdn'`.               |
| `resultUrl`              | `ResultURL`              | Receives the status.                                                     |
| `queueTimeoutUrl`        | `QueueTimeOutURL`        | Receives a notice if the request times out in the queue.                 |
| `remarks`                | `Remarks`                | Optional. Up to 100 characters.                                          |
| `occasion`               | `Occasion`               | Optional. Up to 100 characters.                                          |
