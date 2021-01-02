"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpService = void 0;
const https_1 = require("https");
const http_1 = require("http");
const url_1 = require("url");
class HttpService {
    constructor(config) {
        const { baseURL, headers } = config;
        this.uri = url_1.parse(baseURL);
        this.headers = headers;
    }
    get(path, { headers }) {
        return new Promise((resolve, reject) => {
            try {
                const request = this.uri.protocol === 'https:' ? https_1.request : http_1.request;
                const clientRequest = request({
                    protocol: this.uri.protocol,
                    hostname: this.uri.hostname,
                    path,
                    method: 'GET',
                    headers: Object.assign(Object.assign({}, this.headers), headers),
                }, (response) => {
                    const { headers, statusCode, statusMessage } = response;
                    let dataChunks = '';
                    response.on('data', (chunk) => {
                        dataChunks += chunk;
                    });
                    response.on('end', () => {
                        let data;
                        try {
                            data = JSON.parse(dataChunks);
                        }
                        catch (error) {
                            data = dataChunks === null || dataChunks === void 0 ? void 0 : dataChunks.toString();
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
                });
                clientRequest.on('error', (error) => {
                    reject(error);
                });
                clientRequest.end();
            }
            catch (error) {
                reject(error);
            }
        });
    }
    post(path, payload, { headers }) {
        return new Promise((resolve, reject) => {
            try {
                const request = this.uri.protocol === 'https:' ? https_1.request : http_1.request;
                const data = JSON.stringify(payload);
                const clientRequest = request({
                    protocol: this.uri.protocol,
                    hostname: this.uri.hostname,
                    path,
                    method: 'POST',
                    headers: Object.assign(Object.assign({ 'Content-Type': 'application/json', 'Content-Length': data.length }, this.headers), headers),
                }, (response) => {
                    const { headers, statusCode, statusMessage } = response;
                    let dataChunks = '';
                    response.on('data', (chunk) => {
                        dataChunks += chunk;
                    });
                    response.on('end', () => {
                        let data;
                        try {
                            data = JSON.parse(dataChunks);
                        }
                        catch (error) {
                            data = dataChunks === null || dataChunks === void 0 ? void 0 : dataChunks.toString();
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
                });
                clientRequest.on('error', (error) => {
                    reject(error);
                });
                clientRequest.write(data);
                clientRequest.end();
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
exports.HttpService = HttpService;
//# sourceMappingURL=http.service.js.map