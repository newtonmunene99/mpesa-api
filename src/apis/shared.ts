/** Reads a Daraja value as text: strings as-is, numbers and booleans stringified, else ''. */
export const str = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';

/** Numeric strings become numbers; other codes (such as "R000002") stay strings. */
export const code = (value: unknown): number | string => {
  const text = str(value);
  return /^-?\d+$/.test(text) ? Number(text) : text;
};

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
