import { code, str } from '../core/coerce';
import { ValidationError } from '../core/errors';
import { parseB2CDateTime } from '../core/time';
import { Issues } from '../core/validate';
import { flatten, isRecord, readTimestamp, requireValue, setOwn } from './shared';

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
   * `ResultParameters` flattened by `Key`. Strings and numbers keep Daraja's type, booleans
   * become strings, and the documented date keys become `Date`. Keys without a value are
   * left out, and when a key repeats the last one wins. Use `parseBalances` on
   * `AccountBalance` and `DebitAccountBalance`. Keys come from the webhook body and may
   * include `__proto__` as an own property: copy with spread, not `Object.assign`.
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
  const typeOk = requireValue(issues, 'Result.ResultType', result.ResultType);
  for (const key of ['ResultCode', 'OriginatorConversationID', 'ConversationID']) {
    requireValue(issues, `Result.${key}`, result[key]);
  }

  const resultType = code(result.ResultType);
  if (typeOk && typeof resultType !== 'number') {
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
      if (date) setOwn(parameters, key, date);
    } else if (B2C_DATETIME_KEYS.has(key)) {
      try {
        setOwn(parameters, key, parseB2CDateTime(str(value)));
      } catch {
        issues.add(path, 'must be a dd.MM.yyyy HH:mm:ss timestamp');
      }
    } else if (typeof value === 'number' || typeof value === 'string') {
      setOwn(parameters, key, value);
    } else if (typeof value === 'boolean') {
      setOwn(parameters, key, String(value));
    }
  }

  const referenceData: Record<string, string> = {};
  const refs = isRecord(result.ReferenceData)
    ? flatten(result.ReferenceData.ReferenceItem, 'Key')
    : {};
  for (const [key, value] of Object.entries(refs)) setOwn(referenceData, key, str(value));

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
