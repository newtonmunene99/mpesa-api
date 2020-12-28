import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { parse, UrlWithStringQuery } from 'url';
import { HttpServiceConfig, HttpServiceResponse } from '../models/interfaces';

export class HttpService {
  private uri: UrlWithStringQuery;
  private headers: Record<string, any>;

  constructor(config?: HttpServiceConfig) {
    const { baseURL, headers } = config;

    this.uri = parse(baseURL);
    this.headers = headers;
  }

  get<T = unknown>(
    path: string,
    { headers }: HttpServiceConfig,
  ): Promise<HttpServiceResponse<T>> {
    return new Promise<HttpServiceResponse<T>>((resolve, reject) => {
      try {
        const request =
          this.uri.protocol === 'https:' ? httpsRequest : httpRequest;

        const clientRequest = request(
          {
            protocol: this.uri.protocol,
            hostname: this.uri.hostname,
            path,
            method: 'GET',
            headers: {
              ...this.headers,
              ...headers,
            },
          },
          (response) => {
            const { headers, statusCode, statusMessage } = response;
            let dataChunks = '';

            response.on('data', (chunk) => {
              dataChunks += chunk;
            });

            response.on('end', () => {
              let data: any;

              try {
                data = JSON.parse(dataChunks);
              } catch (error) {
                data = dataChunks?.toString();
              }

              const result = {
                protocol: this.uri.protocol,
                hostname: this.uri.hostname,
                path: path,
                method: 'GET',
                headers,
                statusCode,
                statusMessage,
                data,
              };

              if (statusCode >= 200 && statusCode < 300) {
                return resolve(result);
              }

              reject(result);
            });
          },
        );

        clientRequest.on('error', (error) => {
          reject(error);
        });

        clientRequest.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  post<T = unknown, K extends any = any>(
    path: string,
    payload: K,
    { headers }: HttpServiceConfig,
  ): Promise<HttpServiceResponse<T>> {
    return new Promise<HttpServiceResponse<T>>((resolve, reject) => {
      try {
        const request =
          this.uri.protocol === 'https:' ? httpsRequest : httpRequest;

        const data = JSON.stringify(payload);

        const clientRequest = request(
          {
            protocol: this.uri.protocol,
            hostname: this.uri.hostname,
            path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': data.length,
              ...this.headers,
              ...headers,
            },
          },
          (response) => {
            const { headers, statusCode, statusMessage } = response;

            let dataChunks = '';

            response.on('data', (chunk) => {
              dataChunks += chunk;
            });

            response.on('end', () => {
              let data: any;

              try {
                data = JSON.parse(dataChunks);
              } catch (error) {
                data = dataChunks?.toString();
              }

              const result = {
                protocol: this.uri.protocol,
                hostname: this.uri.hostname,
                path: path,
                method: 'POST',
                headers,
                statusCode,
                statusMessage,
                data,
              };

              if (statusCode >= 200 && statusCode < 300) {
                return resolve(result);
              }

              reject(result);
            });
          },
        );

        clientRequest.on('error', (error) => {
          reject(error);
        });

        clientRequest.write(data);
        clientRequest.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
