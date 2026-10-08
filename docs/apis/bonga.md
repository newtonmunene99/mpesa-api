# Lipa na Bonga

Lets customers pay your paybill or till with Safaricom Bonga points, at KES 0.2 a point. No initiator is needed.

The flow:

1. Work out what the points are worth with `calculatePoints`.
2. Ask the customer to redeem them with `redeem`. Daraja sends the customer an M-Pesa prompt.
3. Once the points are deducted, M-Pesa pays your shortcode. The payment arrives as an ordinary C2B confirmation, on the URLs registered with [`c2b.registerUrls`](/apis/c2b); read it with [`parseC2BNotification`](/guide/callbacks).

## Calculate points

```ts
const quote = await mpesa.bonga.calculatePoints({ points: 40 });
console.log(quote.amountCents, quote.rate); // 800, 0.2
```

| Field    | Daraja field | Notes                     |
| -------- | ------------ | ------------------------- |
| `points` | `points`     | Whole points, at least 1. |

If Daraja's `body` can't be read (a non-numeric or non-positive amount, non-integer points, a non-positive rate), `calculatePoints` throws `ValidationError` with `body.` paths, after the request was sent.

The response (`BongaCalculateResponse`) has `amountCents` (what the points are worth, in cents), `points`, `rate` (shillings per point), `requestRefId`, `responseCode`, `customerMessage` and `raw`.

## Redeem

```ts
await mpesa.bonga.redeem({
  phoneNumber: '0720776155',
  shortCode: 888880,
  accountNumber: 'INV-7',
  points: quote.points,
  amount: quote.amountCents / 100,
  rate: quote.rate,
});
```

| Field           | Daraja field     | Notes                                                                 |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| `phoneNumber`   | `msisdn`         | The customer paying: `07…`, `01…`, `+254…` or `254…`, sent as `254…`. |
| `shortCode`     | `shortCode`      | Your paybill or till, which is paid.                                  |
| `accountNumber` | `accountNumber`  | The account number at your paybill.                                   |
| `points`        | `bongaPoints`    | Whole points, at least 1.                                             |
| `amount`        | `amount`         | Shillings, at most 2 decimal places.                                  |
| `rate`          | `conversionRate` | Shillings per point, as `calculatePoints` returned it.                |

`amount` must equal `points × rate` to the cent, or `redeem` throws `ValidationError` before sending. The portal's own sample breaks this rule (KES 50 for 20 points at 0.2). The portal's calculate-points step calls `amount` "the amount to pay", so the SDK holds the two to agree. The response (`BongaRedeemResponse`) has `requestRefId`, `responseCode`, `responseMessage` and `raw`. It only confirms the request was received.

Every response carries `header.responseCode`; anything but 200 throws `DarajaApiError`. The SDK doesn't send the `Username` and `Password` headers the portal lists for "Bonga Everywhere".

## Tested live

Not yet. Both endpoints answered HTTP 404 with an empty body for the sandbox app, most likely because the app doesn't have the Lipa na Bonga product. Both calls are tested against the portal's samples.
