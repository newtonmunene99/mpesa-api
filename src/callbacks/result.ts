import { code, str } from '../core/coerce';
import { ValidationError } from '../core/errors';
import { parseB2CDateTime } from '../core/time';
import { Issues } from '../core/validate';
import { flatten, isRecord, readTimestamp, requireValue, setOwn } from './shared';

/**
 * A result callback from an initiator API (B2C, B2B, Business To Pochi, Transaction Status,
 * Account Balance or Reversal): the body Daraja POSTs to the request's `ResultURL`.
 */
export interface DarajaResult {
  /** Usually 0. Daraja documents it only as whether the result was sent to your listener. */
  resultType: number;
  /** 0 on success. Numeric strings become numbers; codes such as "R000002" stay strings. */
  resultCode: number | string;
  resultDesc: string;
  /** `resultCode === 0`. */
  ok: boolean;
  /** The `originatorConversationId` from the request's acknowledgement; match results on it. */
  originatorConversationId: string;
  /** M-Pesa's ID for the request, as in the acknowledgement. */
  conversationId: string;
  /** The M-Pesa transaction ID; a placeholder such as "SKE0000000" when nothing was processed. */
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
 * Parses the result callback of B2C, B2B, Business To Pochi, Transaction Status, Account
 * Balance or Reversal. Pass
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

  const parameters = readParameters(result.ResultParameters, issues);

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

type ParameterValue = string | number | Date;

/** Flattens `ResultParameters` by `Key`, converting each value with `readParameter`. */
function readParameters(raw: unknown, issues: Issues): Record<string, ParameterValue> {
  const parameters: Record<string, ParameterValue> = {};
  const flat = isRecord(raw) ? flatten(raw.ResultParameter, 'Key') : {};
  for (const [key, value] of Object.entries(flat)) {
    const converted = readParameter(issues, key, value);
    if (converted !== undefined) setOwn(parameters, key, converted);
  }
  return parameters;
}

/**
 * Converts one parameter: documented date keys become `Date`, strings and numbers are kept,
 * booleans become strings, and anything else is dropped. A malformed date is recorded in
 * `issues` and dropped.
 */
function readParameter(issues: Issues, key: string, value: unknown): ParameterValue | undefined {
  const path = `Result.ResultParameters.${key}`;
  if (TIMESTAMP_KEYS.has(key)) return readTimestamp(issues, path, value);
  if (B2C_DATETIME_KEYS.has(key)) {
    try {
      return parseB2CDateTime(str(value));
    } catch {
      issues.add(path, 'must be a dd.MM.yyyy HH:mm:ss timestamp');
      return undefined;
    }
  }
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  return undefined;
}
