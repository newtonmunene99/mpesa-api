# Certificates

The initiator APIs (B2C, B2B, Business To Pochi, Transaction Status, Account Balance and Reversal) need a **security credential**: the initiator's password encrypted with Safaricom's public certificate. There are two ways to provide it.

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
