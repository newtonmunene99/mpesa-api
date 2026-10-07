# Mpesa-Api

A typed client for Safaricom's [M-Pesa Daraja 3.0 API](https://developer.safaricom.co.ke/). It has no runtime dependencies and runs on Node.js, Bun, Deno and edge runtimes such as Cloudflare Workers.

|              | Badge                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI           | [![CI](https://github.com/newtonmunene99/mpesa-api/actions/workflows/ci.yml/badge.svg)](https://github.com/newtonmunene99/mpesa-api/actions/workflows/ci.yml) |
| Latest       | [![Latest](https://badgen.net/npm/v/mpesa-api)](https://www.npmjs.com/package/mpesa-api)                                                                      |
| Install size | [![Install size](https://badgen.net/packagephobia/install/mpesa-api)](https://packagephobia.com/result?p=mpesa-api)                                           |
| Node         | [![Node](https://img.shields.io/node/v/mpesa-api)](https://www.npmjs.com/package/mpesa-api)                                                                   |

**Documentation: [newtonmunene99.github.io/mpesa-api](https://newtonmunene99.github.io/mpesa-api/)**

Supported APIs:

- [M-Pesa Express (STK push) and its query](https://newtonmunene99.github.io/mpesa-api/apis/stk-push)
- [Dynamic QR codes](https://newtonmunene99.github.io/mpesa-api/apis/qr)
- [Customer to Business (C2B): register URLs and simulate](https://newtonmunene99.github.io/mpesa-api/apis/c2b)
- [Pull Transactions: the last 48 hours of C2B payments](https://newtonmunene99.github.io/mpesa-api/apis/pull-transactions)
- [Business to Customer (B2C) and Business To Pochi](https://newtonmunene99.github.io/mpesa-api/apis/b2c)
- [Business to Business (B2B): pay bill, buy goods, B2C account top up, tax remittance, Express CheckOut](https://newtonmunene99.github.io/mpesa-api/apis/b2b)
- [Transaction Status](https://newtonmunene99.github.io/mpesa-api/apis/transaction-status)
- [Account Balance](https://newtonmunene99.github.io/mpesa-api/apis/account-balance)
- [Reversal](https://newtonmunene99.github.io/mpesa-api/apis/reversal)
- [Callback parsers](https://newtonmunene99.github.io/mpesa-api/guide/callbacks) for all of the above

## Installation

```sh
npm i mpesa-api
# or
pnpm add mpesa-api
# or
yarn add mpesa-api
```

### Versions

- **4.x** targets Daraja 3.0. It is ESM only and needs Node.js 22.12+ (or Bun, Deno or an edge runtime). Upgrading? See [Migrating from 3.x](https://newtonmunene99.github.io/mpesa-api/migration).
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

Next, [get your Daraja credentials](https://newtonmunene99.github.io/mpesa-api/guide/getting-started) and read the [configuration](https://newtonmunene99.github.io/mpesa-api/guide/configuration) and [certificates](https://newtonmunene99.github.io/mpesa-api/guide/certificates) guides. Callbacks are posted to your server, so it must be reachable over HTTPS; see [IP whitelisting](https://newtonmunene99.github.io/mpesa-api/guide/callbacks#ip-whitelisting).

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
