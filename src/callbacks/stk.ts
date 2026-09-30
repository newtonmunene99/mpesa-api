import { code, str } from '../apis/shared';
import { ValidationError } from '../core/errors';
import { Issues } from '../core/validate';
import { flatten, isRecord, readNumber, readTimestamp, requireValue } from './shared';

/** The `CallbackMetadata` of a successful STK push, when Daraja sends it. */
export interface StkCallbackMetadata {
  amount?: number;
  mpesaReceiptNumber?: string;
  balance?: number;
  transactionDate?: Date;
  phoneNumber?: string;
}

/** An M-Pesa Express (STK push) callback. */
export interface StkCallback {
  merchantRequestId: string;
  checkoutRequestId: string;
  /** 0 on success; for example 1032 when the customer cancels. */
  resultCode: number | string;
  resultDesc: string;
  /** `resultCode === 0`. */
  ok: boolean;
  metadata?: StkCallbackMetadata;
  /** The callback body, unmodified. */
  raw: unknown;
}

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
    const items = flatten(stk.CallbackMetadata.Item, 'Name');
    const path = `${PATH}.CallbackMetadata`;
    const metadata: StkCallbackMetadata = {};
    if (Object.hasOwn(items, 'Amount')) {
      const amount = readNumber(issues, `${path}.Amount`, items.Amount);
      if (amount !== undefined) metadata.amount = amount;
    }
    if (Object.hasOwn(items, 'MpesaReceiptNumber'))
      metadata.mpesaReceiptNumber = str(items.MpesaReceiptNumber);
    if (Object.hasOwn(items, 'Balance')) {
      const balance = readNumber(issues, `${path}.Balance`, items.Balance);
      if (balance !== undefined) metadata.balance = balance;
    }
    if (Object.hasOwn(items, 'TransactionDate')) {
      const date = readTimestamp(issues, `${path}.TransactionDate`, items.TransactionDate);
      if (date) metadata.transactionDate = date;
    }
    if (Object.hasOwn(items, 'PhoneNumber')) metadata.phoneNumber = str(items.PhoneNumber);
    result.metadata = metadata;
  }

  issues.throwIfAny('parseStkCallback');
  return result;
}
