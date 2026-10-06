import { ValidationError } from './errors';

/** An RSA public key, and the certificate's expiry when there was one. */
export interface RsaPublicKey {
  /** The modulus. */
  n: bigint;
  /** The public exponent, usually 65537. */
  e: bigint;
  /** Certificate expiry, when the input is an X.509 certificate. */
  notAfter?: Date;
}

/** One DER element: its tag, and the byte range of its contents (after the length). */
interface Tlv {
  tag: number;
  start: number;
  end: number;
}

/** `rsaEncryption` (1.2.840.113549.1.1.1) as DER-encoded OID bytes. */
const RSA_ENCRYPTION_OID = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

/** The DER tags this parser needs. `contextVersion` is X.509's optional `[0] version`. */
const TAG = {
  integer: 0x02,
  bitString: 0x03,
  oid: 0x06,
  utcTime: 0x17,
  generalizedTime: 0x18,
  sequence: 0x30,
  contextVersion: 0xa0,
} as const;

/** Builds the `ValidationError` every parse failure throws, pointing at `initiator.certificate`. */
function invalid(message: string): ValidationError {
  return new ValidationError('certificate', [{ path: 'initiator.certificate', message }]);
}

/**
 * Reads the DER element at `offset`, which must end by `limit`. Supports short lengths and
 * long lengths of up to 4 bytes, which covers any certificate. Throws when truncated.
 */
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

/** Reads the element at `offset` and throws unless it has the expected tag. */
function expect(bytes: Uint8Array, offset: number, tag: number, limit?: number): Tlv {
  const tlv = readTlv(bytes, offset, limit);
  if (tlv.tag !== tag) throw invalid('is not a valid X.509 certificate or public key');
  return tlv;
}

/**
 * Reads a DER INTEGER's contents as unsigned. The leading 0x00 that DER adds to keep a
 * modulus positive is harmless here.
 */
function toBigInt(bytes: Uint8Array): bigint {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex === '' ? 0n : BigInt(`0x${hex}`);
}

/**
 * Reads an X.509 validity time. UTCTime has a two-digit year: 50–99 means 19xx and 00–49
 * means 20xx (RFC 5280 §4.1.2.5.1). GeneralizedTime has four digits. Both are in UTC.
 */
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

/**
 * Walks an X.509 `Certificate` to its `tbsCertificate` and reads the validity's `notAfter`
 * and the `subjectPublicKeyInfo`. It skips everything else, so it doesn't check the
 * signature: the certificate is trusted because the caller downloaded it from Safaricom.
 */
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

/**
 * Decodes the first `CERTIFICATE` or `PUBLIC KEY` block in PEM text. Text around the block,
 * such as the bag attributes some tools add, is ignored.
 */
function pemToDer(pem: string): { der: Uint8Array; kind: 'certificate' | 'publicKey' } {
  const block = findPemBlock(pem);
  if (!block) throw invalid('must be a PEM certificate or public key');
  let binary: string;
  try {
    binary = atob(block.body.replace(/\s+/g, ''));
  } catch {
    throw invalid('contains invalid base64');
  }
  const der = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return { der, kind: block.label === 'CERTIFICATE' ? 'certificate' : 'publicKey' };
}

/**
 * Finds the first BEGIN line that has a matching END line. Runs in linear time: a single
 * lazy regex over the whole text is quadratic on many unterminated BEGIN lines, and the
 * text comes from the caller. Once a label has no END after some point, it has none after
 * any later point either, so that label is skipped from then on.
 */
function findPemBlock(pem: string): { label: string; body: string } | undefined {
  const unterminated = new Set<string>();
  for (const m of pem.matchAll(/-----BEGIN (CERTIFICATE|PUBLIC KEY)-----/g)) {
    const label = m[1]!;
    if (unterminated.has(label)) continue;
    const start = m.index + m[0].length;
    const end = pem.indexOf(`-----END ${label}-----`, start);
    if (end !== -1) return { label, body: pem.slice(start, end) };
    unterminated.add(label);
  }
  return undefined;
}

/**
 * Extracts the RSA public key from a Safaricom certificate.
 *
 * Accepts a PEM `CERTIFICATE` or `PUBLIC KEY`, or DER bytes of an X.509 certificate. Throws
 * `ValidationError` for malformed input or a key that isn't RSA. An expired certificate
 * still parses; the caller decides what to do with `notAfter`.
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
