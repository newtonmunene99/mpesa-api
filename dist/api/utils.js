'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.environment = exports.keys = exports.routes = undefined;

var _mpesa = require('./mpesa');

var _mpesa2 = _interopRequireDefault(_mpesa);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var routes = exports.routes = {
    base: {
        production: 'https://api.safaricom.co.ke',
        sandbox: 'https://sandbox.safaricom.co.ke'
    },
    oauth: '/oauth/v1/generate?grant_type=client_credentials',
    b2c: '/mpesa/b2c/v1/paymentrequest',
    b2b: '/mpesa/b2b/v1/paymentrequest',
    c2bregister: '/mpesa/c2b/v1/registerurl',
    c2bsimulate: '/mpesa/c2b/v1/simulate',
    accountbalance: '/mpesa/accountbalance/v1/query',
    transactionstatus: '/mpesa/transactionstatus/v1/query',
    reversal: '/mpesa/reversal/v1/request',
    stkpush: '/mpesa/stkpush/v1/processrequest',
    stkquery: '/mpesa/stkpushquery/v1/query'
};

var keys = exports.keys = {
    consumerkey: 'qPB2VrkOdN0mHzwuKbfBdxghTB8BxDB0',
    consumersecret: 'JcmP4DBFZc3CjXo0',
    securitycredential: 'put your Security Credential',
    certificatepath: 'path to certificate'
}; //this is completely optional in development

var environment = exports.environment = {
    production: keys.securitycredential,
    sandbox: '@SafaricomDaraja544'
};