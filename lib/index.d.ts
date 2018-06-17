export declare class mpesa {
    /**
     * Safaricom Mpesa API
     * @name mpesa-api
     * @function
     * @description Use this API to simplify Mpesa Transactions.
     * @see {@link https://developer.safaricom.co.ke/apis }
     * @param  {object} credentials An Object containing key,secret,securitycredential and certificatepath as the properties.
     * @param  {string} environment A string. Either production or sandbox. Case Sensitive.
     */
    key: string;
    secret: string;
    securitycredential: any;
    certificatepath: any;
    environment: string;
    constructor(credentials: any, environment: any);
    secure(): void;
    initiate(): Promise<{}>;
    /**
     * Business to Customer(B2C)
     * @name B2C
     * @function
     * @description This API enables Business to Customer (B2C) transactions between a company and customers who are the end-users of its products or services. Use of this API requires a valid and verified B2C M-Pesa Short code.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2c-api }
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
    b2c(InitiatorName: any, CommandID: any, Amount: any, PartyA: any, PartyB: any, Remarks: any, QueueTimeOutURL: any, ResultURL: any, Occasion: any): Promise<{}>;
    /**
     * Business to Business(B2B)
     * @name B2B
     * @function
     * @description This API enables Business to Business (B2B) transactions between a business and another business. Use of this API requires a valid and verified B2B M-Pesa short code for the business initiating the transaction and the both businesses involved in the transaction.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#b2b-api }
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
     * @returns {Promise}
     */
    b2b(InitiatorName: any, CommandID: any, SenderIdentifierType: any, RecieverIdentifierType: any, Amount: any, PartyA: any, PartyB: any, AccountReference: any, Remarks: any, QueueTimeOutURL: any, ResultURL: any): Promise<{}>;
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
    c2bregister(ShortCode: any, ResponseType: any, ConfirmationURL: any, ValidationURL: any): Promise<{}>;
    /**
     * C2B Simulate
     * @name C2BSimulate
     * @function
     * @description C2B Simulate
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#c2b-api }
     * @param  {string} CommandID Unique command for each transaction type.
     * @param  {string} Amount The amount been transacted.
     * @param  {string} Msisdn MSISDN (phone number) sending the transaction, start with country code without the plus(+) sign.
     * @param  {string} BillRefNumber Bill Reference Number (Optional).
     * @param  {string} ShortCode 6 digit M-Pesa Till Number or PayBill Number
     * @returns {Promise}
     */
    c2bsimulate(ShortCode: any, CommandID: any, Amount: any, Msisdn: any, BillRefNumber: any): Promise<{}>;
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
    accountBalance(Initiator: any, CommandID: any, PartyA: any, IdentifierType: any, Remarks: any, QueueTimeOutURL: any, ResultURL: any): Promise<{}>;
    transactionStatus(Initiator: any, CommandID: any, TransactionID: any, PartyA: any, IdentifierType: any, ResultURL: any, QueueTimeOutURL: any, Remarks: any, Occasion: any): Promise<{}>;
    reversal(Initiator: any, TransactionID: any, Amount: any, ReceiverParty: any, RecieverIdentifierType: any, ResultURL: any, QueueTimeOutURL: any, Remarks: any, Occasion: any): Promise<{}>;
    /**
     * Lipa na Mpesa Online
     * @name Stkpush
     * @function
     * @description Lipa na M-Pesa Online Payment API is used to initiate a M-Pesa transaction on behalf of a customer using STK Push. This is the same technique mySafaricom App uses whenever the app is used to make payments.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-payment }
     * @param  {string} BusinessShortCode The organization shortcode used to receive the transaction.
     * @param  {string} Password The password for encrypting the request. This is generated by base64 encoding BusinessShortcode, Passkey and Timestamp.
     * @param  {string} Timestamp The timestamp of the transaction in the format yyyymmddhhiiss.
     * @param  {string} Amount The amount to be transacted.
     * @param  {string} PartyA The MSISDN sending the funds.
     * @param  {string} PartyB The organization shortcode receiving the funds
     * @param  {string} PhoneNumber The MSISDN sending the funds.
     * @param  {string} CallBackURL The url to where responses from M-Pesa will be sent to.
     * @param  {string} AccountReference Used with M-Pesa PayBills.
     * @param  {string} TransactionDesc A description of the transaction.
     * @returns {Promise}
     */
    lipanampesa(BusinessShortCode: any, Password: any, Timestamp: any, Amount: any, PartyA: any, PartyB: any, PhoneNumber: any, CallBackURL: any, AccountReference: any, TransactionDesc: any): Promise<{}>;
    /**
     * Lipa na Mpesa Online Query Request
     * @name StkPushQueryRequest
     * @function
     * @description Lipa na M-Pesa Online Payment API is used to initiate a M-Pesa transaction on behalf of a customer using STK Push. This is the same technique mySafaricom App uses whenever the app is used to make payments.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-query-request }
     * @param  {string} BusinessShortCode The organization shortcode used to receive the transaction.
     * @param  {string} Password The password for encrypting the request. This is generated by base64 encoding BusinessShortcode, Passkey and Timestamp.
     * @param  {string} Timestamp The timestamp of the transaction in the format yyyymmddhhiiss.
     * @param  {string} CheckoutRequestID The Checkout Request ID.
     * @returns {Promise}
     */
    lipanampesaquery(BusinessShortCode: any, Password: any, Timestamp: any, CheckoutRequestID: any): Promise<{}>;
}
