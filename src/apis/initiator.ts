import type { Context } from '../client';
import { MpesaError } from '../core/errors';
import { checkUrl, Issues } from '../core/validate';
import { type InitiatorResponse, mapInitiatorResponse } from './shared';

/** One call to an API that acts through the initiator (API operator). */
export interface InitiatorCall {
  /** `<namespace>.<method>`, used as the error context. */
  api: string;
  path: string;
  resultUrl: string;
  queueTimeoutUrl: string;
  /** Daraja names the initiator field `InitiatorName` in B2C and `Initiator` elsewhere. */
  initiatorField?: 'Initiator' | 'InitiatorName';
  /**
   * Sent as `OriginatorConversationID`, returned when Daraja doesn't echo one, and attached to
   * any `MpesaError` from the request so the caller can check the transaction's status.
   */
  originatorConversationId?: string;
  /** Validates the API's own input into `issues` and returns its Daraja fields. */
  fields(issues: Issues): Record<string, unknown>;
}

/**
 * Validates, signs and sends an initiator request: B2C, Transaction Status, Account Balance
 * or Reversal. Every problem, including a missing initiator, is reported in one
 * `ValidationError` before anything is sent.
 */
export async function initiatorRequest(
  ctx: Context,
  call: InitiatorCall,
): Promise<InitiatorResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  if (!ctx.config.initiator) issues.add('initiator', 'is required');
  const fields = call.fields(issues);
  checkUrl(issues, 'resultUrl', call.resultUrl, { production });
  checkUrl(issues, 'queueTimeoutUrl', call.queueTimeoutUrl, { production });
  issues.throwIfAny(call.api);

  const id = call.originatorConversationId;
  const { name, credential } = await ctx.securityCredential(call.api);
  let raw: Record<string, unknown>;
  try {
    raw = await ctx.post<Record<string, unknown>>(call.path, {
      ...(id ? { OriginatorConversationID: id } : {}),
      [call.initiatorField ?? 'Initiator']: name,
      SecurityCredential: credential,
      ...fields,
      QueueTimeOutURL: call.queueTimeoutUrl,
      ResultURL: call.resultUrl,
    });
  } catch (error) {
    if (id && error instanceof MpesaError) error.originatorConversationId = id;
    throw error;
  }
  const response = mapInitiatorResponse(raw);
  return id
    ? { ...response, originatorConversationId: response.originatorConversationId || id }
    : response;
}
