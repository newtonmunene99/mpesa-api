export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export type FakeResponse =
  | { status: number; body: unknown }
  | Error
  | ((init: RequestInit) => Promise<Response>);

/**
 * A fetch double that records each call and replays scripted responses in order.
 * Object bodies are sent as JSON; string bodies are sent as-is.
 */
export function fakeFetch(responses: FakeResponse[]): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let index = 0;

  const fetchImpl = async (
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const body = typeof init.body === 'string' ? tryParse(init.body) : undefined;
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      method: init.method ?? 'GET',
      headers,
      ...(body === undefined ? {} : { body }),
    });

    const next = responses[index++];
    if (next === undefined) throw new Error(`fakeFetch: no response scripted for call ${index}`);
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(init);
    const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return new Response(text, { status: next.status });
  };

  return { fetch: fetchImpl as typeof fetch, calls };
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
