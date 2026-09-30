// Smoke test for the built package: imports `mpesa-api` through package.json "exports",
// makes a B2C call against a stubbed fetch, and checks the security credential decrypts
// with the test key (a throwaway fixture, not a Safaricom certificate).
import { constants, privateDecrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createMpesa } from 'mpesa-api';

const fixture = (name) =>
  readFileSync(new URL(`../__tests__/fixtures/certs/${name}`, import.meta.url), 'utf8');

const requests = [];
const fetch = async (url, init = {}) => {
  requests.push({ url: String(url), body: init.body ? JSON.parse(init.body) : undefined });
  const body = String(url).includes('/oauth/')
    ? { access_token: 'tok', expires_in: 3599 }
    : {
        ConversationID: 'AG_1',
        OriginatorConversationID: 'smoke-1',
        ResponseCode: '0',
        ResponseDescription: 'ok',
      };
  return new Response(JSON.stringify(body), { status: 200 });
};

const mpesa = createMpesa({
  environment: 'sandbox',
  consumerKey: 'key',
  consumerSecret: 'secret',
  initiator: { name: 'smoke', password: 'Safaricom999!*!', certificate: fixture('test-cert.pem') },
  fetch,
});

const res = await mpesa.b2c.pay({
  originatorConversationId: 'smoke-1',
  commandId: 'BusinessPayment',
  amount: 10,
  shortCode: 600997,
  phoneNumber: '254708374149',
  remarks: 'Smoke test',
  resultUrl: 'https://example.com/result',
  queueTimeoutUrl: 'https://example.com/timeout',
});

const b2c = requests.find((r) => r.url.endsWith('/mpesa/b2c/v3/paymentrequest'));
const password = privateDecrypt(
  { key: fixture('test-key.pem'), padding: constants.RSA_PKCS1_PADDING },
  Buffer.from(b2c?.body?.SecurityCredential ?? '', 'base64'),
).toString('utf8');

if (res.responseCode !== '0' || password !== 'Safaricom999!*!') {
  console.error('smoke failed', { res, password });
  process.exit(1);
}
console.log('smoke ok');
