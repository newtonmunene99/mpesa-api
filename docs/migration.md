# Migrating from 3.x

4.0 is a rewrite for Daraja 3.0. Inputs and outputs are camelCase, credentials are set once on the client, and C2B and B2C use the new endpoints (C2B v2, B2C v3).

| 3.x                                                             | 4.x                                                 |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `new Mpesa(credentials, environment)`                           | `createMpesa({ environment, ... })`                 |
| `credentials.clientKey`                                         | `consumerKey`                                       |
| `credentials.clientSecret`                                      | `consumerSecret`                                    |
| `credentials.initiatorPassword`                                 | `initiator.password`                                |
| `credentials.certificatePath` (a file path)                     | `initiator.certificate` (the PEM text or DER bytes) |
| `credentials.securityCredential`                                | `initiator.securityCredential`                      |
| `Initiator` on each call                                        | `initiator.name`, set once                          |
| `passKey` on each STK call                                      | `passkey`, set once                                 |
| `lipaNaMpesaOnline(...)`                                        | `stkPush.send(...)`                                 |
| `lipaNaMpesaQuery(...)`                                         | `stkPush.query(...)`                                |
| `c2bRegister(...)`                                              | `c2b.registerUrls(...)`                             |
| `c2bSimulate(...)`                                              | `c2b.simulate(...)`                                 |
| `b2c(...)`                                                      | `b2c.pay(...)`                                      |
| `accountBalance(...)`                                           | `accountBalance.query(...)`                         |
| `transactionStatus(...)`                                        | `transactionStatus.query(...)`                      |
| `reversal(...)`                                                 | `reversal.request(...)`                             |
| B2B (listed as deprecated in the 3.x README, never implemented) | Not supported                                       |
| Daraja's raw response                                           | camelCase fields, with Daraja's body in `raw`       |
| Bundled certificates                                            | None; pass your own, or a `securityCredential`      |
| `require('mpesa-api')`                                          | ESM `import` only; stay on 3.x for CommonJS         |

Behaviour changes on the wire:

- B2C sends `Occassion` (the Daraja 3.0 spelling) instead of `Occasion`, and adds `OriginatorConversationID`.
- Reversal's `RecieverIdentifierType` is always `"11"` (3.x defaulted to `"4"`), and Reversal no longer sends `Occasion`.
- B2C and Reversal `remarks` are required, 2 to 100 characters. 3.x defaulted B2C `Remarks` to `"account"` and Reversal's to `"Transaction Reversal"`. Transaction Status still defaults `remarks` (now "Transaction status") but no longer sends a default `Occasion`.
- `initiator` is optional; it's only needed for B2C, Transaction Status, Account Balance and Reversal. 3.x required `initiatorPassword` or `securityCredential` for every client.
- C2B simulate no longer defaults `BillRefNumber` to `"account"`; it's required for paybill.

Field names change from Daraja's PascalCase to camelCase; the table on each [API page](/apis/stk-push) lists the mapping. Derived fields (`CommandID` for Transaction Status, Account Balance and Reversal, `IdentifierType`, STK `Password` and `Timestamp`) are filled in for you. New in 4.x: the callback parsers, typed errors, input validation, a pluggable token store, and B2C's `OriginatorConversationID`.
