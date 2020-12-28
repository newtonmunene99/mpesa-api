import { Buffer } from 'buffer';
import { RSA_PKCS1_PADDING } from 'constants';
import { publicEncrypt } from 'crypto';
import { promises } from 'fs';
import { resolve } from 'path';
import {
  AccountBalanceInterface,
  AccountBalanceResponseInterface,
  AuthorizeResponseInterface,
  B2CInterface,
  B2CResponseInterface,
  C2BRegisterInterface,
  C2BRegisterResponseInterface,
  C2BSimulateInterface,
  C2BSimulateResponseInterface,
  CredentialsInterface,
  ReversalInterface,
  ReversalResponseInterface,
  StkPushInterface,
  StkPushResponseInterface,
  StkQueryInterface,
  StkQueryResponseInterface,
  TransactionStatusInterface,
  TransactionStatusResponseInterface,
} from './models/interfaces';
import { routes } from './routes';
import { HttpService } from './services/http.service';

export class Mpesa {
  private http: HttpService;
  private environment: string;
  private clientKey: string;
  private clientSecret: string;
  private securityCredential: string;

  constructor(
    {
      clientKey,
      clientSecret,
      securityCredential,
      initiatorPassword,
      certificatePath,
    }: CredentialsInterface,
    environment: 'production' | 'sandbox',
  ) {
    this.clientKey = clientKey;
    this.clientSecret = clientSecret;

    this.http = new HttpService({
      baseURL:
        environment === 'production' ? routes.production : routes.sandbox,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!securityCredential && !initiatorPassword) {
      throw new Error(
        'You must provide either the security credential or initiator password. Both cannot be null',
      );
    }

    if (!securityCredential) {
      this.generateSecurityCredential(initiatorPassword, certificatePath);
    } else {
      this.securityCredential = securityCredential;
    }
  }

  private async authenticate(): Promise<string> {
    const response = await this.http.get<AuthorizeResponseInterface>(
      routes.oauth,
      {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(this.clientKey + ':' + this.clientSecret).toString(
              'base64',
            ),
        },
      },
    );

    return response.data.access_token;
  }

