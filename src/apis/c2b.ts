import type { Context } from '../client';
import { checkShortCode, checkUrl, Issues } from '../core/validate';
import { str } from './shared';

export interface C2BRegisterInput {
  /** Paybill or till (store) number (`ShortCode`). */
  shortCode: number;
  /** Receives payment confirmations (`ConfirmationURL`). */
  confirmationUrl: string;
  /** Receives validation requests when external validation is enabled (`ValidationURL`). */
  validationUrl: string;
  /** What M-Pesa does if the validation URL can't be reached in time (`ResponseType`). */
  defaultAction: 'Completed' | 'Cancelled';
}

export interface C2BResponse {
  originatorConversationId: string;
  responseCode: string;
  responseDescription: string;
  /** Daraja's response body, unmodified. */
  raw: unknown;
}

export interface C2BApi {
  /**
   * Registers the confirmation and validation URLs for a shortcode. In production this is a
   * one-time call: delete existing URLs in the Daraja portal before registering new ones.
   */
  registerUrls(input: C2BRegisterInput): Promise<C2BResponse>;
}

const PATHS = {
  registerUrls: '/mpesa/c2b/v2/registerurl',
} as const;

/** Daraja spells the field `OriginatorCoversationID` in C2B responses; accept both. */
export function mapC2BResponse(raw: Record<string, unknown>): C2BResponse {
  return {
    originatorConversationId: str(raw.OriginatorCoversationID ?? raw.OriginatorConversationID),
    responseCode: str(raw.ResponseCode),
    responseDescription: str(raw.ResponseDescription),
    raw,
  };
}

async function registerUrls(ctx: Context, input: C2BRegisterInput): Promise<C2BResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  checkShortCode(issues, 'shortCode', input.shortCode);
  for (const field of ['confirmationUrl', 'validationUrl'] as const) {
    checkUrl(issues, field, input[field], { production, blockKeywords: production });
  }
  if (input.defaultAction !== 'Completed' && input.defaultAction !== 'Cancelled') {
    issues.add('defaultAction', "must be 'Completed' or 'Cancelled'");
  }
  issues.throwIfAny('c2b.registerUrls');

  const raw = await ctx.post<Record<string, unknown>>(PATHS.registerUrls, {
    ShortCode: String(input.shortCode),
    ResponseType: input.defaultAction,
    ConfirmationURL: input.confirmationUrl,
    ValidationURL: input.validationUrl,
  });
  return mapC2BResponse(raw);
}

/** Customer to Business (C2B) payment notifications. */
export function c2b(ctx: Context): C2BApi {
  return {
    registerUrls: (input) => registerUrls(ctx, input),
  };
}
