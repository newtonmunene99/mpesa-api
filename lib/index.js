"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mpesa = void 0;
const buffer_1 = require("buffer");
const constants_1 = require("constants");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const routes_1 = require("./routes");
const http_service_1 = require("./services/http.service");
class Mpesa {
    constructor({ clientKey, clientSecret, securityCredential, initiatorPassword, certificatePath, }, environment) {
        this.clientKey = clientKey;
        this.clientSecret = clientSecret;
        this.http = new http_service_1.HttpService({
            baseURL: environment === 'production' ? routes_1.routes.production : routes_1.routes.sandbox,
            headers: { 'Content-Type': 'application/json' },
        });
        if (!securityCredential && !initiatorPassword) {
            throw new Error('You must provide either the security credential or initiator password. Both cannot be null');
        }
        if (!securityCredential) {
            this.generateSecurityCredential(initiatorPassword, certificatePath);
        }
        else {
            this.securityCredential = securityCredential;
        }
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.http.get(routes_1.routes.oauth, {
                headers: {
                    Authorization: 'Basic ' +
                        buffer_1.Buffer.from(this.clientKey + ':' + this.clientSecret).toString('base64'),
                },
            });
            return response.data.access_token;
        });
    }
    generateSecurityCredential(password, certificatePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let certificate;
            if (certificatePath != null) {
                const certificateBuffer = yield fs_1.promises.readFile(certificatePath);
                certificate = String(certificateBuffer);
            }
            else {
                const certificateBuffer = yield fs_1.promises.readFile(path_1.resolve(__dirname, this.environment === 'production'
                    ? 'keys/production-cert.cer'
                    : 'keys/sandbox-cert.cer'));
                certificate = String(certificateBuffer);
            }
            this.securityCredential = crypto_1.publicEncrypt({
                key: certificate,
                padding: constants_1.RSA_PKCS1_PADDING,
            }, buffer_1.Buffer.from(password)).toString('base64');
        });
    }
    /**
     * C2B Register
     *
     * @name C2BRegister
     *
     * @description The C2B Register URL API registers the 3rd party’s confirmation and validation URLs to M-Pesa ; which then maps these URLs to the 3rd party shortcode. Whenever M-Pesa receives a transaction on the shortcode, M-Pesa triggers a validation request against the validation URL and the 3rd party system responds to M-Pesa with a validation response (either a success or an error code). The response expected is the success code the 3rd party.
     *
     M-Pesa completes or cancels the transaction depending on the validation response it receives from the 3rd party system. A confirmation request of the transaction is then sent by M-Pesa through the confirmation URL back to the 3rd party which then should respond with a success acknowledging the confirmation.
     *
     The 3rd party resource URLs for both confirmation and validation must be HTTPS in production. Validation is an optional feature that needs to be activated on M-Pesa, the owner of the shortcode needs to make this request for activation.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#c2b-api }
     * @param {C2BRegisterInterface} data Data
     * @param  {string} data.ValidationURLValidation URL for the client.
     * @param  {string} data.ConfirmationURL Confirmation URL for the client.
     * @param  {string} data.ResponseType Default response type for timeout. Can either be `Completed` or `Cancelled`
     * @param  {string} data.ShortCode The short code of the organization.
     * @returns {Promise} Returns a Promise with data from Safaricom if successful Returns
     */
    c2bRegister({ ShortCode, ResponseType, ConfirmationURL, ValidationURL, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.c2bregister, { ShortCode, ResponseType, ConfirmationURL, ValidationURL }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * C2B Simulate
     *
     * @name C2BSimulate
     *
     * @description C2B Simulate
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#c2b-api }
     * @param {C2BSimulateInterface} data Data
     * @param  {string} data.CommandID Unique command for each transaction type.
     * @param  {number} data.Amount The amount been transacted.
     * @param  {string} data.Msisdn MSISDN (phone number) sending the transaction, start with country code without the plus(+) sign.
     * @param  {any} data.BillRefNumber Bill Reference Number.
     * @param  {string} data.ShortCode 6 digit M-Pesa Till Number or PayBill Number
     * @returns {Promise} Returns a Promise with data from Safaricom if successful Promise
     */
    c2bSimulate({ ShortCode, CommandID, Amount, Msisdn, BillRefNumber, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.c2bsimulate, {
                ShortCode,
                CommandID,
                Amount,
                Msisdn,
                BillRefNumber: BillRefNumber !== null && BillRefNumber !== void 0 ? BillRefNumber : 'account',
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * Transaction Status
     *
     * @name Transaction Status
     *
     * @description Transaction Status API checks the status of a B2B, B2C and C2B APIs transactions.
     * @see    {@link https://developer.safaricom.co.ke/docs#transaction-status }
     * @param  {TransactionStatusInterface} data Data
     * @param  {string} data.Initiator  The name of Initiator to initiating the request.
     * @param  {string} data.SecurityCredential Encrypted Credential of user getting transaction status.
     * @param  {string} data.CommandID only 'TransactionStatusQuery' command id.
     * @param  {string} data.TransactionID Unique identifier to identify a transaction on M-Pesa.
     * @param  {string} data.PartyA Organization’s shortcode initiating the transaction.
     * @param  {any|number} data.IdentifierType - Type of organization receiving the transaction
     * @param  {string} data.ResultURL  The end-point that receives the response of the transaction
     * @param  {string} data.QueueTimeOutURL The timeout end-point that receives a timeout response.
     * @param  {string} data.Remarks Comments that are sent along with the transaction.
     * @param  {string} data.Occasion Optional
     * @returns {Promise} Returns a Promise with data from Safaricom if successful Promise
     */
    transactionStatus({ Initiator, CommandID, TransactionID, PartyA, IdentifierType, ResultURL, QueueTimeOutURL, Remarks, Occasion, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.transactionstatus, {
                Initiator,
                SecurityCredential: this.securityCredential,
                CommandID: CommandID !== null && CommandID !== void 0 ? CommandID : 'TransactionStatusQuery',
                TransactionID,
                PartyA,
                IdentifierType,
                ResultURL,
                QueueTimeOutURL,
                Remarks: Remarks !== null && Remarks !== void 0 ? Remarks : 'Transaction Status',
                Occasion: Occasion !== null && Occasion !== void 0 ? Occasion : 'TransactionStatus',
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * Business to Customer(B2C)
     *
     * @name B2C
     *
     * @description This API enables Business to Customer (B2C) transactions between a company and customers who are the end-users of its products or services. Use of this API requires a valid and verified B2C M-Pesa Short code.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2c-api }
     * @param {B2CInterface} data Data
     * @param  {string} data.InitiatorName This is the credential/username used to authenticate the transaction request.
     * @param  {string} data.CommandID  Unique command for each transaction type e.g. SalaryPayment, BusinessPayment, PromotionPayment.
     * @param  {number} data.Amount The amount being transacted
     * @param  {string} data.PartyA Organization’s shortcode initiating the transaction.
     * @param  {string} data.PartyB Phone number receiving the transaction
     * @param  {string} data.Remarks Comments that are sent along with the transaction.
     * @param  {string} data.QueueTimeOutURL The timeout end-point that receives a timeout response.
     * @param  {string} data.ResultURL  The end-point that receives the response of the transaction
     * @param  {string} data.Occasion Optional
     * @returns {Promise} Returns a Promise with data from Safaricom if successful
     */
    b2c({ Initiator, CommandID, Amount, PartyA, PartyB, Remarks, QueueTimeOutURL, ResultURL, Occasion, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.b2c, {
                InitiatorName: Initiator,
                SecurityCredential: this.securityCredential,
                CommandID: CommandID,
                Amount: Amount,
                PartyA: PartyA,
                PartyB: PartyB,
                Remarks: Remarks !== null && Remarks !== void 0 ? Remarks : 'account',
                QueueTimeOutURL: QueueTimeOutURL,
                ResultURL: ResultURL,
                Occasion: Occasion !== null && Occasion !== void 0 ? Occasion : 'account',
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * Lipa na Mpesa Online
     *
     * @name Lipa Na Mpesa Online
     *
     * @description Lipa na M-Pesa Online Payment API is used to initiate a M-Pesa transaction on behalf of a customer using STK Push. This is the same technique mySafaricom App uses whenever the app is used to make payments.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-payment }
     * @param {StkPushInterface} data Data
     * @param {string} data.BusinessShortCode The organization shortcode used to receive the transaction.
     * @param {number} data.Amount The amount to be transacted.
     * @param {string} data.PartyA The MSISDN sending the funds.
     * @param {string} data.PartyB The organization shortcode receiving the funds
     * @param {string} data.PhoneNumber The MSISDN sending the funds.
     * @param {string} data.CallBackURL The url to where responses from M-Pesa will be sent to.
     * @param {string} data.AccountReference Used with M-Pesa PayBills.
     * @param {string} data.TransactionDesc A description of the transaction.
     * @param {any} data.passKey Lipa Na Mpesa Pass Key
     * @returns {Promise} Returns a Promise with data from Safaricom if successful
     */
    lipaNaMpesaOnline({ BusinessShortCode, passKey, TransactionDesc, TransactionType, PartyA, PartyB, Amount, AccountReference, CallBackURL, PhoneNumber, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const Timestamp = new Date()
                .toISOString()
                .replace(/[^0-9]/g, '')
                .slice(0, -3);
            const Password = buffer_1.Buffer.from(BusinessShortCode + passKey + Timestamp).toString('base64');
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.stkpush, {
                BusinessShortCode,
                Password,
                Timestamp,
                TransactionType: TransactionType !== null && TransactionType !== void 0 ? TransactionType : 'CustomerPayBillOnline ',
                Amount,
                PartyA,
                PartyB,
                PhoneNumber,
                CallBackURL,
                AccountReference,
                TransactionDesc: TransactionDesc !== null && TransactionDesc !== void 0 ? TransactionDesc : 'Lipa Na Mpesa Online',
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * Lipa na Mpesa Online
     *
     * @name StkQuery
     *
     * @description Lipa na M-Pesa Online Query is used to check for Payment status.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-query-request }
     * @param {StkQueryInterface} data Data
     * @param {string} data.BusinessShortCode The organization shortcode used to receive the transaction.
     * @param {number} data.CheckoutRequestID Check out Request ID.
     * @param {any} data.passKey Lipa Na Mpesa Pass Key
     * @returns {Promise} Returns a Promise with data from Safaricom if successful
     */
    lipaNaMpesaQuery({ BusinessShortCode, passKey, CheckoutRequestID, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const Timestamp = new Date()
                .toISOString()
                .replace(/[^0-9]/g, '')
                .slice(0, -3);
            const Password = buffer_1.Buffer.from(BusinessShortCode + passKey + Timestamp).toString('base64');
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.stkquery, {
                BusinessShortCode,
                Password,
                Timestamp,
                CheckoutRequestID,
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * Reversal Request
     *
     * @name ReversalRequest
     *
     * @description Transaction Reversal API reverses a M-Pesa transaction.
     * @see {@link https://developer.safaricom.co.ke/reversal/apis/post/request| Reversal Request}
     * @param {ReversalInterface} data Data
     * @param {string} data.Initiator The name of Initiator to initiating the request
     * @param {string} data.TransactionID The transaction id for reversal eg QLXXXX1234
     * @param {string} data.CommandID Takes only 'TransactionReversal' Command id
     * @param {string} data.QueueTimeOutURL The path that stores information of time out transaction
     * @param {string} data.ReceiverParty Organization receiving the transaction
     * @param {number} data.RecieverIdentifierType Type of organization receiving the transaction
     * @param {string} data.ResultURL The path that stores information of transaction
     * @param {string} data.Remarks Comments that are sent along with the transaction.
     * @param {string} data.Occasion Optional Parameter
     * @returns {Promise} Returns a Promise with data from Safaricom if successful
     */
    reversal({ Initiator, CommandID, TransactionID, Amount, ReceiverParty, RecieverIdentifierType, ResultURL, QueueTimeOutURL, Remarks, Occasion, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.reversal, {
                Initiator,
                SecurityCredential: this.securityCredential,
                CommandID: CommandID !== null && CommandID !== void 0 ? CommandID : 'TransactionReversal',
                TransactionID,
                Amount,
                ReceiverParty,
                RecieverIdentifierType: RecieverIdentifierType !== null && RecieverIdentifierType !== void 0 ? RecieverIdentifierType : '4',
                ResultURL,
                QueueTimeOutURL,
                Remarks: Remarks !== null && Remarks !== void 0 ? Remarks : 'Transaction Reversal',
                Occasion: Occasion !== null && Occasion !== void 0 ? Occasion : 'TransactionReversal',
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
    /**
     * Account Balance
     *
     * @name AccountBalance
     *
     * @description The Account Balance API requests for the account balance of a shortcode.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#account-balance-api }
     * @param {AccountBalanceInterface} data Data
     * @param {string} data.Initiator This is the credential/username used to authenticate the transaction request.
     * @param {string} data.SecurityCredential Base64 encoded string of the Security Credential, which is encrypted using M-Pesa public key and validates the transaction on M-Pesa Core system.
     * @param {string} data.CommandID A unique command passed to the M-Pesa system.
     * @param {string} data.PartyA The shortcode of the organisation initiating the transaction.
     * @param {string} data.IdentifierType Type of the organisation receiving the transaction.
     * @param {string} data.Remarks Comments that are sent along with the transaction.
     * @param {string} data.QueueTimeOutURL The timeout end-point that receives a timeout message.
     * @param {string} data.ResultURL The end-point that receives a successful transaction.
     * @returns {Promise} Returns a Promise with data from Safaricom if successful
     */
    accountBalance({ Initiator, CommandID, PartyA, IdentifierType, Remarks, QueueTimeOutURL, ResultURL, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.authenticate();
            const response = yield this.http.post(routes_1.routes.accountbalance, {
                Initiator,
                SecurityCredential: this.securityCredential,
                CommandID: CommandID !== null && CommandID !== void 0 ? CommandID : 'AccountBalance',
                PartyA,
                IdentifierType: IdentifierType !== null && IdentifierType !== void 0 ? IdentifierType : '4',
                Remarks: Remarks !== null && Remarks !== void 0 ? Remarks : 'Account Balance',
                QueueTimeOutURL,
                ResultURL,
            }, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });
            return response.data;
        });
    }
}
exports.Mpesa = Mpesa;
//# sourceMappingURL=index.js.map