import { HttpServiceConfig, HttpServiceResponse } from '../models/interfaces';
export declare class HttpService {
    private uri;
    private headers;
    constructor(config?: HttpServiceConfig);
    get<T = unknown>(path: string, { headers }: HttpServiceConfig): Promise<HttpServiceResponse<T>>;
    post<T = unknown, K extends any = any>(path: string, payload: K, { headers }: HttpServiceConfig): Promise<HttpServiceResponse<T>>;
}
