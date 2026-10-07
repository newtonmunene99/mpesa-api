---
'mpesa-api': minor
---

Daraja 3.0 disbursements: `b2b.payBill` (Business Pay Bill), `b2b.buyGoods` (Business Buy Goods), `b2b.topUpB2C` (B2C Account Top Up), `b2b.remitTax` (Tax Remittance to KRA) and `b2c.payToPochi` (Business To Pochi). Each acts through the initiator and posts its outcome to `resultUrl`; read it with `parseResult`. See [B2B](https://newtonmunene99.github.io/mpesa-api/apis/b2b) and [Business To Pochi](https://newtonmunene99.github.io/mpesa-api/apis/b2c#business-to-pochi).
