import { createPublicKey, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vite-plus/test';
import { parseCertificate } from '../../src/core/certificate';
import { ValidationError } from '../../src/core/errors';

const fixture = (name: string): Buffer =>
  readFileSync(new URL(`../fixtures/certs/${name}`, import.meta.url));

const certPem = fixture('test-cert.pem').toString('utf8');

const expected = (() => {
  const jwk = createPublicKey(certPem).export({ format: 'jwk' });
  const toBigInt = (b64url: string): bigint =>
    BigInt(`0x${Buffer.from(b64url, 'base64url').toString('hex')}`);
  return { n: toBigInt(jwk.n!), e: toBigInt(jwk.e!) };
})();

describe('parseCertificate', () => {
  test('reads n and e from an X.509 PEM certificate', () => {
    const key = parseCertificate(certPem);
    expect(key.n).toBe(expected.n);
    expect(key.e).toBe(expected.e);
    expect(key.n.toString(2)).toHaveLength(2048);
  });

  test('reads n and e from a SubjectPublicKeyInfo PEM', () => {
    const key = parseCertificate(fixture('test-spki.pem').toString('utf8'));
    expect(key.n).toBe(expected.n);
    expect(key.e).toBe(expected.e);
    expect(key.notAfter).toBeUndefined();
  });

  test('reads n and e from DER bytes', () => {
    const key = parseCertificate(new Uint8Array(fixture('test-cert.der')));
    expect(key.n).toBe(expected.n);
    expect(key.e).toBe(expected.e);
  });

  test('reports the certificate expiry', () => {
    expect(parseCertificate(certPem).notAfter?.toISOString()).toBe(
      new Date(new X509Certificate(certPem).validTo).toISOString(),
    );
    expect(
      parseCertificate(fixture('test-expired-cert.pem').toString('utf8')).notAfter?.toISOString(),
    ).toBe('2021-01-01T00:00:00.000Z');
  });

  test('rejects non-RSA certificates', () => {
    expect(() => parseCertificate(fixture('test-ec-cert.pem').toString('utf8'))).toThrow(
      /certificate is not an RSA key/,
    );
  });

  test('skips an unterminated block before a complete one', () => {
    const spki = fixture('test-spki.pem').toString('utf8');
    const key = parseCertificate(`-----BEGIN CERTIFICATE-----\nAAAA\n${spki}`);
    expect(key.n).toBe(expected.n);
  });

  test('rejects many unterminated blocks in linear time', () => {
    const hostile = '-----BEGIN PUBLIC KEY-----a'.repeat(50_000);
    const started = performance.now();
    expect(() => parseCertificate(hostile)).toThrow(ValidationError);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test('rejects malformed input', () => {
    expect(() => parseCertificate('not a cert')).toThrow(ValidationError);
    expect(() =>
      parseCertificate(new Uint8Array(fixture('test-cert.der').subarray(0, 100))),
    ).toThrow(ValidationError);
  });
});
