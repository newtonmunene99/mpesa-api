"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const constants = require("constants");
const helpers_1 = require("./helpers");
exports.api = {
    oauth: (key, secret, environment) => {
        return new Promise((resolve, reject) => {
            var baseURL;
            if (environment == 'sandbox') {
                baseURL = helpers_1.routes.sandbox;
            }
            else if (environment == 'production') {
                baseURL = helpers_1.routes.production;
            }
            else {
                baseURL = null;
            }
            axios_1.default({
                method: 'get',
                url: baseURL + helpers_1.routes.oauth,
                headers: {
                    Authorization: 'Basic ' +
                        new Buffer(key + ':' + secret).toString('base64'),
                    'Content-Type': 'application/json'
                }
            })
                .then(res => {
                resolve(res.data.access_token);
            })
                .catch(err => {
                reject(err);
            });
        });
    },
    secure: (password, certificatepath) => {
        return new Promise(resolve => {
            var buffer = new Buffer(password);
            var certpath;
            if (!certificatepath) {
                certpath = String(fs.readFileSync(path.resolve('../keys/sandbox-cert.cer')));
            }
            else {
                certpath = String(fs.readFileSync(certificatepath));
            }
            var encryption = crypto
                .publicEncrypt({
                key: certpath,
                padding: constants.RSA_PKCS1_PADDING
            }, buffer)
                .toString('base64');
            resolve(encryption);
        });
    }
};
//# sourceMappingURL=api.js.map