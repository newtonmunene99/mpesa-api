import { ValidationError } from './errors';

export interface RsaPublicKey {
  n: bigint;
  e: bigint;
  /** Certificate expiry, when the input is an X.509 certificate. */
  notAfter?: Date;
}

interface Tlv {
  tag: number;
  start: number;
  end: number;
}

const RSA_ENCRYPTION_OID = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

const TAG = {
  integer: 0x02,
  bitString: 0x03,
  oid: 0x06,
  utcTime: 0x17,
  generalizedTime: 0x18,
  sequence: 0x30,
  contextVersion: 0xa0,
} as const;

function invalid(message: string): ValidationError {
  return new ValidationError('certificate', [{ path: 'initiator.certificate', message }]);
}

function readTlv(bytes: Uint8Array, offset: number, limit = bytes.length): Tlv {
  if (offset + 2 > limit) throw invalid('is truncated');
  const tag = bytes[offset]!;
  let length = bytes[offset + 1]!;
  let start = offset + 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4 || start + count > limit) throw invalid('has an invalid length');
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + bytes[start + i]!;
    start += count;
  }
  const end = start + length;
  if (end > limit) throw invalid('is truncated');
  return { tag, start, end };
}

function expect(bytes: Uint8Array, offset: number, tag: number, limit?: number): Tlv {
  const tlv = readTlv(bytes, offset, limit);
  if (tlv.tag !== tag) throw invalid('is not a valid X.509 certificate or public key');
  return tlv;
}

function toBigInt(bytes: Uint8Array): bigint {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex === '' ? 0n : BigInt(`0x${hex}`);
}

function parseTime(bytes: Uint8Array, tlv: Tlv): Date {
  const text = String.fromCharCode(...bytes.subarray(tlv.start, tlv.end));
  const m =
    tlv.tag === TAG.utcTime
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text)
      : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text);
  if (!m) throw invalid('has an invalid validity date');
  let year = Number(m[1]);
  if (tlv.tag === TAG.utcTime) year += year < 50 ? 2000 : 1900;
  return new Date(
    Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])),
  );
}

/** Reads `SubjectPublicKeyInfo ::= SEQUENCE { AlgorithmIdentifier, BIT STRING }`. */
function readSpki(bytes: Uint8Array, spki: Tlv): { n: bigint; e: bigint } {
  const algorithm = expect(bytes, spki.start, TAG.sequence, spki.end);
  const oid = expect(bytes, algorithm.start, TAG.oid, algorithm.end);
  const oidBytes = bytes.subarray(oid.start, oid.end);
  if (
    oidBytes.length !== RSA_ENCRYPTION_OID.length ||
    !RSA_ENCRYPTION_OID.every((b, i) => oidBytes[i] === b)
  ) {
    throw invalid('certificate is not an RSA key');
  }
  const bitString = expect(bytes, algorithm.end, TAG.bitString, spki.end);
  // The first byte of a BIT STRING counts unused bits; it is 0 for keys.
  const rsaKey = expect(bytes, bitString.start + 1, TAG.sequence, bitString.end);
  const n = expect(bytes, rsaKey.start, TAG.integer, rsaKey.end);
  const e = expect(bytes, n.end, TAG.integer, rsaKey.end);
  return {
    n: toBigInt(bytes.subarray(n.start, n.end)),
    e: toBigInt(bytes.subarray(e.start, e.end)),
  };
}

function readCertificate(bytes: Uint8Array): RsaPublicKey {
  const cert = expect(bytes, 0, TAG.sequence);
  const tbs = expect(bytes, cert.start, TAG.sequence, cert.end);
  let cursor = tbs.start;
  let field = readTlv(bytes, cursor, tbs.end);
  if (field.tag === TAG.contextVersion) {
    cursor = field.end;
    field = readTlv(bytes, cursor, tbs.end);
  }
  // serialNumber, signature, issuer
  for (let i = 0; i < 3; i++) {
    cursor = readTlv(bytes, cursor, tbs.end).end;
  }
  const validity = expect(bytes, cursor, TAG.sequence, tbs.end);
  const notBefore = readTlv(bytes, validity.start, validity.end);
  const notAfter = readTlv(bytes, notBefore.end, validity.end);
  if (notAfter.tag !== TAG.utcTime && notAfter.tag !== TAG.generalizedTime) {
    throw invalid('has an invalid validity date');
  }
  const subject = readTlv(bytes, validity.end, tbs.end);
  const spki = expect(bytes, subject.end, TAG.sequence, tbs.end);
  return { ...readSpki(bytes, spki), notAfter: parseTime(bytes, notAfter) };
}

function pemToDer(pem: string): { der: Uint8Array; kind: 'certificate' | 'publicKey' } {
  const m = /-----BEGIN (CERTIFICATE|PUBLIC KEY)-----([\s\S]*?)-----END \1-----/.exec(pem);
  if (!m) throw invalid('must be a PEM certificate or public key');
  let binary: string;
  try {
    binary = atob(m[2]!.replace(/\s+/g, ''));
  } catch {
    throw invalid('contains invalid base64');
  }
  const der = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return { der, kind: m[1] === 'CERTIFICATE' ? 'certificate' : 'publicKey' };
}

/**
 * Extracts the RSA public key from a Safaricom certificate.
 *
 * Accepts a PEM `CERTIFICATE` or `PUBLIC KEY`, or DER bytes of an X.509 certificate.
 */
export function parseCertificate(input: string | Uint8Array): RsaPublicKey {
  if (typeof input === 'string') {
    const { der, kind } = pemToDer(input);
    if (kind === 'publicKey') {
      return readSpki(der, expect(der, 0, TAG.sequence));
    }
    return readCertificate(der);
  }
  return readCertificate(input);
}
