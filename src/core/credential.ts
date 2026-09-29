import { ValidationError } from './errors';

export type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

const defaultRandom: RandomFill = (bytes) => crypto.getRandomValues(bytes);

function byteLength(n: bigint): number {
  return Math.ceil(n.toString(16).length / 2);
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return BigInt(`0x${hex}`);
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const hex = value.toString(16).padStart(length * 2, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

/** Fills `out` with non-zero random bytes, re-drawing any zeros (RFC 8017 §7.2.1 step 2b). */
function nonZeroRandom(out: Uint8Array<ArrayBuffer>, random: RandomFill): void {
  let filled = 0;
  for (let attempts = 0; filled < out.length; attempts++) {
    if (attempts === 100) throw new Error('random source produced no non-zero bytes');
    const chunk = random(new Uint8Array(out.length - filled));
    for (const b of chunk) {
      if (b !== 0 && filled < out.length) out[filled++] = b;
    }
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Encrypts `plaintext` with RSAES-PKCS1-v1_5 (RFC 8017 §7.2.1), as Daraja requires for the
 * initiator security credential, and returns it base64-encoded.
 */
export function encryptPkcs1v15(
  key: { n: bigint; e: bigint },
  plaintext: string,
  random: RandomFill = defaultRandom,
): string {
  const k = byteLength(key.n);
  const message = new TextEncoder().encode(plaintext);
  if (message.length > k - 11) {
    throw new ValidationError('securityCredential', [
      { path: 'initiator.password', message: `must be at most ${k - 11} bytes` },
    ]);
  }

  // EM = 0x00 || 0x02 || PS || 0x00 || M
  const em = new Uint8Array(k);
  em[1] = 0x02;
  nonZeroRandom(em.subarray(2, k - message.length - 1), random);
  em.set(message, k - message.length);

  const c = modPow(bytesToBigInt(em), key.e, key.n);
  return toBase64(bigIntToBytes(c, k));
}
