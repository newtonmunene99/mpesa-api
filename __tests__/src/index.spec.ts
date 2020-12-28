import { Mpesa } from '../../src/index';
import {
  AccountBalanceInterface,
  B2CInterface,
  C2BRegisterInterface,
  ReversalInterface,
  StkPushInterface,
  StkQueryInterface,
  TransactionStatusInterface,
} from 'models/interfaces';
import {
  anyNumber,
  anyString,
  capture,
  objectContaining,
  reset,
  spy,
  when,
} from 'ts-mockito';
import {
  Initiator,
  ClientKey,
  ClientSecret,
  InitiatorPassword,
  PhoneNumber,
  ShortCode,
  AccountReference,
  PassKey,
  CallBackURL,
} from './values';

describe('Mpesa', () => {
  let mpesa: Mpesa;
  let spiedMpesa: Mpesa;
  let lnmCheckoutRequestId: string;

  beforeAll(() => {
    mpesa = new Mpesa(
      {
        clientKey: ClientKey,
        clientSecret: ClientSecret,
        initiatorPassword: InitiatorPassword,
        certificatePath: null,
      },
      'sandbox',
    );

    spiedMpesa = spy(mpesa);
  });

  describe('Lipa Na Mpesa Online', () => {
    test('should pass with correct parameters', async () => {
      const input: StkPushInterface = {
        BusinessShortCode: ShortCode,
        Amount: 1,
        PartyA: PhoneNumber,
        PartyB: ShortCode.toString(),
        PhoneNumber: PhoneNumber,
        AccountReference: AccountReference,
        passKey: PassKey,
        TransactionType: 'CustomerBuyGoodsOnline',
        TransactionDesc: 'Sending Money',
        CallBackURL: CallBackURL,
      };

      when(
        spiedMpesa.lipaNaMpesaOnline({
          BusinessShortCode: anyNumber(),
          Amount: anyNumber(),
          PartyA: anyString(),
          PartyB: anyString(),
          PhoneNumber: anyString(),
          AccountReference: anyString(),
          passKey: anyString(),
          TransactionType: anyString(),
          TransactionDesc: anyString(),
          CallBackURL: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.lipaNaMpesaOnline(input);

      const [inputData] = capture(spiedMpesa.lipaNaMpesaOnline).last();

      expect(inputData).toMatchObject<StkPushInterface>(input);

      expect(data).toHaveProperty('ResponseCode');

      lnmCheckoutRequestId = data.CheckoutRequestID;
    });
  });

  describe('Lipa Na Mpesa Online Query', () => {
    test('should pass with correct parameters', async () => {
      const input: StkQueryInterface = {
        BusinessShortCode: ShortCode,
        passKey: PassKey,
        CheckoutRequestID: lnmCheckoutRequestId,
      };

      when(
        spiedMpesa.lipaNaMpesaQuery({
          BusinessShortCode: anyNumber(),
          passKey: anyString(),
          CheckoutRequestID: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.lipaNaMpesaQuery(input);

      const [inputData] = capture(spiedMpesa.lipaNaMpesaQuery).last();

      expect(inputData).toMatchObject<StkQueryInterface>(input);

      expect(data).toHaveProperty('ResponseCode');
    });
  });

  describe('B2C', () => {
    test('should pass with correct parameters', async () => {
      const input: B2CInterface = {
        Initiator: Initiator,
        Amount: 1,
        PartyA: ShortCode.toString(),
        PartyB: PhoneNumber,
        CommandID: 'BusinessPayment',
        QueueTimeOutURL: CallBackURL,
        ResultURL: CallBackURL,
      };

      when(
        spiedMpesa.b2c({
          Initiator: anyNumber(),
          Amount: anyNumber(),
          PartyA: anyString(),
          PartyB: anyString(),
          CommandID: anyString(),
          QueueTimeOutURL: anyString(),
          ResultURL: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.b2c(input);

      const [inputData] = capture(spiedMpesa.b2c).last();

      expect(inputData).toMatchObject<B2CInterface>(input);

      expect(data).toHaveProperty('ResponseCode');
    });
  });

  describe('Account Balance', () => {
    test('should pass with correct parameters', async () => {
      const input: AccountBalanceInterface = {
        Initiator: Initiator,
        PartyA: ShortCode.toString(),
        IdentifierType: '4',
        CommandID: 'AccountBalance',
        QueueTimeOutURL: CallBackURL,
        ResultURL: CallBackURL,
      };

      when(
        spiedMpesa.accountBalance({
          Initiator: anyNumber(),
          PartyA: anyString(),
          IdentifierType: anyString(),
          CommandID: anyString(),
          QueueTimeOutURL: anyString(),
          ResultURL: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.accountBalance(input);

      const [inputData] = capture(spiedMpesa.accountBalance).last();

      expect(inputData).toMatchObject<AccountBalanceInterface>(input);

      expect(data).toHaveProperty('ResponseCode');
    });
  });

  describe('Transaction Status', () => {
    test('should pass with correct parameters', async () => {
      const input: TransactionStatusInterface = {
        Initiator: Initiator,
        TransactionID: PhoneNumber,
        PartyA: ShortCode.toString(),
        CommandID: 'TransactionStatusQuery',
        IdentifierType: '1',
        QueueTimeOutURL: CallBackURL,
        ResultURL: CallBackURL,
      };

      when(
        spiedMpesa.transactionStatus({
          Initiator: anyNumber(),
          TransactionID: anyString(),
          PartyA: anyString(),
          CommandID: anyString(),
          IdentifierType: anyString(),
          QueueTimeOutURL: anyString(),
          ResultURL: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.transactionStatus(input);

      const [inputData] = capture(spiedMpesa.transactionStatus).last();

      expect(inputData).toMatchObject<TransactionStatusInterface>(input);

      expect(data).toHaveProperty('ResponseCode');
    });
  });

  describe('Reversal', () => {
    test('should pass with correct parameters', async () => {
      const input: ReversalInterface = {
        Initiator: Initiator,
        TransactionID: PhoneNumber,
        CommandID: 'TransactionReversal',
        Amount: 1,
        ReceiverParty: ShortCode.toString(),
        RecieverIdentifierType: '4',
        QueueTimeOutURL: CallBackURL,
        ResultURL: CallBackURL,
      };

      when(
        spiedMpesa.reversal({
          Initiator: anyNumber(),
          TransactionID: anyString(),
          CommandID: anyString(),
          Amount: 1,
          ReceiverParty: ShortCode.toString(),
          RecieverIdentifierType: anyString(),
          QueueTimeOutURL: anyString(),
          ResultURL: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.reversal(input);

      const [inputData] = capture(spiedMpesa.reversal).last();

      expect(inputData).toMatchObject<ReversalInterface>(input);

      expect(data).toHaveProperty('ResponseCode');
    });
  });

  describe('C2B Register', () => {
    test('should pass with correct parameters', async () => {
      const input: C2BRegisterInterface = {
        ShortCode: ShortCode,
        ResponseType: 'Cancelled',
        ConfirmationURL: CallBackURL,
        ValidationURL: CallBackURL,
      };

      when(
        spiedMpesa.c2bRegister({
          ShortCode: anyNumber(),
          ResponseType: anyString(),
          ConfirmationURL: anyString(),
          ValidationURL: anyString(),
        }),
      ).thenResolve(
        objectContaining({
          ResponseCode: '0',
        }),
      );

      const data = await mpesa.c2bRegister(input);

      const [inputData] = capture(spiedMpesa.c2bRegister).last();

      expect(inputData).toMatchObject<C2BRegisterInterface>(input);

      expect(data).toHaveProperty('ResponseCode');
    });
  });

  afterAll(() => {
    reset(Mpesa);
  });
});