  private async generateSecurityCredential(
    password: string,
    certificatePath: string,
  ) {
    let certificate: string;

    if (certificatePath != null) {
      const certificateBuffer = await promises.readFile(certificatePath);

      certificate = String(certificateBuffer);
    } else {
      const certificateBuffer = await promises.readFile(
        resolve(
          __dirname,
          this.environment === 'production'
            ? 'keys/production-cert.cer'
            : 'keys/sandbox-cert.cer',
        ),
      );

      certificate = String(certificateBuffer);
    }

    this.securityCredential = publicEncrypt(
      {
        key: certificate,
        padding: RSA_PKCS1_PADDING,
      },
      Buffer.from(password),
    ).toString('base64');
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
  public async c2bRegister({
    ShortCode,
    ResponseType,
    ConfirmationURL,
    ValidationURL,
  }: C2BRegisterInterface): Promise<C2BRegisterResponseInterface> {
    const token = await this.authenticate();

    const response = await this.http.post<C2BRegisterResponseInterface>(
      routes.c2bregister,
      { ShortCode, ResponseType, ConfirmationURL, ValidationURL },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async c2bSimulate({
    ShortCode,
    CommandID,
    Amount,
    Msisdn,
    BillRefNumber,
  }: C2BSimulateInterface): Promise<C2BSimulateResponseInterface> {
    const token = await this.authenticate();

    const response = await this.http.post<C2BSimulateResponseInterface>(
      routes.c2bsimulate,
      {
        ShortCode,
        CommandID,
        Amount,
        Msisdn,
        BillRefNumber: BillRefNumber ?? 'account',
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async transactionStatus({
    Initiator,
    CommandID,
    TransactionID,
    PartyA,
    IdentifierType,
    ResultURL,
    QueueTimeOutURL,
    Remarks,
    Occasion,
  }: TransactionStatusInterface): Promise<TransactionStatusResponseInterface> {
    const token = await this.authenticate();

    const response = await this.http.post<TransactionStatusResponseInterface>(
      routes.transactionstatus,
      {
        Initiator,
        SecurityCredential: this.securityCredential,
        CommandID: CommandID ?? 'TransactionStatusQuery',
        TransactionID,
        PartyA,
        IdentifierType,
        ResultURL,
        QueueTimeOutURL,
        Remarks: Remarks ?? 'Transaction Status',
        Occasion: Occasion ?? 'TransactionStatus',
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async b2c({
    Initiator,
    CommandID,
    Amount,
    PartyA,
    PartyB,
    Remarks,
    QueueTimeOutURL,
    ResultURL,
    Occasion,
  }: B2CInterface): Promise<B2CResponseInterface> {
    const token = await this.authenticate();

    const response = await this.http.post<B2CResponseInterface>(
      routes.b2c,
      {
        InitiatorName: Initiator,
        SecurityCredential: this.securityCredential,
        CommandID: CommandID,
        Amount: Amount,
        PartyA: PartyA,
        PartyB: PartyB,
        Remarks: Remarks ?? 'account',
        QueueTimeOutURL: QueueTimeOutURL,
        ResultURL: ResultURL,
        Occasion: Occasion ?? 'account',
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async lipaNaMpesaOnline({
    BusinessShortCode,
    passKey,
    TransactionDesc,
    TransactionType,
    PartyA,
    PartyB,
    Amount,
    AccountReference,
    CallBackURL,
    PhoneNumber,
  }: StkPushInterface): Promise<StkPushResponseInterface> {
    const Timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, -3);

    const Password = Buffer.from(
      BusinessShortCode + passKey + Timestamp,
    ).toString('base64');

    const token = await this.authenticate();

    const response = await this.http.post<StkPushResponseInterface>(
      routes.stkpush,
      {
        BusinessShortCode,
        Password,
        Timestamp,
        TransactionType: TransactionType ?? 'CustomerPayBillOnline ',
        Amount,
        PartyA,
        PartyB,
        PhoneNumber,
        CallBackURL,
        AccountReference,
        TransactionDesc: TransactionDesc ?? 'Lipa Na Mpesa Online',
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async lipaNaMpesaQuery({
    BusinessShortCode,
    passKey,
    CheckoutRequestID,
  }: StkQueryInterface): Promise<StkQueryResponseInterface> {
    const Timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, -3);

    const Password = Buffer.from(
      BusinessShortCode + passKey + Timestamp,
    ).toString('base64');

    const token = await this.authenticate();

    const response = await this.http.post<StkQueryResponseInterface>(
      routes.stkquery,
      {
        BusinessShortCode,
        Password,
        Timestamp,
        CheckoutRequestID,
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async reversal({
    Initiator,
    CommandID,
    TransactionID,
    Amount,
    ReceiverParty,
    RecieverIdentifierType,
    ResultURL,
    QueueTimeOutURL,
    Remarks,
    Occasion,
  }: ReversalInterface): Promise<ReversalResponseInterface> {
    const token = await this.authenticate();

    const response = await this.http.post<ReversalResponseInterface>(
      routes.reversal,
      {
        Initiator,
        SecurityCredential: this.securityCredential,
        CommandID: CommandID ?? 'TransactionReversal',
        TransactionID,
        Amount,
        ReceiverParty,
        RecieverIdentifierType: RecieverIdentifierType ?? '4',
        ResultURL,
        QueueTimeOutURL,
        Remarks: Remarks ?? 'Transaction Reversal',
        Occasion: Occasion ?? 'TransactionReversal',
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
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
  public async accountBalance({
    Initiator,
    CommandID,
    PartyA,
    IdentifierType,
    Remarks,
    QueueTimeOutURL,
    ResultURL,
  }: AccountBalanceInterface): Promise<AccountBalanceResponseInterface> {
    const token = await this.authenticate();

    const response = await this.http.post<AccountBalanceResponseInterface>(
      routes.accountbalance,
      {
        Initiator,
        SecurityCredential: this.securityCredential,
        CommandID: CommandID ?? 'AccountBalance',
        PartyA,
        IdentifierType: IdentifierType ?? '4',
        Remarks: Remarks ?? 'Account Balance',
        QueueTimeOutURL,
        ResultURL,
      },
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    return response.data;
  }
}
