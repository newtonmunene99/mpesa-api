# Mpesa-Api

:zap: :bomb: :fire: :fire: :bomb: :zap:

An NPM Module built with NodeJs to help you with M-Pesa Daraja API calls.

Please note that this module is intended for use in a node environment on the backend and will raise a few issues if used on the client side/browser environment. This is mainly due to the file system.

**Looking for contributors who can help write tests.**

|          | Badge                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Travis   | [![Build Status](https://travis-ci.org/newtonmunene99/mpesa-api.svg?branch=master)](https://travis-ci.org/newtonmunene99/mpesa-api) |
| Latest   | [![Latest](https://badgen.net/npm/v/mpesa-api)](https://www.npmjs.com/package/mpesa-api)                                            |
| Minified | [![Minified Size](https://badgen.net/bundlephobia/min/mpesa-api)](https://bundlephobia.com/result?p=mpesa-api)                      |
| MinZip   | [![Min](https://badgen.net/bundlephobia/minzip/mpesa-api)](https://bundlephobia.com/result?p=mpesa-api)                             |

Ready Methods

- [x] [B2B](#business-to-business) - **DEPRECATED**
- [x] [C2B](#c2b)
- [x] [B2C](#business-to-customer-b2c)
- [x] [TRANSACTION STATUS](#transaction-status)
- [x] [ACCOUNT BALANCE](#account-balance)
- [x] [REVERSAL](#reversal)
- [x] [LIPA NA MPESA STK PUSH](#lipa-na-mpesa-online)
- [x] [LIPA NA MPESA QUERY](#lipa-na-mpesa-online-query)

## Prerequisites

1.  Node 6+.
2.  NPM(comes with Node) or Yarn.

## Installation

Mpesa-Api uses Node Package Manager

```
npm i mpesa-api
```

Or Yarn

```
yarn add mpesa-api
```

## Requisites

You Will need a few things from Safaricom before development.

1.  Consumer Key
2.  Consumer Secret
3.  Test Credentials for Development/Sanbox environment
4.  [Callback server with Mpesa apis whitelisted](#ip-whitelisting) 
- Login or Register as a Safaricom developer [here](https://developer.safaricom.co.ke/login-register) if you haven't.
- Add a new App [here](https://developer.safaricom.co.ke/user/me/apps)
- You will be issued with a Consumer Key and Consumer Secret. You will use these to initiate an Mpesa Instance.
- Obtain Test Credentials [here](https://developer.safaricom.co.ke/test_credentials).
  - The Test Credentials Obtained Are only valid in Sandbox/Development environment. Take note of them.
  - To run in Production Environment you will need real Credentials.
    - To go Live and be issued with real credentials,please refer to [this guide](https://developer.safaricom.co.ke/docs?javascript#going-live)

## Getting Started

```javascript
// import package
import { Mpesa } from "mpesa-api";
//OR
const Mpesa = require("mpesa-api").Mpesa;

// create a new instance of the api
const mpesa = new Mpesa(credentials, environment);
```

A moment to explain the above. `credentials` should be an object containing key,secret,initiator password, security credential and certificate path as the properties/keys.

```javascript
//example
const credentials = {
    clientKey: 'YOUR_CONSUMER_KEY_HERE',
    clientSecret: 'YOUR_CONSUMER_SECRET_HERE',
    initiatorPassword: 'YOUR_INITIATOR_PASSWORD_HERE',
    securityCredential: 'YOUR_SECURITY_CREDENTIAL',
    certificatePath: 'keys/example.cert'
};
// For the initiator_password, use the security credential from the test credentials page.link :https://developer.safaricom.co.ke/test_credentials

// security credential is optional. Set this if you're getting Initiator Name is invalid errors. You can generate your security credential on the test credentials page for sandbox environment or from your mpesa web portal for production environment.

// certificate path is otional. I've provided ceritificates for sandbox and production by default. If you choose not to include it Pass it as null. If you have passed `securityCredential` you should pass `certificatePath` as `null`
const credentials = {
    ...,
    certificatePath: null
};
```

> You can get initiator password from Your Portal(production) or from test credentials(Sandbox). It will be the `Security Credential (Shortcode 1)`.
> You can generate your security credential on the [test credentials](https://developer.safaricom.co.ke/test_credentials) page for sandbox environment or from your mpesa web portal for production environment. See [this](https://developer.safaricom.co.ke/docs#step-by-step-go-live-guide) guide for production environment(last step on the go live guide).

Environment should be a string. It can be either 'production' or 'sandbox'

```javascript
const environment = "sandbox";
//or
const environment = "production";
```

## Methods and Api Calls

#### Business to Business

> This Has Been Disabled as of January 2019 and I have therefore removed it for now.

This API enables Business to Business (B2B) transactions between a business and another business. Use of this API requires a valid and verified B2B M-Pesa short code for the business initiating the transaction and the both businesses involved in the transaction.

```javascript
mpesa
  .b2b({
    InitiatorName: "Initiator Name",
    Amount: 1000 /* 1000 is an example amount */,
    PartyA: "Party A",
    PartyB: "Party B",
    AccountReference: "Account Reference",
    QueueTimeOutURL: "Queue Timeout URL",
    ResultURL: "Result URL",
    CommandID: "Command ID" /* OPTIONAL */,
    SenderIdentifierType: 4 /* OPTIONAL */,
    RecieverIdentifierType: 4 /* OPTIONAL */,
    Remarks: "Remarks" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  Initiator - This is the credential/username used to authenticate the transaction request.
2.  CommandID - Unique command for each transaction type, default is `MerchantToMerchantTransfer` possible values are: `BusinessPayBill`, `MerchantToMerchantTransfer`, `MerchantTransferFromMerchantToWorking`, `MerchantServicesMMFAccountTransfer`, `AgencyFloatAdvance`
3.  Amount - The amount being transacted.
4.  PartyA - Organization’s short code initiating the transaction.
5.  SenderIdentifier - Type of organization sending the transaction. Deault is 4
6.  PartyB - Organization’s short code receiving the funds being transacted.
7.  RecieverIdentifierType - Type of organization receiving the funds being transacted. Default is 4
8.  Remarks - Comments that are sent along with the transaction.
9.  QueueTimeOutURL - The path that stores information of time out transactions.it should be properly validated to make sure that it contains the port, URI and domain name or publicly available IP.
10. ResultURL - The path that receives results from M-Pesa it should be properly validated to make sure that it contains the port, URI and domain name or publicly available IP.
11. AccountReference - Account Reference mandatory for “BusinessPaybill” CommandID.

#### Business to Customer (B2C)

This API enables Business to Customer (B2C) transactions between a company and customers who are the end-users of its products or services. Use of this API requires a valid and verified B2C M-Pesa Short code.

```javascript
mpesa
  .b2c({
    Initiator: "Initiator Name",
    Amount: 1000 /* 1000 is an example amount */,
    PartyA: "Party A",
    PartyB: "Party B",
    QueueTimeOutURL: "Queue Timeout URL",
    ResultURL: "Result URL",
    CommandID: "Command ID" /* OPTIONAL */,
    Occasion: "Occasion" /* OPTIONAL */,
    Remarks: "Remarks" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  Initiator - This is the credential/username used to authenticate the transaction request.
2.  CommandID - Unique command for each transaction type e.g. SalaryPayment, BusinessPayment, PromotionPayment
3.  Amount - The amount being transacted
4.  PartyA - Organization’s shortcode initiating the transaction.
5.  PartyB - Phone number receiving the transaction
6.  Remarks - Comments that are sent along with the transaction.
7.  QueueTimeOutURL - The timeout end-point that receives a timeout response.
8.  ResultURL - The end-point that receives the response of the transaction
9.  Occasion - Optional

#### C2B

This API enables Paybill and Buy Goods merchants to integrate to M-Pesa and receive real time payments notifications.

##### Register

The C2B Register URL API registers the 3rd party’s confirmation and validation URLs to M-Pesa ; which then maps these URLs to the 3rd party shortcode. Whenever M-Pesa receives a transaction on the shortcode, M-Pesa triggers a validation request against the validation URL and the 3rd party system responds to M-Pesa with a validation response (either a success or an error code). The response expected is the success code the 3rd party

M-Pesa completes or cancels the transaction depending on the validation response it receives from the 3rd party system. A confirmation request of the transaction is then sent by M-Pesa through the confirmation URL back to the 3rd party which then should respond with a success acknowledging the confirmation.

```javascript
mpesa
  .c2bregister({
    ShortCode: "Short Code",
    ConfirmationURL: "Confirmation URL",
    ValidationURL: "Validation URL",
    ResponseType: "Response Type",
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  ShortCode - The short code of the organization.
2.  ResponseType - Default response type for timeout.
3.  ConfirmationURL- Confirmation URL for the client.
4.  ValidationURL - Validation URL for the client.

##### Simulate

```javascript
mpesa
  .c2bsimulate({
    ShortCode: 123456,
    Amount: 1000 /* 1000 is an example amount */,
    Msisdn: 254792123456,
    CommandID: "Command ID" /* OPTIONAL */,
    BillRefNumber: "Bill Reference Number" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  ShortCode - 6 digit M-Pesa Till Number or PayBill Number
2.  CommandID - Unique command for each transaction type. Default is `CustomerPayBillOnline`
3.  Amount - The amount been transacted.
4.  MSISDN - MSISDN (phone number) sending the transaction, start with country code without the plus(+) sign.
5.  BillRefNumber - Bill Reference Number (Optional).

#### Account Balance

The Account Balance API requests for the account balance of a shortcode.

```javascript
mpesa
  .accountBalance({
    Initiator: "Initiator Name",
    PartyA: "Party A",
    IdentifierType: "Identifier Type",
    QueueTimeOutURL: "Queue Timeout URL",
    ResultURL: "Result URL",
    CommandID: "Command ID" /* OPTIONAL */,
    Remarks: "Remarks" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  Initiator - This is the credential/username used to authenticate the transaction request.
2.  CommandID - A unique command passed to the M-Pesa system. Default is `AccountBalance`
3.  PartyB - The shortcode of the organisation receiving the transaction.
4.  ReceiverIdentifierType - Type of the organisation receiving the transaction.
5.  Remarks - Comments that are sent along with the transaction.
6.  QueueTimeOutURL - The timeout end-point that receives a timeout message.
7.  ResultURL - The end-point that receives a successful transaction.

#### Transaction Status

Transaction Status API checks the status of a B2B, B2C and C2B APIs transactions.

```javascript
mpesa
  .transactionStatus({
    Initiator: "Initiator",
    TransactionID: "Transaction ID",
    PartyA: "Party A",
    IdentifierType: "Identifier Type",
    ResultURL: "Result URL",
    QueueTimeOutURL: "Queue Timeout URL",
    CommandID: "Command ID" /* OPTIONAL */,
    Remarks: "Remarks" /* OPTIONAL */,
    Occasion: "Occasion" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  Initiator - The name of Initiator to initiating the request.
2.  CommandID - Unique command for each transaction type, possible values are: `TransactionStatusQuery`.
3.  TransactionID - Organization Receiving the funds.
4.  Party A - Organization /MSISDN sending the transaction.
5.  IdentifierType - Type of organization receiving the transaction.
6.  ResultURL - The path that stores information of transaction.
7.  QueueTimeOutURL - The path that stores information of time out transaction.
8.  Remarks - Comments that are sent along with the transaction.
9.  Occasion - Optional.

#### Lipa na mpesa online

Lipa na M-Pesa Online Payment API is used to initiate a M-Pesa transaction on behalf of a customer using STK Push. This is the same technique mySafaricom App uses whenever the app is used to make payments.

```javascript
mpesa
  .lipaNaMpesaOnline({
    BusinessShortCode: 123456,
    Amount: 1000 /* 1000 is an example amount */,
    PartyA: "Party A",
    PhoneNumber: "Phone Number",
    CallBackURL: "CallBack URL",
    AccountReference: "Account Reference",
    passKey: "Lipa Na Mpesa Pass Key",
    TransactionType: "Transaction Type" /* OPTIONAL */,
    TransactionDesc: "Transaction Description" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  BusinessShortCode - The organization shortcode used to receive the transaction.
2.  Amount - The amount to be transacted.
3.  PartyA - The MSISDN sending the funds.
4.  PartyB - The organization shortcode receiving the funds. Default is the BusinessShorCode.
5.  PhoneNumber - The MSISDN sending the funds.
6.  CallBackURL - The url to where responses from M-Pesa will be sent to.
7.  AccountReference - Used with M-Pesa PayBills.
8.  TransactionDesc - A description of the transaction.
9.  passKey - Lipa Na Mpesa Pass Key.
10. Transaction Type - Default is `CustomerPayBillOnline`

#### Lipa na mpesa online query

```javascript
mpesa
  .lipaNaMpesaQuery({
    BusinessShortCode: 123456,
    CheckoutRequestID: "Checkout Request ID",
    passKey: "Lipa Na Mpesa Pass Key",
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  BusinessShortCode - Business Short Code
2.  CheckoutRequestID - Checkout RequestID
3.  Lipa Na Mpesa Pass Key

#### Reversal

Reverses a B2B, B2C or C2B M-Pesa transaction.

```javascript
mpesa
  .reversal({
    Initiator: "Initiator",
    TransactionID: "Transaction ID",
    Amount: 1000 /* 1000 is an example amount */,
    ReceiverParty: "Reciever Party",
    ResultURL: "Result URL",
    QueueTimeOutURL: "Queue Timeout URL",
    CommandID: "Command ID" /* OPTIONAL */,
    RecieverIdentifierType: 11 /* OPTIONAL */,
    Remarks: "Remarks" /* OPTIONAL */,
    Occasion: "Ocassion" /* OPTIONAL */,
  })
  .then((response) => {
    //Do something with the response
    //eg
    console.log(response);
  })
  .catch((error) => {
    //Do something with the error;
    //eg
    console.error(error);
  });
```

1.  Initiator - This is the credential/username used to authenticate the transaction request.
2.  TransactionID - Organization Receiving the funds.
3.  Amount - The Amount To Be Reversed
4.  PartyA - Organization/MSISDN sending the transaction.
5.  RecieverIdentifierType - Type of organization receiving the transaction. Default is `11`
6.  ResultURL - The path that stores information of transaction.
7.  QueueTimeOutURL - The path that stores information of time out transaction.
8.  Remarks - Comments that are sent along with the transaction.
9.  Occasion - Optional.
10. Command ID - Default is `TransactionReversal`


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


## Demo

You can try it out on [Runkit](https://runkit.com/newtonmunene99/mpesa-api-demo)

## RoadMap

- [x] Basic Documentation
- [x] Deploy to Npm
- [x] Migrate to Typescript
- [x] Detailed Documentation
- [ ] Write Tests
- [x] Validators for inputs
- [ ] Tree shaking
- [ ] Migrate from Typescript to JSDoc

## Build

If you Wish to build

1. Clone this repo
2. CD into repo
3. run `npm install` to install dependencies
4. run `npm run build` to build
5. run `npm run start:dev` to run package in development mode

## Contributing

1. Fork the project then clone the forked project
2. Create your feature branch: `git checkout -b my-new-feature`
3. Make your changes and add name to Contributors list below.
4. Commit your changes: `git commit -m 'Add some feature'`
5. Push to the branch: `git push origin my-new-feature`
6. Submit a pull request.

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
