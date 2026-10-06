# Changelog

Notable changes to this project will be documented in this file.

## 4.0.0-alpha.0

### Major Changes

- [#48](https://github.com/newtonmunene99/mpesa-api/pull/48) [`55f249e`](https://github.com/newtonmunene99/mpesa-api/commit/55f249e865b8f7dd9c607d3e752596d9b3047c86) Thanks [@newtonmunene99](https://github.com/newtonmunene99)! - New client for Daraja 3.0. `new Mpesa(credentials, environment)` is replaced by `createMpesa({ environment, consumerKey, consumerSecret, passkey?, initiator? })`, with one namespace per API: `stkPush.send` and `stkPush.query`, `c2b.registerUrls` and `c2b.simulate`, `b2c.pay`, `transactionStatus.query`, `accountBalance.query` and `reversal.request`. B2B (listed as deprecated in the 3.x README but never implemented) is not supported.

  - **Daraja 3.0 endpoints:** C2B moves to v2 and B2C to v3, which sends an `OriginatorConversationID` (generated if you don't pass one) so duplicate payments are rejected. Transaction Status accepts `originalConversationId`.
  - **camelCase:** inputs and responses use camelCase, and every response keeps Daraja's body in `raw`. Each API's page in the [docs](https://newtonmunene99.github.io/mpesa-api/) lists the Daraja name of every field.
  - **Money as cents:** amounts read from callbacks are exact integer cents in `…Cents` fields (`amountCents`, `transAmountCents`, `availableCents`); amounts sent to Daraja stay in whole shillings.
  - **Wire changes:** B2C sends `Occassion` (the Daraja 3.0 spelling) instead of `Occasion`; Reversal always sends `RecieverIdentifierType` `"11"` (3.x defaulted to `"4"`) and no `Occasion`; B2C and Reversal `remarks` are required (3.x defaulted them to `"account"` and `"Transaction Reversal"`); C2B simulate needs `billRefNumber` for paybill.
  - **Credentials:** the initiator is optional and set once on the client, as a name with a password and certificate, or with a `securityCredential` generated on the Daraja portal. The bundled certificates are removed; pass your own as PEM text or DER bytes.
  - **New:** input validation that reports every problem at once, typed errors (`ValidationError`, `AuthError`, `DarajaApiError`, `NetworkError`), a pluggable `TokenStore`, and callback parsers (`parseStkCallback`, `parseResult`, `parseC2BNotification`, `parseBalances`, `c2bValidationResponse`).
  - **Runtimes:** no runtime dependencies and no Node built-ins, so it also runs on Bun, Deno and edge runtimes.

  See [Migrating from 3.x](https://newtonmunene99.github.io/mpesa-api/migration) for every renamed method and field.

- [#47](https://github.com/newtonmunene99/mpesa-api/pull/47) [`6b0673f`](https://github.com/newtonmunene99/mpesa-api/commit/6b0673fe0e50e26fc2439d55803fdebd2aebc177) Thanks [@newtonmunene99](https://github.com/newtonmunene99)! - Modernised toolchain and packaging. `mpesa-api` is now an ESM-only package for Node.js 22.12 or later, built into `dist/` and exporting only the package root. `require('mpesa-api')` works only through Node's `require(esm)` support and is not officially supported. Deep imports such as `mpesa-api/lib/...` no longer resolve. Releases are no longer published to GitHub Packages. To stay on 3.x, install `mpesa-api@3`; fixes are maintained on the `v3.x` branch.

## [3.0.2] - 31/01/2021

- Merge [#26]('https://github.com/newtonmunene99/mpesa-api/pull/26'). Fixes misleading parameter typos on README

## [3.0.1] - 06/01/2021

- Whitelists `/lib/` folder

## [3.0.0] - 28/12/2020

- Adds support for a self generated security credential. Check how to do this on the [going live page]('https://developer.safaricom.co.ke/docs#step-by-step-go-live-guide').
- Removes dependency on [axios]('https://www.npmjs.com/package/axios'). Package now uses node's native `http` and `https` packages.
- Adds Shallow tests for public API methods.
- Improves existing jsdoc comments.

## [3.0.0-beta.0] - 28/12/2020

- Adds support for a self generated security credential. Check how to do this on the [going live page]('https://developer.safaricom.co.ke/docs#step-by-step-go-live-guide').
- Removes dependency on [axios]('https://www.npmjs.com/package/axios'). Package now uses node's native `http` and `https` packages.
- Adds Shallow tests for public API methods.
- Improves existing jsdoc comments.
