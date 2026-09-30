import { code, str } from '../apis/shared';
import { ValidationError } from '../core/errors';
import { parseB2CDateTime } from '../core/time';
import { Issues } from '../core/validate';
import { flatten, isRecord, readTimestamp, requireKey } from './shared';

/**
 * A result callback from B2C, Transaction Status, Account Balance or Reversal: the body
 * Daraja POSTs to the request's `ResultURL`.
 */
export interface DarajaResult {
  resultType: number;
  /** 0 on success. Numeric strings become numbers; codes such as "R000002" stay strings. */
  resultCode: number | string;
  resultDesc: string;
  /** `resultCode === 0`. */
  ok: boolean;
  originatorConversationId: string;
  conversationId: string;
  transactionId: string;
  /**
   * `ResultParameters` flattened by `Key`. Values keep Daraja's type, except the documented
   * date keys, which become `Date`. Use `parseBalances` on `AccountBalance` and
   * `DebitAccountBalance`.
   */
  parameters: Record<string, string | number | Date>;
  /** `ReferenceData` flattened by `Key`. */
  referenceData: Record<string, string>;
  /** The callback body, unmodified. */
  raw: unknown;
}

/** Keys sent as EAT `YYYYMMDDHHmmss`. */
const TIMESTAMP_KEYS = new Set([
  'FinalisedTime',
  'InitiatedTime',
  'BOCompletedTime',
  'TransCompletedTime',
]);
/** Keys sent as EAT `dd.MM.yyyy HH:mm:ss`. */
const B2C_DATETIME_KEYS = new Set(['TransactionCompletedDateTime']);

/**
 * Parses the result callback of B2C, Transaction Status, Account Balance or Reversal. Pass
 * the already-parsed JSON. Throws `ValidationError` when required keys are missing or a date
 * is malformed.
 */
export function parseResult(body: unknown): DarajaResult {
  const result = isRecord(body) ? body.Result : undefined;
  if (!isRecord(result)) {
    throw new ValidationError('parseResult', [{ path: 'Result', message: 'is required' }]);
  }
  const issues = new Issues();
  for (const key of ['ResultType', 'ResultCode', 'OriginatorConversationID', 'ConversationID']) {
    requireKey(issues, 'Result', result, key);
  }

  const resultType = code(result.ResultType);
  if (typeof resultType !== 'number' && resultType !== '') {
    issues.add('Result.ResultType', 'must be a number');
  }

  const parameters: Record<string, string | number | Date> = {};
  const flat = isRecord(result.ResultParameters)
    ? flatten(result.ResultParameters.ResultParameter, 'Key')
    : {};
  for (const [key, value] of Object.entries(flat)) {
    const path = `Result.ResultParameters.${key}`;
    if (TIMESTAMP_KEYS.has(key)) {
      const date = readTimestamp(issues, path, value);
      if (date) parameters[key] = date;
    } else if (B2C_DATETIME_KEYS.has(key)) {
      try {
        parameters[key] = parseB2CDateTime(str(value));
      } catch {
        issues.add(path, 'must be a dd.MM.yyyy HH:mm:ss timestamp');
      }
    } else if (typeof value === 'number' || typeof value === 'string') {
      parameters[key] = value;
    } else if (typeof value === 'boolean') {
      parameters[key] = String(value);
    }
  }

  const referenceData: Record<string, string> = {};
  const refs = isRecord(result.ReferenceData)
    ? flatten(result.ReferenceData.ReferenceItem, 'Key')
    : {};
  for (const [key, value] of Object.entries(refs)) referenceData[key] = str(value);

  issues.throwIfAny('parseResult');

  const resultCode = code(result.ResultCode);
  return {
    resultType: typeof resultType === 'number' ? resultType : 0,
    resultCode,
    resultDesc: str(result.ResultDesc),
    ok: resultCode === 0,
    originatorConversationId: str(result.OriginatorConversationID),
    conversationId: str(result.ConversationID),
    transactionId: str(result.TransactionID),
    parameters,
    referenceData,
    raw: body,
  };
}
