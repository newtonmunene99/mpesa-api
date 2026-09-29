import { constants, privateDecrypt, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseCertificate } from '../../src/core/certificate';
import { encryptPkcs1v15 } from '../../src/core/credential';
import { ValidationError } from '../../src/core/errors';

const fixture = (name: string): string =>
  readFileSync(new URL(`../fixtures/certs/${name}`, import.meta.url), 'utf8');

const key = parseCertificate(fixture('test-cert.pem'));
const privateKey = fixture('test-key.pem');

const decrypt = (credential: string): string =>
  privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(credential, 'base64'),
  ).toString('utf8');

const randomPassword = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#&%$';
  return Array.from({ length: randomInt(1, 65) }, () => chars[randomInt(chars.length)]).join('');
};

describe('encryptPkcs1v15', () => {
  test('round-trips 50 random passwords through node:crypto privateDecrypt', () => {
    for (let i = 0; i < 50; i++) {
      const password = randomPassword();
      const credential = encryptPkcs1v15(key, password);
      expect(Buffer.from(credential, 'base64')).toHaveLength(256);
      expect(decrypt(credential)).toBe(password);
    }
  });

  test('never uses zero bytes in the padding, re-drawing them', () => {
    let calls = 0;
    const random = (bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
      calls++;
      // First fill is all zeros; later fills are 0x2a.
      bytes.fill(calls === 1 ? 0 : 0x2a);
      return bytes;
    };

    const credential = encryptPkcs1v15(key, 'Safaricom999!*!', random);

    expect(calls).toBeGreaterThan(1);
    expect(decrypt(credential)).toBe('Safaricom999!*!');
  });

  test('rejects plaintext longer than the key allows', () => {
    expect(() => encryptPkcs1v15(key, 'x'.repeat(246))).toThrow(ValidationError);
    expect(() => encryptPkcs1v15(key, 'x'.repeat(245))).not.toThrow();
  });

  test('limits by UTF-8 bytes, not characters', () => {
    // 'é' is 2 bytes in UTF-8: 122 × 2 = 244 bytes fits, 123 × 2 = 246 bytes does not.
    expect(decrypt(encryptPkcs1v15(key, 'é'.repeat(122)))).toBe('é'.repeat(122));
    expect(() => encryptPkcs1v15(key, 'é'.repeat(123))).toThrow(ValidationError);
  });

  test('gives up when the random source only returns zeros', () => {
    const zeros = (bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => bytes.fill(0);
    expect(() => encryptPkcs1v15(key, 'pw', zeros)).toThrow(/no non-zero bytes/);
  });
});
