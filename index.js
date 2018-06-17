import axios from 'axios';
import { init } from './api/mpesa';
import { keys, routes } from './api/utils';

export class mpesa {
    /**
     * Safaricom Mpesa API
     * @name mpesa-api
     * @function
     * @description Use this API to simplify Mpesa Transactions.
     * @see {@link https://developer.safaricom.co.ke/apis }
     * @param  {object} credentials An Object containing key,secret,securitycredential and certificatepath as the properties.
     * @param  {string} environment A string. Either production or sandbox. Case Sensitive.
     */
    constructor(credentials, environment) {
        const {
            key,
            secret,
            securitycredential,
            certificatepath
        } = credentials;
        this.key = key;
        this.secret = secret;
        this.securitycredential = securitycredential;
        this.certificatepath = certificatepath;
        this.environment = environment;
        this.initiate();
    }

    secure() {
        var password;
        if (this.environment == 'production') {
            password = this.securitycredential;
        } else if (this.environment == 'sandbox') {
            password = 'Safaricom868!';
        }
        init.secure(password, this.certificatepath)
            .then(res => {
                this.securitycredential = res;
                console.log(
                    'This is securitycredential' + this.securitycredential
                );
            })
            .catch(err => {
                reject(err);
            });
    }

    initiate() {
        return new Promise(resolve => {
            init.oauth(keys.consumerkey, keys.consumersecret, this.environment)
                .then(res => {
                    resolve(
                        axios.create({
                            baseURL: routes.base + this.environment,
                            headers: {
                                Authorization: 'Bearer ' + res,
                                'Content-Type': 'application/json'
                            }
                        })
                    );
                    console.log('response is ' + res);
                })
                .catch(err => {
                    console.log('err is ' + err);
                });
        });
    }

