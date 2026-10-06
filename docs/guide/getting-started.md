# Getting started

## Before you start

1. Create an account on the [Daraja portal](https://developer.safaricom.co.ke/) and add an app. For sandbox testing, select the **Lipa Na M-Pesa Sandbox** and **M-Pesa Sandbox** products.
2. Copy the app's consumer key and secret.
3. Open any API page on the portal and select your app in the **Daraja Simulator** panel. It fills in the sandbox test values: shortcodes, the STK push passkey, and the initiator name and password.
4. Callbacks are posted to your server, so it must be reachable over HTTPS. See [IP whitelisting](/guide/callbacks#ip-whitelisting).

## Installation

```sh
npm i mpesa-api
# or
pnpm add mpesa-api
# or
yarn add mpesa-api
```

## Versions

- **4.x** targets Daraja 3.0. It is ESM only and needs Node.js 22.12+ (or Bun, Deno or an edge runtime). Upgrading? See [Migrating from 3.x](/migration).
- **3.x** supports CommonJS (`require`) and older Node versions. Install it with `npm i mpesa-api@3`. Bug and security fixes for 3.x are maintained on the [`v3.x`](https://github.com/newtonmunene99/mpesa-api/tree/v3.x) branch.

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
