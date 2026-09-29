/** Base class for every error thrown by mpesa-api. */
export class MpesaError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Input failed local validation. Nothing was sent to Daraja. */
export class ValidationError extends MpesaError {
  readonly issues: ValidationIssue[];

  constructor(context: string, issues: ValidationIssue[]) {
    super(`${context}: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`);
    this.issues = issues;
  }
}

/** The OAuth token request failed. */
export class AuthError extends MpesaError {
  readonly status: number;
  readonly errorCode: string | undefined;

  constructor(message: string, status: number, errorCode?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.status = status;
    this.errorCode = errorCode;
  }
}

/** Daraja rejected the request, or accepted it with a non-zero ResponseCode. */
export class DarajaApiError extends MpesaError {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly errorCode: string | undefined;
  readonly errorMessage: string | undefined;
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

/** The request never produced a usable response: network failure, timeout or a non-JSON body. */
export class NetworkError extends MpesaError {}
