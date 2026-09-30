import { str } from '../core/coerce';
import { checkPhone, type Issues } from '../core/validate';

/** The acknowledgement returned by B2C, Transaction Status, Account Balance and Reversal. */
export interface InitiatorResponse {
  conversationId: string;
  originatorConversationId: string;
  responseCode: string;
  responseDescription: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

export function mapInitiatorResponse(raw: Record<string, unknown>): InitiatorResponse {
  return {
    conversationId: str(raw.ConversationID),
    originatorConversationId: str(raw.OriginatorConversationID),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    raw,
  };
}

export type IdentifierType = 'shortcode' | 'till' | 'msisdn';

const IDENTIFIER_CODES: Record<IdentifierType, string> = {
  msisdn: '1',
  till: '2',
  shortcode: '4',
};

/** Daraja's `IdentifierType` code: shortcode → '4', till → '2', msisdn → '1'. */
export function identifierTypeCode(type: IdentifierType | undefined): string | undefined {
  return IDENTIFIER_CODES[type ?? 'shortcode'];
}

/** Validates an organisation or customer party and returns the value to send. */
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

export function checkIdentifierType(issues: Issues, type: IdentifierType | undefined): void {
  if (identifierTypeCode(type) === undefined) {
    issues.add('identifierType', "must be 'shortcode', 'till' or 'msisdn'");
  }
}
