import { str } from '../core/coerce';
import { ValidationError } from '../core/errors';
import { parseEatDay } from '../core/time';
import { Issues } from '../core/validate';
import { isRecord, readCents, requireValue } from './shared';

/** A payment Bill Manager pushes to the `callbackurl` you gave at opt-in. */
export interface BillManagerPayment {
  /** The M-Pesa receipt number. */
  transactionId: string;
  /** The amount paid, in cents (KES 5000 is 500000). */
  paidAmountCents: number;
  /** The customer's number, as Daraja sends it. */
  msisdn: string;
  /** The day the payment was recorded, as midnight East Africa Time. */
  dateCreated: Date;
  /** The account number the customer paid to. */
  accountReference: string;
  /** Your paybill or till. */
  shortCode: string;
  /** The push body, unmodified. */
  raw: unknown;
}

/** The JSON body to reply with once you've received a Bill Manager payment push. */
export const billManagerPaymentResponse: { readonly resmsg: 'Success'; readonly rescode: '200' } =
  Object.freeze({ resmsg: 'Success', rescode: '200' });

/** Reads a `YYYY-MM-DD` day as midnight EAT, recording an issue for any other value. */
function readDay(issues: Issues, path: string, value: unknown): Date | undefined {
  if (typeof value === 'string') {
    try {
      return parseEatDay(value);
    } catch {
      // Reported below.
    }
  }
  issues.add(path, 'must be a YYYY-MM-DD date');
  return undefined;
}

/**
 * Parses a payment Bill Manager pushes to your `callbackurl`. Pass the already-parsed JSON,
 * and reply with `billManagerPaymentResponse`. Throws `ValidationError` when `transactionId`,
 * `paidAmount` or `dateCreated` is missing or malformed.
 */
export function parseBillManagerPayment(body: unknown): BillManagerPayment {
  if (!isRecord(body)) {
    throw new ValidationError('parseBillManagerPayment', [
      { path: 'body', message: 'is required' },
    ]);
  }
  const issues = new Issues();
  requireValue(issues, 'transactionId', body.transactionId);
  const paidAmountCents = requireValue(issues, 'paidAmount', body.paidAmount)
    ? readCents(issues, 'paidAmount', body.paidAmount)
    : undefined;
  const dateCreated = requireValue(issues, 'dateCreated', body.dateCreated)
    ? readDay(issues, 'dateCreated', body.dateCreated)
    : undefined;
  issues.throwIfAny('parseBillManagerPayment');

  return {
    transactionId: str(body.transactionId),
    paidAmountCents: paidAmountCents!,
    msisdn: str(body.msisdn),
    dateCreated: dateCreated!,
    accountReference: str(body.accountReference),
    shortCode: str(body.shortCode),
    raw: body,
  };
}
