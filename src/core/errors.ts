/** Base class for every error thrown by mpesa-api. */
export class MpesaError extends Error {
  /**
   * For `b2c.pay`: the OriginatorConversationID that was (or may have been) sent. Set on
   * errors from the request itself (network failures, timeouts, `DarajaApiError`), not on
   * errors thrown before sending. When a payment fails this way, query its status with this
   * ID before retrying, so the customer isn't paid twice.
   */
  originatorConversationId?: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** One problem found by local validation. */
export interface ValidationIssue {
  /** The input or config field, such as `amount` or `initiator.password`. */
  path: string;
  /** Reads as a sentence after `path`, such as `must be at least 10`. */
  message: string;
}

/** Input failed local validation. Nothing was sent to Daraja. */
export class ValidationError extends MpesaError {
  /** Every problem found, in the order the fields were checked. */
  readonly issues: ValidationIssue[];

  constructor(context: string, issues: ValidationIssue[]) {
    super(`${context}: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`);
    this.issues = issues;
  }
}

/**
 * The OAuth token request failed, usually because the consumer key or secret is wrong. A
 * network failure or timeout during the token request is a `NetworkError` instead.
 */
export class AuthError extends MpesaError {
  /**
   * The token endpoint's HTTP status; 200 when it answered without a usable token, and 0 when
   * the request failed for an unexpected reason (see `cause`).
   */
  readonly status: number;
  /** Daraja's `errorCode`, such as `400.008.01`, when the error body had one. */
  readonly errorCode: string | undefined;

  constructor(message: string, status: number, errorCode?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.status = status;
    this.errorCode = errorCode;
  }
}

/** Daraja rejected the request, or accepted it with a non-zero ResponseCode. */
export class DarajaApiError extends MpesaError {
  /** The HTTP status; 200 when Daraja accepted the request but answered a non-zero `ResponseCode`. */
  readonly status: number;
  /** The gateway's `requestId`, useful when contacting Safaricom support. */
  readonly requestId: string | undefined;
  /** Daraja's `errorCode` (such as `404.001.03`), or the non-zero `ResponseCode`. */
  readonly errorCode: string | undefined;
  /** Daraja's `errorMessage`, or the `ResponseDescription` that came with a non-zero code. */
  readonly errorMessage: string | undefined;
  /** The response body: parsed JSON, or the raw text when it wasn't JSON. */
  readonly body: unknown;

  constructor(details: {
    status: number;
    requestId?: string;
    errorCode?: string;
    errorMessage?: string;
    body: unknown;
  }) {
    const summary = [details.errorCode, details.errorMessage].filter(Boolean).join(' ');
    super(`Daraja request failed with status ${details.status}${summary ? `: ${summary}` : ''}`);
    this.status = details.status;
    this.requestId = details.requestId;
    this.errorCode = details.errorCode;
    this.errorMessage = details.errorMessage;
    this.body = details.body;
  }
}

/**
 * The request never produced a usable response: a network failure, a timeout, or a success
 * response whose body isn't JSON. For failures and timeouts, `cause` holds the original error.
 */
export class NetworkError extends MpesaError {}
