import Axios from 'axios';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as constants from 'constants';
import { routes } from './helpers';

export var api = {
    oauth: (key, secret, environment) => {
        return new Promise((resolve, reject) => {
            var baseURL: any;
            if (environment == 'sandbox') {
                baseURL = routes.sandbox;
            } else if (environment == 'production') {
                baseURL = routes.production;
            } else {
                baseURL = null;
            }
            Axios({
                method: 'get',
                url: baseURL + routes.oauth,
                headers: {
                    Authorization:
                        'Basic ' +
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
                certpath = String(
                    fs.readFileSync(path.resolve('../keys/sandbox-cert.cer'))
                );
            } else {
                certpath = String(fs.readFileSync(certificatepath));
            }
            var encryption = crypto
                .publicEncrypt(
                    {
                        key: certpath,
                        padding: constants.RSA_PKCS1_PADDING
                    },
                    buffer
                )
                .toString('base64');
            resolve(encryption);
        });
    }
};
