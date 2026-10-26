---
'mpesa-api': minor
---

Daraja 3.0 Bill Manager (e-invoicing for a paybill), with no initiator: `billManager.optIn`, `sendInvoice`, `sendInvoices` (up to 1000 at once), `cancelInvoice`, `cancelInvoices` and `acknowledgePayment`. Payment pushes are read with the new `parseBillManagerPayment`, and answered with `billManagerPaymentResponse`. The optional `billManager.appKey` client config is sent as the `appKey` header on every call but `optIn`. See [Bill Manager](https://newtonmunene99.github.io/mpesa-api/apis/bill-manager).
