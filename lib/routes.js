"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
exports.routes = {
    production: 'https://api.safaricom.co.ke',
    sandbox: 'https://sandbox.safaricom.co.ke',
    oauth: '/oauth/v1/generate?grant_type=client_credentials',
    b2c: '/mpesa/b2c/v1/paymentrequest',
    b2b: '/mpesa/b2b/v1/paymentrequest',
    c2bregister: '/mpesa/c2b/v1/registerurl',
    c2bsimulate: '/mpesa/c2b/v1/simulate',
    accountbalance: '/mpesa/accountbalance/v1/query',
    transactionstatus: '/mpesa/transactionstatus/v1/query',
    reversal: '/mpesa/reversal/v1/request',
    stkpush: '/mpesa/stkpush/v1/processrequest',
    stkquery: '/mpesa/stkpushquery/v1/query',
};
//# sourceMappingURL=routes.js.map