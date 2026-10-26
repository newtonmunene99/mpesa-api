---
'mpesa-api': minor
---

Daraja 3.0 customer payments and lookups, none of which needs an initiator:

- `qr.generate` makes Dynamic QR codes, returned as a base64 PNG.
- `b2b.expressCheckout` sends a B2B Express CheckOut USSD push to a merchant's till; read its callback with the new `parseExpressCheckoutCallback`.
- `pullTransactions.register`, `query` and `all` list the last 48 hours of C2B payments to a shortcode. `all` is an async iterator over every page.

See [Dynamic QR](https://newtonmunene99.github.io/mpesa-api/apis/qr), [B2B Express CheckOut](https://newtonmunene99.github.io/mpesa-api/apis/b2b#express-checkout) and [Pull Transactions](https://newtonmunene99.github.io/mpesa-api/apis/pull-transactions).
