'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _mpesa = require('./api/mpesa');

var _utils = require('./api/utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var mpesa = function () {
    function mpesa(credentials, environment) {
        _classCallCheck(this, mpesa);

        var key = credentials.key,
            secret = credentials.secret,
            securitycredential = credentials.securitycredential,
            certificatepath = credentials.certificatepath;

        this.key = key;
        this.secret = secret;
        this.securitycredential = securitycredential;
        this.certificatepath = certificatepath;
        this.environment = environment;
        this.initiate();
    }

    _createClass(mpesa, [{
        key: 'initiate',
        value: function initiate() {
            var _this = this;

            return new Promise(function (resolve) {
                _mpesa.init.oauth(_utils.keys.consumerkey, _utils.keys.consumersecret, _this.environment).then(function (res) {
                    resolve(_axios2.default.create({
                        baseURL: _utils.routes.base + _this.environment,
                        headers: {
                            Authorization: 'Bearer ' + res,
                            'Content-Type': 'application/json'
                        }
                    }));
                    console.log('response is ' + res);
                }).catch(function (err) {
                    console.log('err is ' + err);
                });
            });
        }
    }, {
        key: 'b2c',
        value: function b2c(InitiatorName, CommandID, Amount, PartyA, PartyB, Remarks, QueueTimeOutURL, ResultURL, Occasion) {
            var _this2 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    InitiatorName: InitiatorName,
                    SecurityCredential: ' ',
                    CommandID: CommandID,
                    Amount: Amount,
                    PartyA: PartyA,
                    PartyB: PartyB,
                    Remarks: Remarks,
                    QueueTimeOutURL: QueueTimeOutURL,
                    ResultURL: ResultURL,
                    Occasion: Occasion
                };
                _this2.initiate().then(function (res) {
                    res.post(_utils.routes.b2c, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'b2b',
        value: function b2b(InitiatorName, CommandID, SenderIdentifierType, RecieverIdentifierType, Amount, PartyA, PartyB, AccountReference, Remarks, QueueTimeOutURL, ResultURL) {
            var _this3 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    InitiatorName: InitiatorName,
                    SecurityCredential: ' ',
                    CommandID: CommandID,
                    SenderIdentifierType: SenderIdentifierType,
                    RecieverIdentifierType: RecieverIdentifierType,
                    Amount: Amount,
                    PartyA: PartyA,
                    PartyB: PartyB,
                    AccountReference: AccountReference,
                    Remarks: Remarks,
                    QueueTimeOutURL: QueueTimeOutURL,
                    ResultURL: ResultURL
                };
                _this3.initiate().then(function (res) {
                    res.post(_utils.routes.b2b, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'c2bregister',
        value: function c2bregister(ShortCode, ResponseType, ConfirmationURL, ValidationURL) {
            var _this4 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    ShortCode: ShortCode,
                    ResponseType: ResponseType,
                    ConfirmationURL: ConfirmationURL,
                    ValidationURL: ValidationURL
                };
                _this4.initiate().then(function (res) {
                    res.post(_utils.routes.c2bregister, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'c2bsimulate',
        value: function c2bsimulate(ShortCode, CommandID, Amount, Msisdn, BillRefNumber) {
            var _this5 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    ShortCode: ShortCode,
                    CommandID: CommandID,
                    Amount: Amount,
                    Msisdn: Msisdn,
                    BillRefNumber: BillRefNumber
                };
                _this5.initiate().then(function (res) {
                    res.post(_utils.routes.c2bsimulate, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'accountBalance',
        value: function accountBalance(Initiator, CommandID, PartyA, IdentifierType, Remarks, QueueTimeOutURL, ResultURL) {
            var _this6 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    Initiator: Initiator,
                    CommandID: CommandID,
                    PartyA: PartyA,
                    IdentifierType: IdentifierType,
                    Remarks: Remarks,
                    QueueTimeOutURL: QueueTimeOutURL,
                    ResultURL: ResultURL
                };
                _this6.initiate().then(function (res) {
                    res.post(_utils.routes.accountbalance, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'transactionStatus',
        value: function transactionStatus(Initiator, CommandID, TransactionID, PartyA, IdentifierType, ResultURL, QueueTimeOutURL, Remarks, Occasion) {
            var _this7 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    Initiator: Initiator,
                    SecurityCredential: ' ',
                    CommandID: CommandID,
                    TransactionID: TransactionID,
                    PartyA: PartyA,
                    IdentifierType: IdentifierType,
                    ResultURL: ResultURL,
                    QueueTimeOutURL: QueueTimeOutURL,
                    Remarks: Remarks,
                    Occasion: Occasion
                };
                _this7.initiate().then(function (res) {
                    res.post(_utils.routes.transactionstatus, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'reversal',
        value: function reversal(Initiator, TransactionID, Amount, ReceiverParty, RecieverIdentifierType, ResultURL, QueueTimeOutURL, Remarks, Occasion) {
            var _this8 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    Initiator: Initiator,
                    SecurityCredential: ' ',
                    CommandID: 'TransactionReversal',
                    TransactionID: TransactionID,
                    Amount: Amount,
                    ReceiverParty: ReceiverParty,
                    RecieverIdentifierType: RecieverIdentifierType,
                    ResultURL: ResultURL,
                    QueueTimeOutURL: QueueTimeOutURL,
                    Remarks: Remarks,
                    Occasion: Occasion
                };
                _this8.initiate().then(function (res) {
                    res.post(_utils.routes.reversal, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'lipanampesa',
        value: function lipanampesa(BusinessShortCode, Password, Timestamp, Amount, PartyA, PartyB, PhoneNumber, CallBackURL, AccountReference, TransactionDesc) {
            var _this9 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    BusinessShortCode: BusinessShortCode,
                    Password: Password,
                    Timestamp: Timestamp,
                    TransactionType: 'CustomerPayBillOnline',
                    Amount: Amount,
                    PartyA: PartyA,
                    PartyB: PartyB,
                    PhoneNumber: PhoneNumber,
                    CallBackURL: CallBackURL,
                    AccountReference: AccountReference,
                    TransactionDesc: TransactionDesc
                };
                _this9.initiate().then(function (res) {
                    res.post(_utils.routes.lipanampesa, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }, {
        key: 'lipanampesaquery',
        value: function lipanampesaquery(BusinessShortCode, Password, Timestamp, CheckoutRequestID) {
            var _this10 = this;

            return new Promise(function (resolve, reject) {
                var data = {
                    BusinessShortCode: BusinessShortCode,
                    Password: Password,
                    Timestamp: Timestamp,
                    CheckoutRequestID: CheckoutRequestID
                };
                _this10.initiate().then(function (res) {
                    res.post(_utils.routes.lipanampesaquery, data).then(function (res) {
                        console.log(res);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }).catch(function (err) {});
            });
        }
    }]);

    return mpesa;
}();

exports.default = mpesa;