    /**
     * Business to Customer(B2C)
     * @name B2C
     * @function
     * @description This API enables Business to Customer (B2C) transactions between a company and customers who are the end-users of its products or services. Use of this API requires a valid and verified B2C M-Pesa Short code.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2b-api }
     * @param  {string} InitiatorName This is the credential/username used to authenticate the transaction request.
     * @param  {string} CommandID  Unique command for each transaction type e.g. SalaryPayment, BusinessPayment, PromotionPayment.
     * @param  {string} Amount The amount being transacted
     * @param  {string} PartyA Organization’s shortcode initiating the transaction.
     * @param  {string} PartyB Phone number receiving the transaction
     * @param  {string} Remarks Comments that are sent along with the transaction.
     *  @param  {string} QueueTimeOutURL The timeout end-point that receives a timeout response.
     * @param  {string} ResultURL  The end-point that receives the response of the transaction
     *  @param  {string} Occasion Optional
     */
    b2c(
        InitiatorName,
        CommandID,
        Amount,
        PartyA,
        PartyB,
        Remarks,
        QueueTimeOutURL,
        ResultURL,
        Occasion
    ) {
        return new Promise((resolve, reject) => {
            const data = {
                InitiatorName: InitiatorName,
                SecurityCredential: this.securitycredential,
                CommandID: CommandID,
                Amount: Amount,
                PartyA: PartyA,
                PartyB: PartyB,
                Remarks: Remarks,
                QueueTimeOutURL: QueueTimeOutURL,
                ResultURL: ResultURL,
                Occasion: Occasion
            };
            this.initiate()
                .then(res => {
                    res.post(routes.b2c, data)
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
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2c-api }
     * @param  {string} InitiatorName This is the credential/username used to authenticate the transaction request.
     * @param  {string} CommandID  Unique command for each transaction type, possible values are: BusinessPayBill, MerchantToMerchantTransfer, MerchantTransferFromMerchantToWorking, MerchantServicesMMFAccountTransfer, AgencyFloatAdvance.
     * @param  {string} Amount The amount being transacted
     * @param  {string} PartyA Organization’s shortcode initiating the transaction.
     * @param  {string} PartyB Organization’s short code receiving the funds being transacted.
     *  @param  {string} SenderIdentifierType Type of organization sending the transaction.
     *  @param  {string} RecieverIdentifierType Type of organization receiving the funds being transacted.
     * @param  {string} Remarks Comments that are sent along with the transaction.
     *  @param  {string} QueueTimeOutURL The path that stores information of time out transactions.it should be properly validated to make sure that it contains the port, URI and domain name or publicly available IP.
     * @param  {string} ResultURL  The path that receives results from M-Pesa it should be properly validated to make sure that it contains the port, URI and domain name or publicly available IP.
     *  @param  {string} AccountReference Account Reference mandatory for “BusinessPaybill” CommandID.
     */
    b2b(
        InitiatorName,
        CommandID,
        SenderIdentifierType,
        RecieverIdentifierType,
        Amount,
        PartyA,
        PartyB,
        AccountReference,
        Remarks,
        QueueTimeOutURL,
        ResultURL
    ) {
        return new Promise((resolve, reject) => {
            const data = {
                InitiatorName: InitiatorName,
                SecurityCredential: this.securitycredential,
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
            this.initiate()
                .then(res => {
                    res.post(routes.b2b, data)
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

    c2bregister(ShortCode, ResponseType, ConfirmationURL, ValidationURL) {
        return new Promise((resolve, reject) => {
            const data = {
                ShortCode: ShortCode,
                ResponseType: ResponseType,
                ConfirmationURL: ConfirmationURL,
                ValidationURL: ValidationURL
            };
            this.initiate()
                .then(res => {
                    res.post(routes.c2bregister, data)
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

    c2bsimulate(ShortCode, CommandID, Amount, Msisdn, BillRefNumber) {
        return new Promise((resolve, reject) => {
            const data = {
                ShortCode: ShortCode,
                CommandID: CommandID,
                Amount: Amount,
                Msisdn: Msisdn,
                BillRefNumber: BillRefNumber
            };
            this.initiate()
                .then(res => {
                    res.post(routes.c2bsimulate, data)
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

    accountBalance(
        Initiator,
        CommandID,
        PartyA,
        IdentifierType,
        Remarks,
        QueueTimeOutURL,
        ResultURL
    ) {
        return new Promise((resolve, reject) => {
            const data = {
                Initiator: Initiator,
                CommandID: CommandID,
                PartyA: PartyA,
                IdentifierType: IdentifierType,
                Remarks: Remarks,
                QueueTimeOutURL: QueueTimeOutURL,
                ResultURL: ResultURL
            };
            this.initiate()
                .then(res => {
                    res.post(routes.accountbalance, data)
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

    transactionStatus(
        Initiator,
        CommandID,
        TransactionID,
        PartyA,
        IdentifierType,
        ResultURL,
        QueueTimeOutURL,
        Remarks,
        Occasion
    ) {
        return new Promise((resolve, reject) => {
            const data = {
                Initiator: Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: CommandID,
                TransactionID: TransactionID,
                PartyA: PartyA,
                IdentifierType: IdentifierType,
                ResultURL: ResultURL,
                QueueTimeOutURL: QueueTimeOutURL,
                Remarks: Remarks,
                Occasion: Occasion
            };
            this.initiate()
                .then(res => {
                    res.post(routes.transactionstatus, data)
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

    reversal(
        Initiator,
        TransactionID,
        Amount,
        ReceiverParty,
        RecieverIdentifierType,
        ResultURL,
        QueueTimeOutURL,
        Remarks,
        Occasion
    ) {
        return new Promise((resolve, reject) => {
            const data = {
                Initiator: Initiator,
                SecurityCredential: this.securitycredential,
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
            this.initiate()
                .then(res => {
                    res.post(routes.reversal, data)
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

    lipanampesa(
        BusinessShortCode,
        Password,
        Timestamp,
        Amount,
        PartyA,
        PartyB,
        PhoneNumber,
        CallBackURL,
        AccountReference,
        TransactionDesc
    ) {
        return new Promise((resolve, reject) => {
            const data = {
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
            this.initiate()
                .then(res => {
                    res.post(routes.lipanampesa, data)
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

    lipanampesaquery(
        BusinessShortCode,
        Password,
        Timestamp,
        CheckoutRequestID
    ) {
        return new Promise((resolve, reject) => {
            const data = {
                BusinessShortCode: BusinessShortCode,
                Password: Password,
                Timestamp: Timestamp,
                CheckoutRequestID: CheckoutRequestID
            };
            this.initiate()
                .then(res => {
                    res.post(routes.lipanampesaquery, data)
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
