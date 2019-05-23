import { b2cinterface, c2bregisterinterface, c2bsimulateinterface, accountbalanceinterface, stkpushinterface, reversalinterface, credentialsinterface, stkqueryinterface } from "./helpers/interfaces";
export declare class Mpesa {
    private baseURL;
    private environment;
    private client_key;
    private client_secret;
    private securitycredential;
    constructor(credentials: credentialsinterface, environment: "production" | "sandbox");
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
    c2bRegister(data: c2bregisterinterface): Promise<any>;
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
    c2bSimulate(data: c2bsimulateinterface): Promise<any>;
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
     * @returns {Promise}
     */
    b2c(data: b2cinterface): Promise<any>;
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
    lipaNaMpesaOnline(data: stkpushinterface): Promise<any>;
    /**
     * Lipa na Mpesa Online
     * @name StkQuery
     * @function
     * @description Lipa na M-Pesa Online Query is used to check for Payment status.
     * @see {@link https://developer.safaricom.co.ke/docs?javascript#lipa-na-m-pesa-online-query-request }
     * @param  {string} BusinessShortCode The organization shortcode used to receive the transaction.
     * @param  {number} CheckoutRequestID Check out Request ID.
     * @param {any} passKey Lipa Na Mpesa Pass Key
     * @returns {Promise}
     */
    lipaNaMpesaQuery(data: stkqueryinterface): Promise<any>;
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
     * @param  {number} RecieverIdentifierType         Type of organization receiving the transaction
     * @param  {string} ResultURL                         The path that stores information of transaction
     * @param  {String} Remarks             Comments that are sent along with the transaction.
     * @param  {String} Occasion          Optional Parameter
     * @return {Promise} Promise
     */
    reversal(data: reversalinterface): Promise<any>;
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
    accountBalance(data: accountbalanceinterface): Promise<any>;
    private authenticate;
    private generateSecurityCredential;
}
