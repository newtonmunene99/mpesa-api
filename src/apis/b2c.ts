import type { Context } from '../client';
import { MpesaError } from '../core/errors';
import {
  checkInt,
  checkLength,
  checkPhone,
  checkShortCode,
  checkUrl,
  Issues,
} from '../core/validate';
import { type InitiatorResponse, mapInitiatorResponse } from './shared';

export type B2CCommand = 'SalaryPayment' | 'BusinessPayment' | 'PromotionPayment';

export interface B2CInput {
  /**
   * Your unique ID for this payment, used by Daraja to reject duplicates
   * (`OriginatorConversationID`). Defaults to a random UUID; store it to query status later.
   */
  originatorConversationId?: string;
  /** Payment type (`CommandID`). */
  commandId: B2CCommand;
  /** Whole shillings, 10 to 250 000 (`Amount`). */
  amount: number;
  /** The B2C shortcode paying out (`PartyA`). */
  shortCode: number;
  /** The customer's number (`PartyB`). */
  phoneNumber: string;
  /** 2 to 100 characters (`Remarks`). */
  remarks: string;
  /** Receives the payment result (`ResultURL`). */
  resultUrl: string;
  /** Receives a notice if the request times out in the queue (`QueueTimeOutURL`). */
  queueTimeoutUrl: string;
  /** 1 to 100 characters (`Occassion`, Daraja's spelling). */
  occasion?: string;
}

export interface B2CApi {
  /**
   * Sends money from a B2C shortcode to a customer. The acknowledgement only confirms receipt;
   * the outcome arrives at `resultUrl` (see `parseResult`). B2C payments cannot be reversed
   * through the API.
   */
  pay(input: B2CInput): Promise<InitiatorResponse>;
}

const PATH = '/mpesa/b2c/v3/paymentrequest';
const COMMANDS: readonly B2CCommand[] = ['SalaryPayment', 'BusinessPayment', 'PromotionPayment'];

async function pay(ctx: Context, input: B2CInput): Promise<InitiatorResponse> {
  const issues = new Issues();
  const production = ctx.environment === 'production';
  if (!ctx.config.initiator) issues.add('initiator', 'is required');
  if (!COMMANDS.includes(input.commandId)) {
    issues.add('commandId', "must be 'SalaryPayment', 'BusinessPayment' or 'PromotionPayment'");
  }
  checkInt(issues, 'amount', input.amount, 10, 250_000);
  checkShortCode(issues, 'shortCode', input.shortCode);
  const phone = checkPhone(issues, 'phoneNumber', input.phoneNumber);
  checkLength(issues, 'remarks', input.remarks, 2, 100, true);
  checkUrl(issues, 'resultUrl', input.resultUrl, { production });
  checkUrl(issues, 'queueTimeoutUrl', input.queueTimeoutUrl, { production });
  checkLength(issues, 'occasion', input.occasion, 1, 100);
  if (input.originatorConversationId !== undefined) {
    checkLength(issues, 'originatorConversationId', input.originatorConversationId, 1, 100, true);
  }
  issues.throwIfAny('b2c.pay');

  const originatorConversationId = input.originatorConversationId || crypto.randomUUID();
  const { name, credential } = await ctx.securityCredential('b2c.pay');
  let raw: Record<string, unknown>;
  try {
    raw = await ctx.post<Record<string, unknown>>(PATH, {
      OriginatorConversationID: originatorConversationId,
      InitiatorName: name,
      SecurityCredential: credential,
      CommandID: input.commandId,
      Amount: input.amount,
      PartyA: input.shortCode,
      PartyB: phone,
      Remarks: input.remarks,
      QueueTimeOutURL: input.queueTimeoutUrl,
      ResultURL: input.resultUrl,
      ...(input.occasion ? { Occassion: input.occasion } : {}),
    });
  } catch (error) {
    if (error instanceof MpesaError) error.originatorConversationId = originatorConversationId;
    throw error;
  }
  const response = mapInitiatorResponse(raw);
  return {
    ...response,
    originatorConversationId: response.originatorConversationId || originatorConversationId,
  };
}

/** Business to Customer (B2C) payments. */
export function b2c(ctx: Context): B2CApi {
  return {
    pay: (input) => pay(ctx, input),
  };
}
