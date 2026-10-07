# Dynamic QR

Generates a QR code that a customer scans in the M-Pesa app to pay a set amount. The call is synchronous: the response carries the image, and nothing is posted back. No initiator is needed.

```ts
const { qrCode } = await mpesa.qr.generate({
  merchantName: 'TEST SUPERMARKET',
  reference: 'Invoice Test',
  amount: 1,
  type: 'buyGoods',
  creditParty: 373132,
});

const src = `data:image/png;base64,${qrCode}`;
```

`qrCode` is a base64-encoded PNG, so it works as an `<img>` source as shown, or decoded to bytes to save as a file.

| Field          | Daraja field   | Notes                                                                                                                                               |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merchantName` | `MerchantName` | The name shown to the customer.                                                                                                                     |
| `reference`    | `RefNo`        | The transaction reference.                                                                                                                          |
| `amount`       | `Amount`       | Whole shillings, at least 1.                                                                                                                        |
| `type`         | `TrxCode`      | What the customer does; see below.                                                                                                                  |
| `creditParty`  | `CPI`          | Who is paid: a 5 to 7 digit till, paybill or agent number, or for `sendMoney` and `sendToBusiness` a Safaricom number as a string (sent as `254…`). |
| `size`         | `Size`         | Optional. The image's width and height in pixels. Defaults to 300.                                                                                  |

| `type`            | `TrxCode` | The customer…                                 |
| ----------------- | --------- | --------------------------------------------- |
| `buyGoods`        | `BG`      | pays a till.                                  |
| `payBill`         | `PB`      | pays a paybill.                               |
| `agentWithdrawal` | `WA`      | withdraws cash at an agent till.              |
| `sendMoney`       | `SM`      | sends money to a mobile number.               |
| `sendToBusiness`  | `SB`      | sends to a business identified by its number. |

The response (`QrResponse`) has `qrCode`, `responseCode`, `responseDescription`, `raw` and, when Daraja sends one, `requestId`.

Tested live in the sandbox: the portal's sample request returned a 300 × 300 PNG with `ResponseCode` `"00"` and no request ID.
