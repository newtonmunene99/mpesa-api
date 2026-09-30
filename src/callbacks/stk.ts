import { code, str } from '../core/coerce';
import { ValidationError } from '../core/errors';
import { Issues } from '../core/validate';
import { flatten, isRecord, readCents, readTimestamp, requireValue } from './shared';

/** The `CallbackMetadata` of a successful STK push, when Daraja sends it. */
export interface StkCallbackMetadata {
  /** The amount paid, in cents (KES 100 is 10000). */
  amountCents?: number;
  /** The M-Pesa receipt number, as shown in the customer's SMS. */
  mpesaReceiptNumber?: string;
  /** In cents. Rarely sent; Daraja usually omits its value. */
  balanceCents?: number;
  /** When the payment completed (Daraja sends it in EAT). */
  transactionDate?: Date;
  /** The paying phone number, as `2547…`. */
  phoneNumber?: string;
}

/** An M-Pesa Express (STK push) callback. */
export interface StkCallback {
  merchantRequestId: string;
  /** Matches `checkoutRequestId` from `stkPush.send`. */
  checkoutRequestId: string;
  /** 0 on success; for example 1032 when the customer cancels, 1037 when they don't respond. */
  resultCode: number | string;
  resultDesc: string;
  /** `resultCode === 0`. */
  ok: boolean;
  /** Present on successful payments only. */
  metadata?: StkCallbackMetadata;
  /** The callback body, unmodified. */
  raw: unknown;
}

/** Where the callback's payload sits, and the prefix for issue paths. */
const PATH = 'Body.stkCallback';

/**
 * Parses the body Daraja POSTs to an STK push `CallBackURL`. Pass the already-parsed JSON.
 * Throws `ValidationError` when required keys are missing or metadata values are malformed.
 */
export function parseStkCallback(body: unknown): StkCallback {
  const stk = isRecord(body) && isRecord(body.Body) ? body.Body.stkCallback : undefined;
  if (!isRecord(stk)) {
    throw new ValidationError('parseStkCallback', [{ path: PATH, message: 'is required' }]);
  }
  const issues = new Issues();
  for (const key of ['MerchantRequestID', 'CheckoutRequestID', 'ResultCode']) {
    requireValue(issues, `${PATH}.${key}`, stk[key]);
  }

  const resultCode = code(stk.ResultCode);
  const result: StkCallback = {
    merchantRequestId: str(stk.MerchantRequestID),
    checkoutRequestId: str(stk.CheckoutRequestID),
    resultCode,
    resultDesc: str(stk.ResultDesc),
    ok: resultCode === 0,
    raw: body,
  };

  if (isRecord(stk.CallbackMetadata)) {
    result.metadata = readMetadata(stk.CallbackMetadata, issues);
  }

  issues.throwIfAny('parseStkCallback');
  return result;
}

/**
 * Reads the items Daraja sends in `CallbackMetadata`. Items without a value are skipped;
 * malformed amounts and dates are recorded in `issues`.
 */
function readMetadata(raw: Record<string, unknown>, issues: Issues): StkCallbackMetadata {
  const items = flatten(raw.Item, 'Name');
  const path = `${PATH}.CallbackMetadata`;
  const metadata: StkCallbackMetadata = {};
  if (Object.hasOwn(items, 'Amount')) {
    const amount = readCents(issues, `${path}.Amount`, items.Amount);
    if (amount !== undefined) metadata.amountCents = amount;
  }
  if (Object.hasOwn(items, 'MpesaReceiptNumber')) {
    metadata.mpesaReceiptNumber = str(items.MpesaReceiptNumber);
  }
  if (Object.hasOwn(items, 'Balance')) {
    const balance = readCents(issues, `${path}.Balance`, items.Balance);
    if (balance !== undefined) metadata.balanceCents = balance;
  }
  if (Object.hasOwn(items, 'TransactionDate')) {
    const date = readTimestamp(issues, `${path}.TransactionDate`, items.TransactionDate);
    if (date) metadata.transactionDate = date;
  }
  if (Object.hasOwn(items, 'PhoneNumber')) metadata.phoneNumber = str(items.PhoneNumber);
  return metadata;
}
