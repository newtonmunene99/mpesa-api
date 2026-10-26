---
'mpesa-api': minor
---

Daraja 3.0 M-Pesa Ratiba and Lipa na Bonga, neither of which needs an initiator:

- `ratiba.createStandingOrder` sets up a standing order that collects from a customer's M-Pesa on a schedule. Its result is read with the new `parseRatibaCallback`, which accepts both of the casings Daraja sends.
- `bonga.calculatePoints` and `bonga.redeem` let customers pay with Bonga points. The payment then arrives as an ordinary C2B confirmation.

See [M-Pesa Ratiba](https://newtonmunene99.github.io/mpesa-api/apis/ratiba) and [Lipa na Bonga](https://newtonmunene99.github.io/mpesa-api/apis/bonga).
