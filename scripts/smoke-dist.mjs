// Smoke test for the built package: resolves `mpesa-api` through package.json
// "exports" and checks the bundled certificate is found and used at runtime.
import { Buffer } from 'node:buffer';
import { Mpesa } from 'mpesa-api';

const unhandled = [];
process.on('unhandledRejection', (error) => unhandled.push(error));

const mpesa = new Mpesa(
  { clientKey: 'k', clientSecret: 's', initiatorPassword: 'Safaricom999!*!' },
  'sandbox',
);

for (let i = 0; i < 50 && !Reflect.get(mpesa, 'securityCredential'); i++) {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

const securityCredential = Reflect.get(mpesa, 'securityCredential');

// RSA-2048 PKCS#1 v1.5 ciphertext is 256 bytes.
if (
  unhandled.length > 0 ||
  typeof securityCredential !== 'string' ||
  Buffer.from(securityCredential, 'base64').length !== 256
) {
  console.error('smoke failed', { unhandled, securityCredential });
  process.exit(1);
}

console.log('smoke ok');
