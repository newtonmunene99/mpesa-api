import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test';
import { HttpService } from '../../src/services/http.service';

interface Received {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  body: string;
}

let server: Server;
let baseURL: string;
let received: Received;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received = { method: req.method, url: req.url, headers: req.headers, body };

      switch (req.url) {
        case '/json':
        case '/echo':
          res.writeHead(200, { 'content-type': 'application/json' }).end('{"a":1}');
          break;
        case '/bad':
          res
            .writeHead(400, { 'content-type': 'application/json' })
            .end('{"errorCode":"400.002.02"}');
          break;
        case '/text':
          res.writeHead(200, { 'content-type': 'text/plain' }).end('plain');
          break;
        default:
          res.writeHead(404).end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const client = () => new HttpService({ baseURL, headers: { 'X-Base': '1' } });

describe('HttpService', () => {
  test('get resolves parsed JSON and sends base and per-call headers', async () => {
    const res = await client().get('/json', { headers: { Authorization: 'Bearer tok' } });

    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ a: 1 });
    expect(received.method).toBe('GET');
    expect(received.headers['x-base']).toBe('1');
    expect(received.headers.authorization).toBe('Bearer tok');
  });

  test('post sends a JSON body with content type and length', async () => {
    await client().post('/echo', { b: 2 }, { headers: {} });

    expect(received.method).toBe('POST');
    expect(received.body).toBe('{"b":2}');
    expect(received.headers['content-type']).toBe('application/json');
    expect(received.headers['content-length']).toBe('7');
  });

  test('rejects with status and parsed body on a non-2xx response', async () => {
    await expect(client().post('/bad', {}, { headers: {} })).rejects.toMatchObject({
      statusCode: 400,
      data: { errorCode: '400.002.02' },
    });
  });

  test('returns the raw text when the body is not JSON', async () => {
    const res = await client().get('/text', { headers: {} });

    expect(res.data).toBe('plain');
  });

  test('rejects with the socket error when nothing listens', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    await expect(
      new HttpService({ baseURL: `http://127.0.0.1:${port}` }).get('/json', { headers: {} }),
    ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});
