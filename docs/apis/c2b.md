# Customer to Business (C2B)

```ts
await mpesa.c2b.registerUrls({
  shortCode: 600984,
  confirmationUrl: 'https://example.com/payments/c2b/confirmation',
  validationUrl: 'https://example.com/payments/c2b/validation',
  defaultAction: 'Completed',
});

// Sandbox only.
await mpesa.c2b.simulate({
  shortCode: 600984,
  type: 'paybill',
  amount: 100,
  phoneNumber: '0708374149',
  billRefNumber: 'ACC-001',
});
```

`c2b.registerUrls`:

| Field             | Daraja field      | Notes                                                                   |
| ----------------- | ----------------- | ----------------------------------------------------------------------- |
| `shortCode`       | `ShortCode`       | Paybill or till number.                                                 |
| `confirmationUrl` | `ConfirmationURL` | Receives payment confirmations.                                         |
| `validationUrl`   | `ValidationURL`   | Receives validation requests, if Safaricom enabled external validation. |
| `defaultAction`   | `ResponseType`    | `'Completed'` or `'Cancelled'`: what happens if validation times out.   |

In production, URLs must use `https` and must not contain words such as "mpesa", "safaricom", "exec", "cmd", "sql" or "query". Registration is a one-time call there; delete existing URLs in the portal before registering new ones.

`c2b.simulate` (sandbox only): `shortCode` (`ShortCode`), `type` (`CommandID`: `'paybill'` or `'till'`), `amount` (`Amount`), `phoneNumber` (`Msisdn`) and `billRefNumber` (`BillRefNumber`, required for paybill).
