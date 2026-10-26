import { code, str } from '../core/coerce';
import { ValidationError } from '../core/errors';
import { Issues } from '../core/validate';
import { isBlank, isRecord, readCents, requireValue } from './shared';

/** The result of a B2B Express CheckOut push, as Daraja POSTs it to your `callbackUrl`. */
export interface ExpressCheckoutCallback {
  /** 0 on success; 4001 when the merchant cancelled. A number when numeric. */
  resultCode: number | string;
  resultDesc: string;
  /** True only when `resultCode` is 0. */
  ok: boolean;
  /** Daraja's ID for the push. */
  requestId: string;
  /** The amount, in cents (KES 71.0 is 7100). */
  amountCents: number;
  /** The payment reference shown in the prompt, when Daraja echoes it (cancelled callbacks do). */
  paymentReference?: string;
  /** The M-Pesa receipt number, on success. */
  transactionId?: string;
  /** Daraja's conversation ID (`conversationID`), on success. */
  conversationId?: string;
  /** "SUCCESS" on success. */
  status?: string;
  /** The callback body, unmodified. */
  raw: unknown;
}

/** Optional fields: the key Daraja sends and the name it gets in the result. */
const OPTIONAL = [
  ['paymentReference', 'paymentReference'],
  ['transactionId', 'transactionId'],
  ['conversationID', 'conversationId'],
  ['status', 'status'],
] as const;

/** The optional fields that are present and not blank, as strings. */
function optionalFields(body: Record<string, unknown>): Partial<ExpressCheckoutCallback> {
  const out: Partial<Record<(typeof OPTIONAL)[number][1], string>> = {};
  for (const [key, name] of OPTIONAL) {
    if (Object.hasOwn(body, key) && !isBlank(body[key])) out[name] = str(body[key]);
  }
  return out;
}

/**
 * Parses the callback Daraja POSTs after a B2B Express CheckOut push. Pass the already-parsed
 * JSON. Throws `ValidationError` when `resultCode`, `requestId` or `amount` is missing or
 * malformed.
 */
export function parseExpressCheckoutCallback(body: unknown): ExpressCheckoutCallback {
  if (!isRecord(body)) {
    throw new ValidationError('parseExpressCheckoutCallback', [
      { path: 'body', message: 'is required' },
    ]);
  }
  const issues = new Issues();
  requireValue(issues, 'resultCode', body.resultCode);
  requireValue(issues, 'requestId', body.requestId);
  const amountCents = requireValue(issues, 'amount', body.amount)
    ? readCents(issues, 'amount', body.amount)
    : undefined;
  issues.throwIfAny('parseExpressCheckoutCallback');

  const resultCode = code(body.resultCode);
  return {
    resultCode,
    resultDesc: str(body.resultDesc),
    ok: resultCode === 0,
    requestId: str(body.requestId),
    amountCents: amountCents!,
    ...optionalFields(body),
    raw: body,
  };
}
