---
'mpesa-api': major
---

New client for Daraja 3.0. `new Mpesa(credentials, environment)` is replaced by `createMpesa({ environment, consumerKey, consumerSecret, passkey?, initiator? })`, with one namespace per API: `stkPush.send` and `stkPush.query`, `c2b.registerUrls` and `c2b.simulate`, `b2c.pay`, `transactionStatus.query`, `accountBalance.query` and `reversal.request`. B2B (listed as deprecated in the 3.x README but never implemented) is not supported.

- **Daraja 3.0 endpoints:** C2B moves to v2 and B2C to v3, which sends an `OriginatorConversationID` (generated if you don't pass one) so duplicate payments are rejected. Transaction Status accepts `originalConversationId`.
- **camelCase:** inputs and responses use camelCase, and every response keeps Daraja's body in `raw`. The README lists each field's Daraja name.
- **Wire changes:** B2C sends `Occassion` (the Daraja 3.0 spelling) instead of `Occasion`; Reversal always sends `RecieverIdentifierType` `"11"` (3.x defaulted to `"4"`) and no `Occasion`; B2C and Reversal `remarks` are required (3.x defaulted them to `"account"` and `"Transaction Reversal"`); C2B simulate needs `billRefNumber` for paybill.
- **Credentials:** the initiator is optional and set once on the client, as a name with a password and certificate, or with a `securityCredential` generated on the Daraja portal. The bundled certificates are removed; pass your own as PEM text or DER bytes.
- **New:** input validation that reports every problem at once, typed errors (`ValidationError`, `AuthError`, `DarajaApiError`, `NetworkError`), a pluggable `TokenStore`, and callback parsers (`parseStkCallback`, `parseResult`, `parseC2BNotification`, `parseBalances`, `c2bValidationResponse`).
- **Runtimes:** no runtime dependencies and no Node built-ins, so it also runs on Bun, Deno and edge runtimes.

See the README's "Migrating from 3.x" table for every renamed method and field.
