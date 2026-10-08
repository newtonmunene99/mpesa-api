import { DarajaApiError, NetworkError } from './errors';

/** Where and how requests are sent. `createContext` builds one per client. */
export interface Transport {
  /** `https://sandbox.safaricom.co.ke` or `https://api.safaricom.co.ke`, without a trailing slash. */
  baseUrl: string;
  /** The fetch implementation: the global one, or the one passed in `MpesaConfig`. */
  fetch: typeof fetch;
  /** Abort each request after this many milliseconds. */
  timeoutMs: number;
}

/** One request to Daraja. */
export interface RequestInit {
  method: 'GET' | 'POST';
  /** Appended to `Transport.baseUrl`, starting with `/`, including any query string. */
  path: string;
  /** Extra headers, such as `authorization`. `accept` and `content-type` are set for you. */
  headers?: Record<string, string>;
  /** Sent as JSON when present. */
  body?: unknown;
  /**
   * Decides whether a 2xx body's `ResponseCode` means success. Defaults to all zeros. A body
   * without `ResponseCode` is never rejected by it.
   */
  success?: (responseCode: string) => boolean;
}

/** Most APIs answer "0"; C2B URL registration answers "00000000". */
const allZeros = (code: string): boolean => /^0+$/.test(code);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads an error field that Daraja sends as a string or, occasionally, a number. */
const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;

/**
 * Parses a response body as JSON without throwing. Daraja's gateway sometimes answers errors
 * with HTML or plain text, which is kept so the error can still carry it.
 */
function parse(text: string): { json: true; value: unknown } | { json: false; value: string } {
  try {
    return { json: true, value: JSON.parse(text) };
  } catch {
    return { json: false, value: text };
  }
}

/**
 * Builds the error for a non-2xx response, reading Daraja's gateway fields (`requestId`,
 * `errorCode`, `errorMessage`) when the body is a JSON object. Bill Manager answers with
 * `rescode`, `Status_Message` and `resmsg` instead, read when the gateway fields are absent.
 */
function rejection(status: number, body: unknown): DarajaApiError {
  if (!isRecord(body)) return new DarajaApiError({ status, body });
  return new DarajaApiError({
    status,
    body,
    requestId: asString(body.requestId),
    errorCode: asString(body.errorCode) ?? asString(body.rescode),
    errorMessage:
      asString(body.errorMessage) ?? asString(body.Status_Message) ?? asString(body.resmsg),
  });
}

/**
 * Sends one request to Daraja and returns the parsed JSON body.
 *
 * Throws `DarajaApiError` for non-2xx responses, and for 2xx responses whose `ResponseCode`
 * fails `init.success` (by default, is not all zeros: "0", or "00000000" from C2B
 * registration). Throws `NetworkError` when no usable response arrives: a fetch failure, a
 * timeout, or a success body that isn't JSON.
 * Header values, including the bearer token, never appear in errors.
 */
export async function request<T>(transport: Transport, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...init.headers };
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await transport.fetch(transport.baseUrl + init.path, {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(transport.timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new NetworkError(
      timedOut
        ? `${init.method} ${init.path} timed out after ${transport.timeoutMs}ms`
        : `${init.method} ${init.path} failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw new NetworkError(`${init.method} ${init.path} failed while reading the response`, {
      cause: error,
    });
  }
  const parsed = parse(text);

  if (!response.ok) throw rejection(response.status, parsed.value);

  if (!parsed.json) {
    throw new NetworkError(
      `${init.method} ${init.path} returned ${response.status} but the body is not valid JSON`,
    );
  }

  const body = parsed.value;
  const success = init.success ?? allZeros;
  if (isRecord(body) && 'ResponseCode' in body && !success(String(body.ResponseCode))) {
    throw new DarajaApiError({
      status: response.status,
      body,
      errorCode: asString(body.ResponseCode),
      errorMessage: asString(body.ResponseDescription),
    });
  }

  return body as T;
}
