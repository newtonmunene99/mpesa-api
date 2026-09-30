/**
 * Redacts personal data and secrets from Daraja JSON before it is committed as a fixture.
 * Returns a copy; the input is not modified.
 */

const DROP = new Set([
  'Password',
  'SecurityCredential',
  'Authorization',
  'access_token',
  'InitiatorName',
]);
// C2B responses misspell it OriginatorCoversationID.
const ID_KEYS = new Set(['OriginatorConversationID', 'OriginatorCoversationID']);
const NAMES = new Set(['FirstName', 'MiddleName', 'LastName']);
// C2B notifications: MSISDN may be masked, hashed or plain; BillRefNumber is free text.
const MASK = new Set(['MSISDN', 'BillRefNumber']);
const SENSITIVE_ENTRIES = new Set([
  'ReceiverPartyPublicName',
  'DebitPartyName',
  'CreditPartyName',
  'DebitPartyPublicName',
  'CreditPartyPublicName',
  'PhoneNumber',
  'MpesaReceiptNumber',
  'TransactionReceipt',
  'ReceiptNo',
  'OriginatorConversationID',
]);

const MSISDN = /^254[17]\d{8}$/;
const RECEIPT = /^[A-Z0-9]{10}$/;

function redactScalar(value: unknown): unknown {
  if (typeof value === 'number' && MSISDN.test(String(value))) return '254XXXXXXXXX';
  if (typeof value !== 'string') return value;
  if (MSISDN.test(value)) return '254XXXXXXXXX';
  if (value.startsWith('AG_')) return 'AG_REDACTED';
  if (value.startsWith('ws_CO_')) return 'ws_CO_REDACTED';
  if (RECEIPT.test(value) && /[A-Z]/.test(value)) return 'XXXXXXXXXX';
  return value;
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object' || value === null) return redactScalar(value);

  const record = value as Record<string, unknown>;
  const label = typeof record.Key === 'string' ? record.Key : record.Name;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(record)) {
    if (DROP.has(key)) out[key] = '<redacted>';
    else if (NAMES.has(key)) out[key] = inner ? '<name>' : inner;
    else if (MASK.has(key)) out[key] = inner ? '<redacted>' : inner;
    else if (ID_KEYS.has(key)) out[key] = '<redacted-id>';
    else if (key === 'Value' && typeof label === 'string' && SENSITIVE_ENTRIES.has(label)) {
      out[key] = '<redacted>';
    } else out[key] = redact(inner);
  }
  return out;
}
