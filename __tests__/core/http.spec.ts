import { describe, expect, test } from 'vite-plus/test';
import { DarajaApiError, NetworkError } from '../../src/core/errors';
import { request, type Transport } from '../../src/core/http';
import { fakeFetch } from '../helpers/fake-fetch';

const transport = (f: typeof fetch, timeoutMs = 1000): Transport => ({
  baseUrl: 'https://sandbox.safaricom.co.ke',
  fetch: f,
  timeoutMs,
});

const auth = { authorization: 'Bearer secret-token-123' };

describe('request', () => {
  test('POSTs JSON to baseUrl + path and resolves the parsed body', async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { ResponseCode: '0', ok: true } }]);

    const res = await request(transport(fetch), {
      method: 'POST',
      path: '/mpesa/b2c/v3/paymentrequest',
      headers: auth,
      body: { Amount: 10 },
    });

    expect(res).toEqual({ ResponseCode: '0', ok: true });
    expect(calls).toEqual([
      {
        url: 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: 'Bearer secret-token-123',
          'content-type': 'application/json',
        },
        body: { Amount: 10 },
      },
    ]);
  });

  test('GET sends no body or content type', async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { access_token: 't' } }]);

    await request(transport(fetch), { method: 'GET', path: '/oauth/v1/generate' });

    expect(calls[0]).toEqual({
      url: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
      method: 'GET',
      headers: { accept: 'application/json' },
    });
  });

  test('maps a Daraja gateway error body to DarajaApiError', async () => {
    const { fetch } = fakeFetch([
      {
        status: 500,
        body: {
          requestId: 'r1',
          errorCode: '500.002.1001',
          errorMessage: 'Duplicate OriginatorConversationID.',
        },
      },
    ]);

    const error = await request(transport(fetch), { method: 'POST', path: '/x', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({
      status: 500,
      requestId: 'r1',
      errorCode: '500.002.1001',
      errorMessage: 'Duplicate OriginatorConversationID.',
    });
  });

  test('reads Bill Manager error fields from a non-2xx body', async () => {
    const body = {
      Status_Message: 'Biller already Registered',
      resmsg: 'Action Forbidden',
      rescode: '409',
    };
    const { fetch } = fakeFetch([{ status: 409, body }]);

    const error = await request(transport(fetch), { method: 'POST', path: '/x', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({
      status: 409,
      errorCode: '409',
      errorMessage: 'Biller already Registered',
      body,
    });
  });

  test('prefers the gateway fields and falls back to resmsg', async () => {
    const { fetch } = fakeFetch([
      { status: 400, body: { errorCode: '400.002.02', errorMessage: 'Bad', rescode: '409' } },
      { status: 409, body: { resmsg: 'Conflict', rescode: '409' } },
    ]);
    const send = () =>
      request(transport(fetch), { method: 'POST', path: '/x', body: {} }).catch((e: unknown) => e);

    expect(await send()).toMatchObject({ errorCode: '400.002.02', errorMessage: 'Bad' });
    expect(await send()).toMatchObject({ errorCode: '409', errorMessage: 'Conflict' });
  });

  test('maps a non-JSON error body to DarajaApiError with the raw body', async () => {
    const { fetch } = fakeFetch([{ status: 400, body: 'bad' }]);

    const error = await request(transport(fetch), { method: 'POST', path: '/x', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 400, body: 'bad', errorCode: undefined });
  });

  test.each(['00000000', 0])('treats ResponseCode %s as success', async (code) => {
    const { fetch } = fakeFetch([{ status: 200, body: { ResponseCode: code } }]);

    await expect(
      request(transport(fetch), { method: 'POST', path: '/p', body: {} }),
    ).resolves.toEqual({ ResponseCode: code });
  });

  test.each(['10', '00000001', '', ' 0', '1'])(
    'treats ResponseCode %j as a rejection',
    async (code) => {
      const { fetch } = fakeFetch([{ status: 200, body: { ResponseCode: code } }]);

      await expect(
        request(transport(fetch), { method: 'POST', path: '/p', body: {} }),
      ).rejects.toBeInstanceOf(DarajaApiError);
    },
  );

  test('treats a 2xx with a non-zero ResponseCode as DarajaApiError', async () => {
    const { fetch } = fakeFetch([
      { status: 200, body: { ResponseCode: '1', ResponseDescription: 'Rejected' } },
    ]);

    const error = await request(transport(fetch), { method: 'POST', path: '/x', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DarajaApiError);
    expect(error).toMatchObject({ status: 200, errorCode: '1', errorMessage: 'Rejected' });
  });

  describe('with a success rule', () => {
    const only1000 = (code: string): boolean => code === '1000';

    test('resolves a ResponseCode the rule accepts', async () => {
      const { fetch } = fakeFetch([{ status: 200, body: { ResponseCode: '1000' } }]);

      await expect(
        request(transport(fetch), { method: 'POST', path: '/p', body: {}, success: only1000 }),
      ).resolves.toEqual({ ResponseCode: '1000' });
    });

    test('rejects a ResponseCode the rule refuses, even all zeros', async () => {
      const { fetch } = fakeFetch([
        { status: 200, body: { ResponseCode: '1001', ResponseDescription: 'Nope' } },
        { status: 200, body: { ResponseCode: '0' } },
      ]);
      const send = () =>
        request(transport(fetch), { method: 'POST', path: '/p', body: {}, success: only1000 });

      await expect(send()).rejects.toMatchObject({
        name: 'DarajaApiError',
        status: 200,
        errorCode: '1001',
        errorMessage: 'Nope',
      });
      await expect(send()).rejects.toBeInstanceOf(DarajaApiError);
    });

    test('accepts a non-numeric code when the rule allows it', async () => {
      const body = { ResponseCode: 'AG_20191219_000043fdf61864fe9ff5' };
      const { fetch } = fakeFetch([{ status: 200, body }]);

      await expect(
        request(transport(fetch), { method: 'POST', path: '/p', body: {}, success: () => true }),
      ).resolves.toEqual(body);
    });

    test('never rejects a body without ResponseCode', async () => {
      const { fetch } = fakeFetch([{ status: 200, body: { code: '0' } }]);

      await expect(
        request(transport(fetch), { method: 'POST', path: '/p', body: {}, success: () => false }),
      ).resolves.toEqual({ code: '0' });
    });
  });

  test('wraps a rejected fetch in NetworkError with the cause', async () => {
    const cause = new TypeError('fetch failed');
    const { fetch } = fakeFetch([cause]);

    const error = await request(transport(fetch), { method: 'GET', path: '/x' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).cause).toBe(cause);
  });

  test('times out after timeoutMs', async () => {
    const { fetch } = fakeFetch([
      (init) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    ]);

    const error = await request(transport(fetch, 20), { method: 'GET', path: '/x' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toMatch(/timed out after 20ms/);
  });

  test('rejects a 2xx response that is not JSON', async () => {
    const { fetch } = fakeFetch([{ status: 200, body: '<html>maintenance</html>' }]);

    const error = await request(transport(fetch), { method: 'GET', path: '/x' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toMatch(/not valid JSON/);
  });

  test('never puts header values in error messages', async () => {
    const { fetch } = fakeFetch([{ status: 401, body: { errorCode: '401.002.01' } }]);

    const error = await request(transport(fetch), {
      method: 'POST',
      path: '/x',
      headers: auth,
      body: {},
    }).catch((e: unknown) => e);

    expect((error as Error).message).not.toContain('secret-token-123');
    expect(JSON.stringify(error)).not.toContain('secret-token-123');
  });
});
