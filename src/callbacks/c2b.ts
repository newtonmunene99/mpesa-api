import { str } from '../apis/shared';
import { ValidationError } from '../core/errors';
import { Issues } from '../core/validate';
import { isRecord, readNumber, readTimestamp } from './shared';

/** A C2B validation or confirmation request, as Daraja POSTs it to your registered URLs. */
export interface C2BNotification {
  /** "Pay Bill" or "Buy Goods". */
  transactionType: string;
  transId: string;
  transTime: Date;
  transAmount: number;
  businessShortCode: string;
  billRefNumber: string;
  invoiceNumber: string;
  /** Absent on validation requests, where Daraja sends it blank. */
  orgAccountBalance?: number;
  thirdPartyTransId: string;
  /** Masked in C2B v2, for example "2547 ***** 126". */
  msisdn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  /** The notification body, unmodified. */
  raw: unknown;
}

const REQUIRED = ['TransactionType', 'TransID', 'TransTime', 'TransAmount', 'BusinessShortCode'];

const isBlank = (value: unknown): boolean => value === undefined || value === null || value === '';

/**
 * Parses a C2B validation or confirmation request. Pass the already-parsed JSON. Throws
 * `ValidationError` when required keys are missing or values are malformed.
 */
export function parseC2BNotification(body: unknown): C2BNotification {
  if (!isRecord(body)) {
    throw new ValidationError('parseC2BNotification', [{ path: 'body', message: 'is required' }]);
  }
  const issues = new Issues();
  for (const key of REQUIRED) {
    if (isBlank(body[key])) issues.add(key, 'is required');
  }
  const transTime = isBlank(body.TransTime)
    ? undefined
    : readTimestamp(issues, 'TransTime', body.TransTime);
  const transAmount = isBlank(body.TransAmount)
    ? undefined
    : readNumber(issues, 'TransAmount', body.TransAmount);
  const orgAccountBalance = isBlank(body.OrgAccountBalance)
    ? undefined
    : readNumber(issues, 'OrgAccountBalance', body.OrgAccountBalance);
  issues.throwIfAny('parseC2BNotification');

  return {
    transactionType: str(body.TransactionType),
    transId: str(body.TransID),
    transTime: transTime!,
    transAmount: transAmount!,
    businessShortCode: str(body.BusinessShortCode),
    billRefNumber: str(body.BillRefNumber),
    invoiceNumber: str(body.InvoiceNumber),
    ...(orgAccountBalance === undefined ? {} : { orgAccountBalance }),
    thirdPartyTransId: str(body.ThirdPartyTransID),
    msisdn: str(body.MSISDN),
    firstName: str(body.FirstName),
    middleName: str(body.MiddleName),
    lastName: str(body.LastName),
    raw: body,
  };
}

/**
 * Why a C2B payment was rejected: C2B00011 invalid MSISDN, C2B00012 invalid account number,
 * C2B00013 invalid amount, C2B00014 invalid KYC details, C2B00015 invalid shortcode,
 * C2B00016 other error.
 */
export type C2BRejectionCode =
  | 'C2B00011'
  | 'C2B00012'
  | 'C2B00013'
  | 'C2B00014'
  | 'C2B00015'
  | 'C2B00016';

/** The JSON body to return from your C2B validation URL (within about 8 seconds). */
export interface C2BValidationResponse {
  ResultCode: '0' | C2BRejectionCode;
  ResultDesc: 'Accepted' | 'Rejected';
  ThirdPartyTransID?: string;
}

const REJECTION_CODES = new Set<string>([
  'C2B00011',
  'C2B00012',
  'C2B00013',
  'C2B00014',
  'C2B00015',
  'C2B00016',
]);

/** Builds replies for your C2B validation URL. */
export const c2bValidationResponse: {
  accept: (thirdPartyTransId?: string) => C2BValidationResponse;
  reject: (code: C2BRejectionCode) => C2BValidationResponse;
} = {
  accept: (thirdPartyTransId) => ({
    ResultCode: '0',
    ResultDesc: 'Accepted',
    ...(thirdPartyTransId ? { ThirdPartyTransID: thirdPartyTransId } : {}),
  }),
  reject: (code) => {
    if (!REJECTION_CODES.has(code)) {
      throw new ValidationError('c2bValidationResponse.reject', [
        { path: 'code', message: 'must be one of C2B00011 to C2B00016' },
      ]);
    }
    return { ResultCode: code, ResultDesc: 'Rejected' };
  },
};
