import { code, str } from '../core/coerce';
import { ValidationError } from '../core/errors';
import { Issues } from '../core/validate';
import { asList, isBlank, isRecord, requireValue, setOwn } from './shared';

/** The result of an M-Pesa Ratiba standing order request, as Daraja POSTs it to `CallBackURL`. */
export interface RatibaCallback {
  /** 0 when the standing order was created; otherwise an error such as 1032 (cancelled). */
  resultCode: number | string;
  /** True only when `resultCode` is 0. */
  ok: boolean;
  responseDescription: string;
  /** Daraja's ID for the request (`responseRefID`). */
  responseRefId: string;
  /** The `CustomStoId` you sent (`requestRefID`). */
  requestRefId: string;
  /** The standing order's ID (`reminderScheduleId`), on success. */
  standingOrderId?: string;
  /** `TransactionID`, when Daraja sends one. */
  transactionId?: string;
  /** The order's status, such as "ACTIVE" (`status`, or `Status`). */
  status?: string;
  /** Every name/value pair in the response data, as strings. Has no prototype. */
  data: Record<string, string>;
  /** The callback body, unmodified. */
  raw: unknown;
}

/** Daraja sends Ratiba callbacks in camelCase on success and PascalCase on failure. */
const pick = (record: Record<string, unknown>, camel: string, pascal: string): unknown =>
  record[camel] ?? record[pascal];

/** Flattens `responseData` (`{ name, value }` or `{ Name, Value }` entries) into strings. */
function readData(body: unknown): Record<string, string> {
  const data = Object.create(null) as Record<string, string>;
  if (!isRecord(body)) return data;
  for (const entry of asList(pick(body, 'responseData', 'ResponseData'))) {
    if (!isRecord(entry)) continue;
    const name = pick(entry, 'name', 'Name');
    const value = pick(entry, 'value', 'Value');
    if (typeof name !== 'string' || isBlank(value)) continue;
    setOwn(data, name, str(value));
  }
  return data;
}

/** The optional fields read from `data`, when present. */
function optionalFields(data: Record<string, string>): Partial<RatibaCallback> {
  const standingOrderId = data.reminderScheduleId;
  const transactionId = data.TransactionID;
  const status = data.status ?? data.Status;
  return {
    ...(standingOrderId === undefined ? {} : { standingOrderId }),
    ...(transactionId === undefined ? {} : { transactionId }),
    ...(status === undefined ? {} : { status }),
  };
}

/**
 * Parses the callback Daraja POSTs after an M-Pesa Ratiba standing order request, in either of
 * the casings Daraja uses. Pass the already-parsed JSON. Throws `ValidationError` when the
 * header or its `responseCode` is missing.
 */
export function parseRatibaCallback(body: unknown): RatibaCallback {
  if (!isRecord(body)) {
    throw new ValidationError('parseRatibaCallback', [{ path: 'body', message: 'is required' }]);
  }
  const header = pick(body, 'responseHeader', 'ResponseHeader');
  const issues = new Issues();
  if (!isRecord(header)) issues.add('responseHeader', 'is required');
  else requireValue(issues, 'responseHeader.responseCode', header.responseCode);
  issues.throwIfAny('parseRatibaCallback');

  const head = header as Record<string, unknown>;
  const resultCode = code(head.responseCode);
  const data = readData(pick(body, 'responseBody', 'ResponseBody'));
  return {
    resultCode,
    ok: resultCode === 0,
    responseDescription: str(head.responseDescription),
    responseRefId: str(head.responseRefID),
    requestRefId: str(head.requestRefID),
    ...optionalFields(data),
    data,
    raw: body,
  };
}
