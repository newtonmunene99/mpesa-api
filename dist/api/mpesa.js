'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.init = undefined;

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _utils = require('./utils');

var _os = require('os');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var crypto = require('crypto');

var password;
var init = exports.init = {
    oauth: function oauth(key, secret, environment) {
        return new Promise(function (resolve, reject) {
            (0, _axios2.default)({
                method: 'get',
                url: '' + _utils.routes.base + '.' + environment + _utils.routes.oauth,
                headers: {
                    Authorization: 'Basic ' + new Buffer(key + ':' + secret).toString('base64'),
                    'Content-Type': 'application/json'
                }
            }).then(function (res) {
                resolve(res.data.access_token);
            }).catch(function (err) {
                reject(err);
            });
        });
    },
    secure: function secure() {
        return new Promise(function (resolve, reject) {
            var buffer = new Buffer(password);
            var encryption = crypto.publicEncrypt({
                key: _utils.keys.certificatepath,
                padding: _os.constants.RSA_PKCS1_PADDING,
                buffer: buffer
            }).toString('base64');
            console.log('encryption is' + encryption);
            resolve(encryption);
        });
    }
};