import { str } from '../core/coerce';
import { checkPhone, type Issues } from '../core/validate';

/**
 * The acknowledgement returned by the initiator APIs: B2C, B2B, Business To Pochi, Transaction
 * Status, Account Balance and Reversal.
 */
export interface InitiatorResponse {
  /** M-Pesa's ID for the request; the result callback carries it too. */
  conversationId: string;
  /** The ID sent with the request (for B2C, yours), echoed by Daraja and in the result. */
  originatorConversationId: string;
  /** "0" when Daraja accepted the request. The outcome arrives later at `resultUrl`. */
  responseCode: string;
  responseDescription: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/** Maps Daraja's acknowledgement body to `InitiatorResponse`, keeping the body in `raw`. */
export function mapInitiatorResponse(raw: Record<string, unknown>): InitiatorResponse {
  return {
    conversationId: str(raw.ConversationID),
    originatorConversationId: str(raw.OriginatorConversationID),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    raw,
  };
}

/** What kind of party a number is: an organisation shortcode, a till number or a phone number. */
export type IdentifierType = 'shortcode' | 'till' | 'msisdn';

const IDENTIFIER_CODES: Record<IdentifierType, string> = {
  msisdn: '1',
  till: '2',
  shortcode: '4',
};

/**
 * Daraja's `IdentifierType` code: shortcode → '4', till → '2', msisdn → '1'. `undefined`
 * means shortcode. Returns `undefined` for an unknown type, which `checkIdentifierType` reports.
 */
export function identifierTypeCode(type: IdentifierType | undefined): string | undefined {
  return IDENTIFIER_CODES[type ?? 'shortcode'];
}

/**
 * Validates a party and returns the value to send: a phone number normalised to `2547…` for
 * `msisdn`, otherwise the shortcode unchanged, which must be 5 to 9 digits.
 */
export function checkParty(
  issues: Issues,
  path: string,
  value: number | string,
  type: IdentifierType | undefined,
): number | string {
  if (type === 'msisdn') return checkPhone(issues, path, String(value));
  if (!/^\d{5,9}$/.test(String(value))) issues.add(path, 'must be a 5 to 9 digit shortcode');
  return value;
}

/** Reports an `identifierType` outside `IdentifierType`, as plain JavaScript callers can pass one. */
export function checkIdentifierType(issues: Issues, type: IdentifierType | undefined): void {
  if (identifierTypeCode(type) === undefined) {
    issues.add('identifierType', "must be 'shortcode', 'till' or 'msisdn'");
  }
}
