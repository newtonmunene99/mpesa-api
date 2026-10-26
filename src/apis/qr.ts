import type { Context } from '../client';
import { str } from '../core/coerce';
import { checkInt, checkPhone, checkShortCode, Issues } from '../core/validate';

/**
 * What the customer does with the QR code (`TrxCode`): pay a till (`BG`), pay a paybill
 * (`PB`), withdraw at an agent till (`WA`), send money to a mobile number (`SM`) or send to a
 * business whose number is in MSISDN form (`SB`).
 */
export type QrType = 'buyGoods' | 'payBill' | 'agentWithdrawal' | 'sendMoney' | 'sendToBusiness';

/** Input for `qr.generate`. */
export interface QrInput {
  /** The name shown to the customer (`MerchantName`). */
  merchantName: string;
  /** The transaction reference (`RefNo`). */
  reference: string;
  /** Whole shillings, at least 1 (`Amount`). */
  amount: number;
  /** The kind of payment (`TrxCode`). */
  type: QrType;
  /**
   * Who is paid (`CPI`): a 5 to 7 digit till, paybill or agent number, or for `sendMoney` and
   * `sendToBusiness` a Safaricom number as a string (`07…`, `01…`, `+254…` or `254…`, sent as
   * `254…`).
   */
  creditParty: string | number;
  /** The image's width and height in pixels (`Size`). Defaults to 300. */
  size?: number;
}

/** Daraja's answer to `qr.generate`. */
export interface QrResponse {
  /** The QR code as a base64-encoded PNG. */
  qrCode: string;
  /** Daraja's request ID, when it sends one (the sandbox doesn't). */
  requestId?: string;
  /** "0" or "00" on success. */
  responseCode: string;
  responseDescription: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

/**
 * Dynamic QR: generates a QR code a customer scans in the M-Pesa app to pay. The call is
 * synchronous; nothing is posted back.
 *
 * `generate` throws `ValidationError` before sending when the input is invalid, and
 * `DarajaApiError`, `AuthError` or `NetworkError` when the request fails.
 */
export interface QrApi {
  /** Generates a QR code for one payment and returns it as a base64 PNG. */
  generate(input: QrInput): Promise<QrResponse>;
}

const PATH = '/mpesa/qrcode/v1/generate';
const DEFAULT_SIZE = 300;
const TRX_CODES: Record<QrType, string> = {
  buyGoods: 'BG',
  payBill: 'PB',
  agentWithdrawal: 'WA',
  sendMoney: 'SM',
  sendToBusiness: 'SB',
};
const PHONE_TYPES: ReadonlySet<QrType> = new Set(['sendMoney', 'sendToBusiness']);

/** Checks the credit party against the type and returns the value to send as `CPI`. */
function checkCreditParty(issues: Issues, type: QrType, value: string | number): string {
  if (PHONE_TYPES.has(type)) return checkPhone(issues, 'creditParty', String(value));
  checkShortCode(issues, 'creditParty', value);
  return String(value);
}

async function generate(ctx: Context, input: QrInput): Promise<QrResponse> {
  const issues = new Issues();
  if (!input.merchantName?.trim()) issues.add('merchantName', 'is required');
  if (!input.reference?.trim()) issues.add('reference', 'is required');
  checkInt(issues, 'amount', input.amount, { min: 1 });
  const trxCode = Object.hasOwn(TRX_CODES, input.type) ? TRX_CODES[input.type] : undefined;
  if (trxCode === undefined) {
    issues.add(
      'type',
      "must be 'buyGoods', 'payBill', 'agentWithdrawal', 'sendMoney' or 'sendToBusiness'",
    );
  }
  // The credit party's form depends on the type, so it is only checked for a known type.
  const cpi = trxCode ? checkCreditParty(issues, input.type, input.creditParty) : '';
  const size = input.size ?? DEFAULT_SIZE;
  checkInt(issues, 'size', size, { min: 1 });
  issues.throwIfAny('qr.generate');

  const raw = await ctx.post<Record<string, unknown>>(PATH, {
    MerchantName: input.merchantName,
    RefNo: input.reference,
    Amount: input.amount,
    TrxCode: trxCode,
    CPI: cpi,
    Size: String(size),
  });
  return {
    qrCode: str(raw.QRCode),
    ...(raw.RequestID == null ? {} : { requestId: str(raw.RequestID) }),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    raw,
  };
}

/** Dynamic QR codes. */
export function qr(ctx: Context): QrApi {
  return {
    generate: (input) => generate(ctx, input),
  };
}
