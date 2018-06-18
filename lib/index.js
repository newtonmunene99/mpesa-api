"use strict";
/*
.88b  d88. db    db d8b   db d88888b d8b   db d88888b
88'YbdP`88 88    88 888o  88 88'     888o  88 88'
88  88  88 88    88 88V8o 88 88ooooo 88V8o 88 88ooooo
88  88  88 88    88 88 V8o88 88~~~~~ 88 V8o88 88~~~~~
88  88  88 88b  d88 88  V888 88.     88  V888 88.
YP  YP  YP ~Y8888P' VP   V8P Y88888P VP   V8P Y88888P
*/
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const api_1 = require("./api/api");
const helpers_1 = require("./api/helpers");
class mpesa {
    constructor(credentials, environment) {
        this.key = credentials.key;
        this.secret = credentials.secret;
        this.securitycredential = credentials.securitycredential;
        this.certificatepath = credentials.certificatepath;
        this.environment = environment;
        if (environment == 'sandbox') {
            this.baseURL = helpers_1.routes.sandbox;
        }
        else if (environment == 'production') {
            this.baseURL = helpers_1.routes.production;
        }
        else {
            this.baseURL = null;
        }
        this.secure();
    }
    secure() {
        var password;
        if (this.environment == 'production') {
            password = this.securitycredential;
        }
        else if (this.environment == 'sandbox') {
            password = 'Safaricom868!';
        }
        api_1.api.secure(password, this.certificatepath)
            .then(res => {
            this.securitycredential = res;
        })
            .catch(err => {
            console.error(err);
        });
    }
    initiate() {
        return new Promise(resolve => {
            api_1.api.oauth(this.key, this.secret, this.environment)
                .then(res => {
                resolve(axios_1.default.create({
                    baseURL: this.baseURL,
                    headers: {
                        Authorization: 'Bearer ' + res,
                        'Content-Type': 'application/json'
                    }
                }));
            })
                .catch(err => {
                console.log(err);
            });
        });
    }
    /**
     * Business to Customer(B2C)
     * @name B2C
     * @function
     * @description This API enables Business to Customer (B2C) transactions between a company and customers who are the end-users of its products or services. Use of this API requires a valid and verified B2C M-Pesa Short code.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2c-api }
     * @param  {string} InitiatorName This is the credential/username used to authenticate the transaction request.
     * @param  {string} CommandID  Unique command for each transaction type e.g. SalaryPayment, BusinessPayment, PromotionPayment.
     * @param  {number} Amount The amount being transacted
     * @param  {string} PartyA Organization’s shortcode initiating the transaction.
     * @param  {string} PartyB Phone number receiving the transaction
     * @param  {string} Remarks Comments that are sent along with the transaction.
     *  @param  {string} QueueTimeOutURL The timeout end-point that receives a timeout response.
     * @param  {string} ResultURL  The end-point that receives the response of the transaction
     *  @param  {string} Occasion Optional
     */
    b2c(data) {
        return new Promise((resolve, reject) => {
            const body = {
                InitiatorName: data.InitiatorName,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID || 'BusinessPayment',
                Amount: data.Amount,
                PartyA: data.PartyA,
                PartyB: data.PartyB,
                Remarks: data.Remarks || 'Business To Customer Request',
                QueueTimeOutURL: data.QueueTimeOutURL,
                ResultURL: data.ResultURL,
                Occasion: data.Occasion || 'Business To Customer Request'
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.b2c, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * Business to Business(B2B)
     * @name B2B
     * @function
     * @description This API enables Business to Business (B2B) transactions between a business and another business. Use of this API requires a valid and verified B2B M-Pesa short code for the business initiating the transaction and the both businesses involved in the transaction.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2b-api }
     * @param  {string} InitiatorName This is the credential/username used to authenticate the transaction request.
     * @param  {string} CommandID  Unique command for each transaction type, possible values are: BusinessPayBill, MerchantToMerchantTransfer, MerchantTransferFromMerchantToWorking, MerchantServicesMMFAccountTransfer, AgencyFloatAdvance.
     * @param  {number} Amount The amount being transacted
     * @param  {string} PartyA Organization’s shortcode initiating the transaction.
     * @param  {string} PartyB Organization’s short code receiving the funds being transacted.
     *  @param  {number} SenderIdentifierType Type of organization sending the transaction.
     *  @param  {number} RecieverIdentifierType Type of organization receiving the funds being transacted.
     * @param  {string} Remarks Comments that are sent along with the transaction.
     *  @param  {string} QueueTimeOutURL The path that stores information of time out transactions.it should be properly validated to make sure that it contains the port, URI and domain name or publicly available IP.
     * @param  {string} ResultURL  The path that receives results from M-Pesa it should be properly validated to make sure that it contains the port, URI and domain name or publicly available IP.
     *  @param  {any} AccountReference Account Reference mandatory for “BusinessPaybill” CommandID.
     * @returns {Promise} Promise
     */
    b2b(data) {
        return new Promise((resolve, reject) => {
            const body = {
                InitiatorName: data.InitiatorName,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID || 'MerchantToMerchantTransfer',
                SenderIdentifierType: data.SenderIdentifierType || 4,
                RecieverIdentifierType: data.RecieverIdentifierType || 4,
                Amount: data.Amount,
                PartyA: data.PartyA,
                PartyB: data.PartyB,
                AccountReference: data.AccountReference,
                Remarks: data.Remarks || 'Business To Business Request',
                QueueTimeOutURL: data.QueueTimeOutURL,
                ResultURL: data.ResultURL
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.b2b, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * C2B Register
     * @name C2BRegister
     * @function
     * @description The C2B Register URL API registers the 3rd party’s confirmation and validation URLs to M-Pesa ; which then maps these URLs to the 3rd party shortcode. Whenever M-Pesa receives a transaction on the shortcode, M-Pesa triggers a validation request against the validation URL and the 3rd party system responds to M-Pesa with a validation response (either a success or an error code). The response expected is the success code the 3rd party.
     *
     M-Pesa completes or cancels the transaction depending on the validation response it receives from the 3rd party system. A confirmation request of the transaction is then sent by M-Pesa through the confirmation URL back to the 3rd party which then should respond with a success acknowledging the confirmation.
     *
     The 3rd party resource URLs for both confirmation and validation must be HTTPS in production. Validation is an optional feature that needs to be activated on M-Pesa, the owner of the shortcode needs to make this request for activation.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#c2b-api }
     * @param  {string} ValidationURLValidation URL for the client.
     * @param  {string} ConfirmationURL Confirmation URL for the client.
     * @param  {string} ResponseType Default response type for timeout.
     * @param  {string} ShortCode The short code of the organization.
     * @returns {Promise}
     */
    c2bregister(data) {
        return new Promise((resolve, reject) => {
            const body = {
                ShortCode: data.ShortCode,
                ResponseType: data.ResponseType || 'Completed',
                ConfirmationURL: data.ConfirmationURL,
                ValidationURL: data.ValidationURL
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.c2bregister, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * C2B Simulate
     * @name C2BSimulate
     * @function
     * @description C2B Simulate
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#c2b-api }
     * @param  {string} CommandID Unique command for each transaction type.
     * @param  {number} Amount The amount been transacted.
     * @param  {string} Msisdn MSISDN (phone number) sending the transaction, start with country code without the plus(+) sign.
     * @param  {any} BillRefNumber Bill Reference Number.
     * @param  {string} ShortCode 6 digit M-Pesa Till Number or PayBill Number
     * @returns {Promise} Promise
     */
    c2bsimulate(data) {
        return new Promise((resolve, reject) => {
            const body = {
                ShortCode: data.ShortCode,
                CommandID: data.CommandID || 'CustomerPayBillOnline',
                Amount: data.Amount,
                Msisdn: data.Msisdn,
                BillRefNumber: data.BillRefNumber
            };
            console.log('msisdn is ' + data.Msisdn);
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.c2bsimulate, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * Account Balance
     * @name AccountBalance
     * @function
     * @description The Account Balance API requests for the account balance of a shortcode.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#account-balance-api }
     * @param  {string} Initiator This is the credential/username used to authenticate the transaction request.
     * @param  {string} SecurityCredential Base64 encoded string of the Security Credential, which is encrypted using M-Pesa public key and validates the transaction on M-Pesa Core system.
     * @param  {string} CommandID A unique command passed to the M-Pesa system.
     * @param  {string} PartyA The shortcode of the organisation initiating the transaction.
     * @param  {string} IdentifierType Type of the organisation receiving the transaction.
     * @param  {string} Remarks Comments that are sent along with the transaction.
     * @param  {string} QueueTimeOutURL The timeout end-point that receives a timeout message.
     * @param  {string} ResultURL The end-point that receives a successful transaction.
     * @returns {Promise}
     */
    accountBalance(data) {
        return new Promise((resolve, reject) => {
            const body = {
                Initiator: data.Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID || 'AccountBalance',
                PartyA: data.PartyA,
                IdentifierType: data.IdentifierType,
                Remarks: data.Remarks || 'Check Account Balance',
                QueueTimeOutURL: data.QueueTimeOutURL,
                ResultURL: data.ResultURL
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.accountbalance, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    transactionStatus(data) {
        return new Promise((resolve, reject) => {
            const body = {
                Initiator: data.Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID || 'TransactionStatusQuery',
                TransactionID: data.TransactionID,
                PartyA: data.PartyA,
                IdentifierType: data.IdentifierType,
                ResultURL: data.ResultURL,
                QueueTimeOutURL: data.QueueTimeOutURL,
                Remarks: data.Remarks || 'Transaction Reversal',
                Occasion: data.Occasion || 'TransactionReversal'
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.transactionstatus, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * Reversal Request
     * @name ReversalRequest
     * @description Transaction Reversal API reverses a M-Pesa transaction.
     * @function
     * @see {@link https://developer.safaricom.co.ke/reversal/apis/post/request| Reversal Request}
     * @param  {[type]} Initiator                 The name of Initiator to initiating the request
     * @param  {string} TransactionID                     The transaction id for reversal eg QLXXXX1234
     * @param  {String} CommandID Takes only 'TransactionReversal' Command id
     * @param  {string} QueueTimeOutURL                       The path that stores information of time out transaction
     * @param  {string} ReceiverParty                  Organization receiving the transaction
     *  @param  {number} RecieverIdentifierType         Type of organization receiving the transaction
     * @param  {string} ResultURL                         The path that stores information of transaction
     * @param  {String} Remarks             Comments that are sent along with the transaction.
     * @param  {String} Occasion          Optional Parameter
     * @return {Promise} Promise
     */
    reversal(data) {
        return new Promise((resolve, reject) => {
            const body = {
                Initiator: data.Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID || 'TransactionReversal',
                TransactionID: data.TransactionID,
                Amount: data.Amount,
                ReceiverParty: data.ReceiverParty,
                RecieverIdentifierType: data.RecieverIdentifierType || 11,
                ResultURL: data.ResultURL,
                QueueTimeOutURL: data.QueueTimeOutURL,
                Remarks: data.Remarks || 'Money Reversal',
                Occasion: data.Occasion || 'Reversal'
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.reversal, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * Lipa na Mpesa Online
     * @name Stkpush
     * @function
     * @description Lipa na M-Pesa Online Payment API is used to initiate a M-Pesa transaction on behalf of a customer using STK Push. This is the same technique mySafaricom App uses whenever the app is used to make payments.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-payment }
     * @param  {string} BusinessShortCode The organization shortcode used to receive the transaction.
     * @param  {number} Amount The amount to be transacted.
     * @param  {string} PartyA The MSISDN sending the funds.
     * @param  {string} PartyB The organization shortcode receiving the funds
     * @param  {string} PhoneNumber The MSISDN sending the funds.
     * @param  {string} CallBackURL The url to where responses from M-Pesa will be sent to.
     * @param  {string} AccountReference Used with M-Pesa PayBills.
     * @param  {string} TransactionDesc A description of the transaction.
     * @param {any} passKey Lipa Na Mpesa Pass Key
     * @returns {Promise}
     */
    lipanampesa(data) {
        return new Promise((resolve, reject) => {
            const Timestamp = new Date()
                .toISOString()
                .replace(/[^0-9]/g, '')
                .slice(0, -3);
            const Password = Buffer.from([
                data.BusinessShortCode,
                data.passKey,
                Timestamp
            ]).toString('base64');
            const body = {
                BusinessShortCode: data.BusinessShortCode,
                Password: Password,
                Timestamp: Timestamp,
                TransactionType: data.TransactionType || 'CustomerPayBillOnline',
                Amount: data.Amount,
                PartyA: data.PartyA,
                PartyB: data.BusinessShortCode,
                PhoneNumber: data.PhoneNumber,
                CallBackURL: data.CallBackURL,
                AccountReference: data.AccountReference,
                TransactionDesc: data.TransactionDesc || 'Lipa Na Mpesa Online'
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.stkpush, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    /**
     * Lipa na Mpesa Online Query Request
     * @name StkPushQueryRequest
     * @function
     * @description Lipa na M-Pesa Online Payment API is used to initiate a M-Pesa transaction on behalf of a customer using STK Push. This is the same technique mySafaricom App uses whenever the app is used to make payments.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-query-request }
     * @param  {string} BusinessShortCode The organization shortcode used to receive the transaction.
     * @param  {string} CheckoutRequestID The Checkout Request ID.
     * @param {any} passKey Lipa Na Mpesa Pass Key
     * @returns {Promise}
     */
    lipanampesaquery(data) {
        return new Promise((resolve, reject) => {
            const Timestamp = new Date()
                .toISOString()
                .replace(/[^0-9]/g, '')
                .slice(0, -3);
            const Password = Buffer.from([
                data.BusinessShortCode,
                data.passKey,
                Timestamp
            ]).toString('base64');
            const body = {
                BusinessShortCode: data.BusinessShortCode,
                Password: Password,
                Timestamp: Timestamp,
                CheckoutRequestID: data.CheckoutRequestID
            };
            this.initiate()
                .then((res) => {
                res.post(helpers_1.routes.stkquery, body)
                    .then(res => {
                    resolve(res);
                })
                    .catch(err => {
                    reject(err);
                });
            })
                .catch(err => {
                reject(err);
            });
        });
    }
}
exports.mpesa = mpesa;
//# sourceMappingURL=index.js.map