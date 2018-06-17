import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { routes } from './utils';
import constants from 'constants';

export var init = {
    oauth: (key, secret, environment) => {
        return new Promise((resolve, reject) => {
            axios({
                method: 'get',
                url: '' + routes.base + '.' + environment + routes.oauth,
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
                    fs.readFileSync(path.resolve('keys/sandbox-cert.cer'))
                );
            } else {
                certpath = String(fs.readFileSync(certificatepath));
            }
            var encryption = crypto
                .publicEncrypt({
                    key: certpath,
                    padding: constants.RSA_PKCS1_PADDING,
                    buffer
                })
                .toString('base64');
            resolve(encryption);
        });
    }
};
