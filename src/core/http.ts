import { DarajaApiError, NetworkError } from './errors';

export interface Transport {
  baseUrl: string;
  fetch: typeof fetch;
  timeoutMs: number;
}

export interface RequestInit {
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;

function parse(text: string): { json: true; value: unknown } | { json: false; value: string } {
  try {
    return { json: true, value: JSON.parse(text) };
  } catch {
    return { json: false, value: text };
  }
}

/**
 * Sends one request to Daraja and returns the parsed JSON body.
 *
 * Throws `DarajaApiError` for non-2xx responses and for 2xx responses whose `ResponseCode` is
 * not "0", and `NetworkError` when no usable response arrives (fetch failure, timeout or a
 * non-JSON success body). Header values, including the bearer token, never appear in errors.
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

  if (!response.ok) {
    const body = parsed.value;
    throw new DarajaApiError({
      status: response.status,
      body,
      ...(isRecord(body)
        ? {
            requestId: asString(body.requestId),
            errorCode: asString(body.errorCode),
            errorMessage: asString(body.errorMessage),
          }
        : {}),
    });
  }

  if (!parsed.json) {
    throw new NetworkError(
      `${init.method} ${init.path} returned ${response.status} but the body is not valid JSON`,
    );
  }

  const body = parsed.value;
  if (isRecord(body) && 'ResponseCode' in body && String(body.ResponseCode) !== '0') {
    throw new DarajaApiError({
      status: response.status,
      body,
      errorCode: asString(body.ResponseCode),
      errorMessage: asString(body.ResponseDescription),
    });
  }

  return body as T;
}
