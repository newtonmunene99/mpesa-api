# Mpesa-Api

:zap: :bomb: :fire: :fire: :bomb: :zap:

**An NPM Module built with NodeJs to help you with M-Pesa Daraja API calls.**

## Prerequisites

1.  Node 6+.
2.  NPM(comes with Node).

## Installation

Mpesa-Api uses Node Package Manager

```
npm i mpesa-api
```

## Requisites

You Will need a few things before development.

1.  Consumer_Key
2.  Consumer_Secret
3.  Test Credentials for Development/Sanbox environment

## Getting Started

```javascript
// import package
import { mpesa } from 'mpesa-api';
// create a new instance of the api
const mpesa = new mpesa(credentials, environment);
```

A moment to explain the above. credentials should be an object containing key,secret,securitycredential and certificatepath as the properties.

```javascript
//example
const credentials = {
    key: 'YOUR_CONSUMER_KEY_HERE',
    secret: 'YOUR_CONSUMER_SECRET_HERE',
    securitycredential: 'YOUR_SECURITY_CREDENTIAL_HERE',
    certificatepath: 'keys/example.cert'
};
// certificate path is otional when running in sandbox/development environment. If you choose not to include it Pass it as null.
const credentials = {
    ...,
    certificatepath: null
};
```

Environment should be a string. It can be either 'production' or 'sandbox'

```javascript
const environment = 'sandbox';
//or
const environment = 'production';
```

## Methods and Api Calls

Docs Coming Soon

#### Business to Business

Docs Coming Soon

#### b2c

Docs Coming Soon

#### Account Balance

Docs Coming Soon

#### Lipa na mpesa online

Docs Coming Soon

#### Lipa na mpesa online query

Docs Coming Soon

## RoadMap

-   [x] Basic Documentation
-   [x] Deploy to Npm
-   [ ] Detailed Documentation
-   [ ] Better Support for es5
-   [ ] Unit tests
-   [ ] E2E Integration Tests
-   [ ] Reduce functions
-   [ ] Validators for inputs

## Build

If you Wish to build

1.  Clone this repo
2.  CD into repo
3.  run `npm install` to install dependencies
4.  run `npm run build` to build
5.  run `npm run start` to run package
6.  `npm run dev` has some issues with nodemon and babel, please refrain for now. Or fix it if you can.

## Contributing

1.  Create your feature branch: `git checkout -b my-new-feature`
2.  Commit your changes: `git commit -m 'Add some feature'`
3.  Push to the branch: `git push origin my-new-feature`
4.  Submit a pull request.

## Disclaimer

**Please note that the certificate included is not for production use and should not be used for whatever reason other than testing. Obtain your own from Safaricom. I would also like to point out that it does not belong to me or to my organization and I am not liable for any actions taken using it.**

## Credits

| **Contributor** |
<br/>
| [NewtonMunene](https://github.com/newtonmunene99) |

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
