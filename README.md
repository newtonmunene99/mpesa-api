# Mpesa-Api

A typed client for Safaricom's [M-Pesa Daraja 3.0 API](https://developer.safaricom.co.ke/). It has no runtime dependencies and runs on Node.js, Bun, Deno and edge runtimes such as Cloudflare Workers.

|              | Badge                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI           | [![CI](https://github.com/newtonmunene99/mpesa-api/actions/workflows/ci.yml/badge.svg)](https://github.com/newtonmunene99/mpesa-api/actions/workflows/ci.yml) |
| Latest       | [![Latest](https://badgen.net/npm/v/mpesa-api)](https://www.npmjs.com/package/mpesa-api)                                                                      |
| Install size | [![Install size](https://badgen.net/packagephobia/install/mpesa-api)](https://packagephobia.com/result?p=mpesa-api)                                           |
| Node         | [![Node](https://img.shields.io/node/v/mpesa-api)](https://www.npmjs.com/package/mpesa-api)                                                                   |

Supported APIs:

- [M-Pesa Express (STK push) and its query](#m-pesa-express-stk-push)
- [Customer to Business (C2B): register URLs and simulate](#customer-to-business-c2b)
- [Business to Customer (B2C)](#business-to-customer-b2c)
- [Transaction Status](#transaction-status)
- [Account Balance](#account-balance)
- [Reversal](#reversal)
- [Callback parsers](#callbacks) for all of the above

## Installation

```sh
npm i mpesa-api
# or
pnpm add mpesa-api
# or
yarn add mpesa-api
```

### Versions

- **4.x** targets Daraja 3.0. It is ESM only and needs Node.js 22.12+ (or Bun, Deno or an edge runtime). Upgrading? See [Migrating from 3.x](#migrating-from-3x).
- **3.x** supports CommonJS (`require`) and older Node versions. Install it with `npm i mpesa-api@3`. Bug and security fixes for 3.x are maintained on the [`v3.x`](https://github.com/newtonmunene99/mpesa-api/tree/v3.x) branch.

## Before you start

1. Create an account on the [Daraja portal](https://developer.safaricom.co.ke/) and add an app. For sandbox testing, select the **Lipa Na M-Pesa Sandbox** and **M-Pesa Sandbox** products.
2. Copy the app's consumer key and secret.
3. Open any API page on the portal and select your app in the **Daraja Simulator** panel. It fills in the sandbox test values: shortcodes, the STK push passkey, and the initiator name and password.
4. Callbacks are posted to your server, so it must be reachable over HTTPS. See [IP whitelisting](#ip-whitelisting).

## Quick start

```ts
import { createMpesa } from 'mpesa-api';

const mpesa = createMpesa({
  environment: 'sandbox',
  consumerKey: process.env.MPESA_CONSUMER_KEY!,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
  passkey: process.env.MPESA_PASSKEY!,
});

const { checkoutRequestId } = await mpesa.stkPush.send({
  shortCode: 174379,
  type: 'paybill',
  amount: 1,
  phoneNumber: '0708374149',
  callbackUrl: 'https://example.com/payments/stk',
  accountReference: 'INV-001',
});
console.log(checkoutRequestId);
```

`createMpesa` makes no network calls. The access token is fetched on the first API call, cached, and refreshed before it expires.

## Configuration

| Field            | Type                        | Description                                                                                                              |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `environment`    | `'sandbox' \| 'production'` | Required. Selects `sandbox.safaricom.co.ke` or `api.safaricom.co.ke`.                                                    |
| `consumerKey`    | `string`                    | Required. From your Daraja app.                                                                                          |
| `consumerSecret` | `string`                    | Required. From your Daraja app.                                                                                          |
| `passkey`        | `string`                    | The Lipa na M-Pesa Online passkey. Required for `stkPush`.                                                               |
| `initiator`      | `Initiator`                 | The API operator. Required for B2C, Transaction Status, Account Balance and Reversal. See [Certificates](#certificates). |
| `tokenStore`     | `TokenStore`                | Where access tokens are cached. Defaults to memory. See [Token store](#token-store).                                     |
| `timeoutMs`      | `number`                    | Per-request timeout. Defaults to 30 000.                                                                                 |
| `fetch`          | `typeof fetch`              | The fetch implementation. Defaults to the global `fetch`.                                                                |
| `onWarning`      | `(message: string) => void` | Receives non-fatal warnings, such as an expired certificate.                                                             |

`createMpesa` validates the configuration and throws a `ValidationError` listing every problem.

## Certificates

The initiator APIs (B2C, Transaction Status, Account Balance and Reversal) need a **security credential**: the initiator's password encrypted with Safaricom's public certificate. There are two ways to provide it.

**Let the SDK encrypt the password.** Pass the initiator's name and password with the certificate for the environment, either as PEM text or DER bytes. The SDK doesn't bundle certificates; get them from Safaricom.

```ts
import { readFile } from 'node:fs/promises';

const mpesa = createMpesa({
  environment: 'production',
  consumerKey: process.env.MPESA_CONSUMER_KEY!,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
  initiator: {
    name: 'apiuser',
    password: process.env.MPESA_INITIATOR_PASSWORD!,
    certificate: await readFile('certs/ProductionCertificate.cer', 'utf8'),
  },
});
```

On edge runtimes there is no file system, so read the PEM text from an environment variable or a bundled asset instead: `certificate: env.MPESA_CERTIFICATE_PEM`.

**Or pass a security credential you generated.** The portal's **Test Credentials** page encrypts a password for sandbox or production. This avoids handling the certificate at all.

```ts
const mpesa = createMpesa({
  environment: 'sandbox',
  consumerKey: process.env.MPESA_CONSUMER_KEY!,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
  initiator: { name: 'testapi', securityCredential: process.env.MPESA_SECURITY_CREDENTIAL! },
});
```

Notes:

- The sandbox certificate Safaricom still distributes expired in 2016. The SDK warns through `onWarning` when a certificate has expired but still uses it.
- The SDK's own encryption (RSA PKCS#1 v1.5, the same as Safaricom's libraries) is tested against OpenSSL, but has not yet been confirmed against the live sandbox: its B2C results were unavailable when 4.0 was tested. If you get a `2001` result with the password and certificate, use a security credential generated on the portal instead, and please [open an issue](https://github.com/newtonmunene99/mpesa-api/issues).
- A B2C result with code `2001` ("The initiator information is invalid") means the name, password or encryption was rejected.
- The shared sandbox initiator is sometimes locked (`8006`, "The security credential is locked"), probably by other developers' failed attempts. Only Safaricom can unlock it.

## M-Pesa Express (STK push)

Sends a payment prompt to the customer's phone. The result is posted to `callbackUrl`; read it with [`parseStkCallback`](#callbacks).

```ts
const sent = await mpesa.stkPush.send({
  shortCode: 174379,
  type: 'paybill',
  amount: 100,
  phoneNumber: '0712345678',
  callbackUrl: 'https://example.com/payments/stk',
  accountReference: 'INV-001',
  description: 'Invoice 001',
});

const status = await mpesa.stkPush.query({
  shortCode: 174379,
  checkoutRequestId: sent.checkoutRequestId,
});
if (status.resultCode === 0) console.log('paid');
```

`stkPush.send`:

| Field              | Daraja field            | Notes                                                                     |
| ------------------ | ----------------------- | ------------------------------------------------------------------------- |
| `shortCode`        | `BusinessShortCode`     | Paybill, or the HO/store number for till payments.                        |
| `type`             | `TransactionType`       | `'paybill'` (CustomerPayBillOnline) or `'till'` (CustomerBuyGoodsOnline). |
| `amount`           | `Amount`                | Whole shillings, at least 1.                                              |
| `phoneNumber`      | `PartyA`, `PhoneNumber` | `07…`, `01…`, `+254…` or `254…`.                                          |
| `partyB`           | `PartyB`                | Optional. Defaults to `shortCode`; set it to the till number for tills.   |
| `callbackUrl`      | `CallBackURL`           | Receives the result.                                                      |
| `accountReference` | `AccountReference`      | Shown to the customer. 1 to 12 characters.                                |
| `description`      | `TransactionDesc`       | Optional. 1 to 13 characters; defaults to "Payment".                      |

`Password` and `Timestamp` are generated from the configured `passkey`.

`stkPush.query` takes `shortCode` (`BusinessShortCode`) and `checkoutRequestId` (`CheckoutRequestID`), and returns `resultCode` (0 means paid; 1032 means the customer cancelled, 1037 that they didn't respond). Querying within about 30 seconds of the push can fail with `500.001.1001` "The transaction does not Exist"; retry later, or rely on the callback.

## Customer to Business (C2B)

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

## Business to Customer (B2C)

Pays a customer from a B2C shortcode. The acknowledgement only confirms that Daraja received the request; the outcome is posted to `resultUrl`.

```ts
const payment = await mpesa.b2c.pay({
  commandId: 'BusinessPayment',
  amount: 500,
  shortCode: 600999,
  phoneNumber: '0712345678',
  remarks: 'Refund for order 42',
  resultUrl: 'https://example.com/payments/b2c/result',
  queueTimeoutUrl: 'https://example.com/payments/b2c/timeout',
});
// Store this: it identifies the payment in the result and in status queries.
console.log(payment.originatorConversationId);
```

| Field                      | Daraja field               | Notes                                                           |
| -------------------------- | -------------------------- | --------------------------------------------------------------- |
| `originatorConversationId` | `OriginatorConversationID` | Optional. Your unique ID; defaults to a random UUID.            |
| `commandId`                | `CommandID`                | `'SalaryPayment'`, `'BusinessPayment'` or `'PromotionPayment'`. |
| `amount`                   | `Amount`                   | Whole shillings, 10 to 250 000.                                 |
| `shortCode`                | `PartyA`                   | The B2C shortcode paying out.                                   |
| `phoneNumber`              | `PartyB`                   | The customer's number.                                          |
| `remarks`                  | `Remarks`                  | 2 to 100 characters.                                            |
| `resultUrl`                | `ResultURL`                | Receives the result.                                            |
| `queueTimeoutUrl`          | `QueueTimeOutURL`          | Receives a notice if the request times out in the queue.        |
| `occasion`                 | `Occassion`                | Optional. 1 to 100 characters. See the note below.              |

If the request to Daraja fails (a network error, timeout or `DarajaApiError`), the thrown error carries `originatorConversationId`. Query the payment's status with that ID before retrying, so the customer isn't paid twice. Errors thrown before sending, such as a `ValidationError`, don't carry it.

`Occassion` is the spelling in the Daraja 3.0 docs and the portal simulator; B2C v1 used `Occasion`. The sandbox acknowledged both when 4.0 was tested, but no result arrived to show which one Daraja reads. It is a free-text note, so a wrong spelling probably at worst drops it.

## Transaction Status

```ts
await mpesa.transactionStatus.query({
  originalConversationId: 'the ID returned by b2c.pay',
  partyA: 600999,
  resultUrl: 'https://example.com/payments/status/result',
  queueTimeoutUrl: 'https://example.com/payments/status/timeout',
});
```

| Field                    | Daraja field             | Notes                                                                    |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| `transactionId`          | `TransactionID`          | The M-Pesa receipt number. Give this, `originalConversationId`, or both. |
| `originalConversationId` | `OriginalConversationID` | The `OriginatorConversationID` of the request to check.                  |
| `partyA`                 | `PartyA`                 | The shortcode or phone number involved.                                  |
| `identifierType`         | `IdentifierType`         | Optional. `'shortcode'` (default), `'till'` or `'msisdn'`.               |
| `resultUrl`              | `ResultURL`              | Receives the status.                                                     |
| `queueTimeoutUrl`        | `QueueTimeOutURL`        | Receives a notice if the request times out in the queue.                 |
| `remarks`                | `Remarks`                | Optional. Up to 100 characters.                                          |
| `occasion`               | `Occasion`               | Optional. Up to 100 characters.                                          |

## Account Balance

```ts
await mpesa.accountBalance.query({
  partyA: 600999,
  resultUrl: 'https://example.com/payments/balance/result',
  queueTimeoutUrl: 'https://example.com/payments/balance/timeout',
});
```

Takes `partyA` (`PartyA`), an optional `identifierType` (`IdentifierType`), `resultUrl` (`ResultURL`), `queueTimeoutUrl` (`QueueTimeOutURL`) and optional `remarks` (`Remarks`, up to 100 characters, defaults to "Account balance"). The balances arrive at `resultUrl` as one packed string; split it with [`parseBalances`](#callbacks).

## Reversal

Reverses a C2B transaction. B2C payments can't be reversed through the API.

```ts
await mpesa.reversal.request({
  transactionId: 'UIU030F3PZ',
  amount: 100,
  receiverParty: 600984,
  remarks: 'Paid twice',
  resultUrl: 'https://example.com/payments/reversal/result',
  queueTimeoutUrl: 'https://example.com/payments/reversal/timeout',
});
```

| Field             | Daraja field      | Notes                                       |
| ----------------- | ----------------- | ------------------------------------------- |
| `transactionId`   | `TransactionID`   | The M-Pesa receipt number to reverse.       |
| `amount`          | `Amount`          | Whole shillings.                            |
| `receiverParty`   | `ReceiverParty`   | Your organisation's shortcode.              |
| `remarks`         | `Remarks`         | 2 to 100 characters.                        |
| `resultUrl`       | `ResultURL`       | Receives the result.                        |
| `queueTimeoutUrl` | `QueueTimeOutURL` | Receives a notice if the request times out. |

`RecieverIdentifierType` (Daraja's spelling) is always `"11"`.

## Responses

Every call returns camelCase fields plus `raw`, Daraja's unmodified response body.

| Call                                                                             | Returns (type)                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `stkPush.send`                                                                   | `StkPushResponse`: `merchantRequestId`, `checkoutRequestId`, `responseCode`, `responseDescription`, `customerMessage`           |
| `stkPush.query`                                                                  | `StkQueryResponse`: `merchantRequestId`, `checkoutRequestId`, `responseCode`, `responseDescription`, `resultCode`, `resultDesc` |
| `c2b.registerUrls`, `c2b.simulate`                                               | `C2BResponse`: `originatorConversationId`, `responseCode`, `responseDescription`                                                |
| `b2c.pay`, `transactionStatus.query`, `accountBalance.query`, `reversal.request` | `InitiatorResponse`: `conversationId`, `originatorConversationId`, `responseCode`, `responseDescription`                        |

## Callbacks

Daraja posts results to the URLs you give it. The parsers take the already-parsed JSON body, validate it, and return typed objects; they throw a `ValidationError` if required fields are missing.

| Parser                       | For                                                           |
| ---------------------------- | ------------------------------------------------------------- |
| `parseStkCallback(body)`     | STK push callbacks                                            |
| `parseResult(body)`          | B2C, Transaction Status, Account Balance and Reversal results |
| `parseC2BNotification(body)` | C2B validation and confirmation requests                      |
| `parseBalances(value)`       | The packed `AccountBalance` or `DebitAccountBalance` value    |
| `c2bValidationResponse`      | Builds the reply to a C2B validation request                  |

What each parser returns:

- `parseStkCallback` → `StkCallback`: `merchantRequestId`, `checkoutRequestId`, `resultCode`, `resultDesc`, `ok`, `raw`, and `metadata` (`StkCallbackMetadata`: `amount`, `mpesaReceiptNumber`, `balance`, `transactionDate` as a `Date`, `phoneNumber`) on success.
- `parseResult` → `DarajaResult`: `resultType`, `resultCode`, `resultDesc`, `ok`, `originatorConversationId`, `conversationId`, `transactionId`, `parameters` (`ResultParameters` flattened by key, with the documented dates converted to `Date`), `referenceData` and `raw`.
- `parseC2BNotification` → `C2BNotification`: `transactionType`, `transId`, `transTime` (a `Date`), `transAmount`, `businessShortCode`, `billRefNumber`, `invoiceNumber`, `orgAccountBalance` (absent on validation requests), `thirdPartyTransId`, `msisdn` (masked by Daraja), `firstName`, `middleName`, `lastName` and `raw`.
- `parseBalances` → `AccountBalanceEntry[]`: `account`, `currency`, `available`, `uncleared`, `reserved`, `unreserved`.
- `c2bValidationResponse.accept(thirdPartyTransId?)` and `.reject(code: C2BRejectionCode)` → `C2BValidationResponse`, the JSON body to send back.

`ok` means `resultCode === 0`. Result codes are numbers, except non-numeric ones such as `"R000002"`, which stay strings.

With Express:

```ts
app.post('/payments/stk', (req, res) => {
  const callback = parseStkCallback(req.body);
  if (callback.ok) {
    void savePayment(callback.checkoutRequestId, callback.metadata?.mpesaReceiptNumber);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.post('/payments/c2b/validation', (req, res) => {
  const payment = parseC2BNotification(req.body);
  res.json(
    accountExists(payment.billRefNumber)
      ? c2bValidationResponse.accept()
      : c2bValidationResponse.reject('C2B00012'),
  );
});

app.post('/payments/balance/result', (req, res) => {
  const result = parseResult(req.body);
  const packed = result.parameters.AccountBalance;
  if (result.ok && typeof packed === 'string') console.log(parseBalances(packed));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

With Hono or any fetch-based runtime:

```ts
app.post('/payments/b2c/result', async (c) => {
  const result = parseResult(await c.req.json());
  if (!result.ok) console.warn(result.resultCode, result.resultDesc);
  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

Callbacks are unauthenticated POST requests, so treat their contents as untrusted. Confirm important payments with Transaction Status, and restrict the callback routes to [Safaricom's IPs](#ip-whitelisting).

C2B validation rejection codes: `C2B00011` invalid MSISDN, `C2B00012` invalid account number, `C2B00013` invalid amount, `C2B00014` invalid KYC details, `C2B00015` invalid shortcode, `C2B00016` other error.

## Errors

Every error extends `MpesaError`. `ValidationError.issues` is a list of `ValidationIssue`.

| Class             | When                                                                                     | Useful fields                                              |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ValidationError` | Invalid input or config. Nothing was sent.                                               | `issues: { path, message }[]`                              |
| `AuthError`       | The token request failed, usually a wrong consumer key or secret.                        | `status`, `errorCode`                                      |
| `DarajaApiError`  | Daraja rejected the request, or accepted it with a non-zero `ResponseCode`.              | `status`, `errorCode`, `errorMessage`, `requestId`, `body` |
| `NetworkError`    | No usable response: a network failure, a timeout, or a success response that isn't JSON. | `cause` (for network failures and timeouts)                |

```ts
try {
  await mpesa.accountBalance.query({
    partyA: 600999,
    resultUrl: 'https://example.com/payments/balance/result',
    queueTimeoutUrl: 'https://example.com/payments/balance/timeout',
  });
} catch (error) {
  if (error instanceof ValidationError) console.error(error.issues);
  else if (error instanceof DarajaApiError) console.error(error.errorCode, error.errorMessage);
  else if (error instanceof AuthError) console.error('Check the consumer key and secret');
  else if (error instanceof NetworkError) console.error('Retry later', error.cause);
  else throw error;
}
```

A rejected token (HTTP 401 or Daraja's invalid-token codes) is refreshed and the request retried once automatically.

## Token store

Each new Daraja token invalidates the previous one, so every process sharing a consumer key should share one token. By default tokens are cached in a `MemoryTokenStore`, per client. To share them across processes or serverless instances, pass a `TokenStore`, for example backed by Redis:

```ts
import { type CachedToken, type TokenStore } from 'mpesa-api';

const tokenStore: TokenStore = {
  async get(key) {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as CachedToken) : undefined;
  },
  async set(key, token) {
    await redis.set(key, JSON.stringify(token), 'PXAT', token.expiresAt);
  },
};
```

Keys include the environment and a hash of the consumer key, never the key itself. A failing store never fails a request: a failed `set` is reported through `onWarning`, and a failed `get` falls back to fetching a new token. A `CachedToken` is `{ accessToken, expiresAt }`, with `expiresAt` in epoch milliseconds.

## Runtimes

The package uses only web-standard APIs (`fetch`, `AbortSignal.timeout`, `crypto.subtle`, `crypto.getRandomValues`, `crypto.randomUUID`, `TextEncoder`, `btoa`/`atob` and `BigInt`), with no Node built-ins, so it runs on Node.js 22.12+, Bun, Deno and edge runtimes. Only reading a certificate file needs a file system; pass the PEM text instead on edge runtimes.

## Limits

| API                | Rule                                                             |
| ------------------ | ---------------------------------------------------------------- |
| STK push           | `accountReference` 1–12 characters, `description` 1–13           |
| B2C                | `amount` 10 to 250 000; `remarks` 2–100 characters               |
| Reversal           | `remarks` 2–100 characters                                       |
| Phone numbers      | Kenyan Safaricom numbers (`07…`, `01…`); sent as `2547…`/`2541…` |
| Shortcodes         | 5 to 7 digits; `partyA` and `receiverParty` accept 5 to 9        |
| URLs in production | `https` only                                                     |

## Exports

| Export                                                                                                                                      | Kind     | Description                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `createMpesa`                                                                                                                               | function | Creates a client (`Mpesa`) from an `MpesaConfig`.                        |
| `MemoryTokenStore`                                                                                                                          | class    | The default in-memory `TokenStore`.                                      |
| `parseStkCallback`, `parseResult`, `parseC2BNotification`, `parseBalances`                                                                  | function | [Callback](#callbacks) parsers.                                          |
| `c2bValidationResponse`                                                                                                                     | object   | Builds C2B validation replies.                                           |
| `MpesaError`, `ValidationError`, `AuthError`, `DarajaApiError`, `NetworkError`                                                              | class    | [Errors](#errors).                                                       |
| `Mpesa`, `MpesaConfig`, `Environment`, `Initiator`                                                                                          | type     | The client, its [configuration](#configuration) and credentials.         |
| `TokenStore`, `CachedToken`                                                                                                                 | type     | The [token store](#token-store) interface and its value.                 |
| `StkPushApi`, `StkPushInput`, `StkPushResponse`, `StkQueryInput`, `StkQueryResponse`                                                        | type     | [M-Pesa Express](#m-pesa-express-stk-push).                              |
| `C2BApi`, `C2BRegisterInput`, `C2BSimulateInput`, `C2BResponse`                                                                             | type     | [C2B](#customer-to-business-c2b).                                        |
| `B2CApi`, `B2CInput`, `B2CCommand`                                                                                                          | type     | [B2C](#business-to-customer-b2c); `B2CCommand` is the `commandId` union. |
| `TransactionStatusApi`, `TransactionStatusInput`                                                                                            | type     | [Transaction Status](#transaction-status).                               |
| `AccountBalanceApi`, `AccountBalanceInput`                                                                                                  | type     | [Account Balance](#account-balance).                                     |
| `ReversalApi`, `ReversalInput`                                                                                                              | type     | [Reversal](#reversal).                                                   |
| `InitiatorResponse`                                                                                                                         | type     | The acknowledgement from the four initiator APIs.                        |
| `IdentifierType`                                                                                                                            | type     | `'shortcode' \| 'till' \| 'msisdn'`, for `identifierType`.               |
| `StkCallback`, `StkCallbackMetadata`, `DarajaResult`, `C2BNotification`, `AccountBalanceEntry`, `C2BValidationResponse`, `C2BRejectionCode` | type     | Callback parser results and the validation reply.                        |
| `ValidationIssue`                                                                                                                           | type     | One entry of `ValidationError.issues`: `{ path, message }`.              |

## Migrating from 3.x

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

Field names change from Daraja's PascalCase to camelCase; each API's table above lists the mapping. Derived fields (`CommandID` for Transaction Status, Account Balance and Reversal, `IdentifierType`, STK `Password` and `Timestamp`) are filled in for you. New in 4.x: the callback parsers, typed errors, input validation, a pluggable token store, and B2C's `OriginatorConversationID`.

## IP Whitelisting

You might need to whitelist Mpesa IPs listed below on the server/firewall that receives the callbacks.

<details>
  <summary>View List</summary>

- 196.201.214.200
- 196.201.214.206
- 196.201.213.114
- 196.201.214.207
- 196.201.214.208
- 196.201.213.44
- 196.201.212.127
- 196.201.212.128
- 196.201.212.129
- 196.201.212.132
- 196.201.212.136
- 196.201.212.138

</details>

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, the checks to run, and how releases work. Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md), and report security issues privately as described in [SECURITY.md](./SECURITY.md).

## Credits

| Name                                               | Role        |
| -------------------------------------------------- | ----------- |
| [Newton Munene](https://github.com/newtonmunene99) | Contributor |
| [Nelson Bwogora](https://github.com/nelsonBlack)   | Contributor |

## License

MIT License

Copyright (c) 2018 Newton Munene

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
