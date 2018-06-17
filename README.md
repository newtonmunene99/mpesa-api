# Mpesa-Api

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

## RoadMap

-   [x] Basic Documentation
-   [x] Deploy to Npm
-   [ ] Detailed Documentation
-   [ ] Better Support for es5
-   [ ] Unit tests
-   [ ] E2E Integration Tests
-   [ ] Reduce functions
-   [ ] Validators for inputs

## Contributing

1.  Create your feature branch: `git checkout -b my-new-feature`
2.  Commit your changes: `git commit -m 'Add some feature'`
3.  Push to the branch: `git push origin my-new-feature`
4.  Submit a pull request.

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
