import { expectTypeOf, test } from 'vite-plus/test';
import {
  billManagerPaymentResponse,
  c2bValidationResponse,
  parseBalances,
  parseBillManagerPayment,
  parseC2BNotification,
  parseExpressCheckoutCallback,
  parseRatibaCallback,
  parseResult,
  parseStkCallback,
} from '../src/index';
import type {
  AccountBalanceApi,
  AccountBalanceEntry,
  AccountBalanceInput,
  B2BApi,
  B2BBuyGoodsInput,
  B2BExpressCheckoutInput,
  B2BExpressCheckoutResponse,
  B2BPayBillInput,
  B2BTaxInput,
  B2BTopUpInput,
  BongaApi,
  BongaCalculateInput,
  BongaCalculateResponse,
  BongaRedeemInput,
  BongaRedeemResponse,
  B2CApi,
  B2CCommand,
  B2CInput,
  B2CPochiInput,
  BillManagerAcknowledgement,
  BillManagerApi,
  BillManagerCancelResponse,
  BillManagerInvoice,
  BillManagerInvoiceItem,
  BillManagerOptInInput,
  BillManagerOptInResponse,
  BillManagerPayment,
  BillManagerResponse,
  C2BApi,
  C2BNotification,
  C2BRejectionCode,
  C2BRegisterInput,
  C2BResponse,
  C2BSimulateInput,
  C2BValidationResponse,
  CachedToken,
  DarajaResult,
  Environment,
  ExpressCheckoutCallback,
  IdentifierType,
  Initiator,
  InitiatorResponse,
  Mpesa,
  MpesaConfig,
  PullQueryInput,
  PullQueryResponse,
  PullRegisterInput,
  PullRegisterResponse,
  PullTransaction,
  PullTransactionsApi,
  QrApi,
  QrInput,
  QrResponse,
  QrType,
  RatibaApi,
  RatibaCallback,
  RatibaFrequency,
  RatibaResponse,
  RatibaStandingOrderInput,
  ReversalApi,
  ReversalInput,
  StkCallback,
  StkCallbackMetadata,
  StkPushApi,
  StkPushInput,
  StkPushResponse,
  StkQueryInput,
  StkQueryResponse,
  TokenStore,
  TransactionStatusApi,
  TransactionStatusInput,
  ValidationIssue,
} from '../src/index';

// Compile-time check: removing any public type export breaks `vp check` and this file.
test('public types stay exported and wired to the client', () => {
  expectTypeOf<Mpesa['stkPush']>().toEqualTypeOf<StkPushApi>();
  expectTypeOf<Mpesa['c2b']>().toEqualTypeOf<C2BApi>();
  expectTypeOf<Mpesa['b2c']>().toEqualTypeOf<B2CApi>();
  expectTypeOf<Mpesa['b2b']>().toEqualTypeOf<B2BApi>();
  expectTypeOf<Mpesa['transactionStatus']>().toEqualTypeOf<TransactionStatusApi>();
  expectTypeOf<Mpesa['accountBalance']>().toEqualTypeOf<AccountBalanceApi>();
  expectTypeOf<Mpesa['reversal']>().toEqualTypeOf<ReversalApi>();
  expectTypeOf<Mpesa['qr']>().toEqualTypeOf<QrApi>();
  expectTypeOf<Mpesa['pullTransactions']>().toEqualTypeOf<PullTransactionsApi>();
  expectTypeOf<Mpesa['ratiba']>().toEqualTypeOf<RatibaApi>();
  expectTypeOf<Mpesa['bonga']>().toEqualTypeOf<BongaApi>();
  expectTypeOf<Mpesa['billManager']>().toEqualTypeOf<BillManagerApi>();
  expectTypeOf<MpesaConfig['billManager']>().toEqualTypeOf<{ appKey: string } | undefined>();
  expectTypeOf<BillManagerApi['optIn']>().parameters.toEqualTypeOf<[BillManagerOptInInput]>();
  expectTypeOf<
    BillManagerApi['optIn']
  >().returns.resolves.toEqualTypeOf<BillManagerOptInResponse>();
  expectTypeOf<BillManagerApi['sendInvoice']>().parameters.toEqualTypeOf<[BillManagerInvoice]>();
  expectTypeOf<BillManagerApi['sendInvoices']>().parameters.toEqualTypeOf<[BillManagerInvoice[]]>();
  expectTypeOf<
    BillManagerApi['sendInvoice']
  >().returns.resolves.toEqualTypeOf<BillManagerResponse>();
  expectTypeOf<BillManagerInvoice['invoiceItems']>().toEqualTypeOf<
    BillManagerInvoiceItem[] | undefined
  >();
  expectTypeOf<
    BillManagerApi['cancelInvoices']
  >().returns.resolves.toEqualTypeOf<BillManagerCancelResponse>();
  expectTypeOf<BillManagerApi['acknowledgePayment']>().parameters.toEqualTypeOf<
    [BillManagerAcknowledgement]
  >();
  expectTypeOf(parseBillManagerPayment).returns.toEqualTypeOf<BillManagerPayment>();
  expectTypeOf(billManagerPaymentResponse).toEqualTypeOf<{
    readonly resmsg: 'Success';
    readonly rescode: '200';
  }>();
  expectTypeOf<RatibaApi['createStandingOrder']>().parameters.toEqualTypeOf<
    [RatibaStandingOrderInput]
  >();
  expectTypeOf<RatibaApi['createStandingOrder']>().returns.resolves.toEqualTypeOf<RatibaResponse>();
  expectTypeOf<RatibaStandingOrderInput['frequency']>().toEqualTypeOf<RatibaFrequency>();
  expectTypeOf(parseRatibaCallback).returns.toEqualTypeOf<RatibaCallback>();
  expectTypeOf<BongaApi['calculatePoints']>().parameters.toEqualTypeOf<[BongaCalculateInput]>();
  expectTypeOf<
    BongaApi['calculatePoints']
  >().returns.resolves.toEqualTypeOf<BongaCalculateResponse>();
  expectTypeOf<BongaApi['redeem']>().parameters.toEqualTypeOf<[BongaRedeemInput]>();
  expectTypeOf<BongaApi['redeem']>().returns.resolves.toEqualTypeOf<BongaRedeemResponse>();
  expectTypeOf<QrApi['generate']>().parameters.toEqualTypeOf<[QrInput]>();
  expectTypeOf<QrApi['generate']>().returns.resolves.toEqualTypeOf<QrResponse>();
  expectTypeOf<QrInput['type']>().toEqualTypeOf<QrType>();
  expectTypeOf<B2BApi['expressCheckout']>().parameters.toEqualTypeOf<[B2BExpressCheckoutInput]>();
  expectTypeOf<
    B2BApi['expressCheckout']
  >().returns.resolves.toEqualTypeOf<B2BExpressCheckoutResponse>();
  expectTypeOf(parseExpressCheckoutCallback).returns.toEqualTypeOf<ExpressCheckoutCallback>();
  expectTypeOf<PullTransactionsApi['register']>().parameters.toEqualTypeOf<[PullRegisterInput]>();
  expectTypeOf<
    PullTransactionsApi['register']
  >().returns.resolves.toEqualTypeOf<PullRegisterResponse>();
  expectTypeOf<PullTransactionsApi['query']>().parameters.toEqualTypeOf<[PullQueryInput]>();
  expectTypeOf<PullTransactionsApi['query']>().returns.resolves.toEqualTypeOf<PullQueryResponse>();
  expectTypeOf<PullTransactionsApi['all']>().parameters.toEqualTypeOf<
    [Omit<PullQueryInput, 'offset'>]
  >();
  expectTypeOf<PullTransactionsApi['all']>().returns.toEqualTypeOf<
    AsyncIterable<PullTransaction>
  >();
  expectTypeOf<StkPushApi['send']>().parameters.toEqualTypeOf<[StkPushInput]>();
  expectTypeOf<StkPushApi['send']>().returns.resolves.toEqualTypeOf<StkPushResponse>();
  expectTypeOf<StkPushApi['query']>().parameters.toEqualTypeOf<[StkQueryInput]>();
  expectTypeOf<StkPushApi['query']>().returns.resolves.toEqualTypeOf<StkQueryResponse>();
  expectTypeOf<C2BApi['registerUrls']>().parameters.toEqualTypeOf<[C2BRegisterInput]>();
  expectTypeOf<C2BApi['simulate']>().parameters.toEqualTypeOf<[C2BSimulateInput]>();
  expectTypeOf<C2BApi['simulate']>().returns.resolves.toEqualTypeOf<C2BResponse>();
  expectTypeOf<B2CApi['pay']>().parameters.toEqualTypeOf<[B2CInput]>();
  expectTypeOf<B2CApi['pay']>().returns.resolves.toEqualTypeOf<InitiatorResponse>();
  expectTypeOf<B2CInput['commandId']>().toEqualTypeOf<B2CCommand>();
  expectTypeOf<B2CApi['payToPochi']>().parameters.toEqualTypeOf<[B2CPochiInput]>();
  expectTypeOf<B2CApi['payToPochi']>().returns.resolves.toEqualTypeOf<InitiatorResponse>();
  expectTypeOf<B2BApi['payBill']>().parameters.toEqualTypeOf<[B2BPayBillInput]>();
  expectTypeOf<B2BApi['buyGoods']>().parameters.toEqualTypeOf<[B2BBuyGoodsInput]>();
  expectTypeOf<B2BApi['topUpB2C']>().parameters.toEqualTypeOf<[B2BTopUpInput]>();
  expectTypeOf<B2BApi['remitTax']>().parameters.toEqualTypeOf<[B2BTaxInput]>();
  expectTypeOf<B2BApi['payBill']>().returns.resolves.toEqualTypeOf<InitiatorResponse>();
  expectTypeOf<B2BApi['buyGoods']>().returns.resolves.toEqualTypeOf<InitiatorResponse>();
  expectTypeOf<B2BApi['topUpB2C']>().returns.resolves.toEqualTypeOf<InitiatorResponse>();
  expectTypeOf<B2BApi['remitTax']>().returns.resolves.toEqualTypeOf<InitiatorResponse>();
  expectTypeOf<TransactionStatusApi['query']>().parameters.toEqualTypeOf<
    [TransactionStatusInput]
  >();
  expectTypeOf<AccountBalanceApi['query']>().parameters.toEqualTypeOf<[AccountBalanceInput]>();
  expectTypeOf<ReversalApi['request']>().parameters.toEqualTypeOf<[ReversalInput]>();
  expectTypeOf<AccountBalanceInput['identifierType']>().toEqualTypeOf<IdentifierType | undefined>();
  expectTypeOf<MpesaConfig['environment']>().toEqualTypeOf<Environment>();
  expectTypeOf<MpesaConfig['initiator']>().toEqualTypeOf<Initiator | undefined>();
  expectTypeOf<MpesaConfig['tokenStore']>().toEqualTypeOf<TokenStore | undefined>();
  expectTypeOf<Awaited<ReturnType<TokenStore['get']>>>().toEqualTypeOf<CachedToken | undefined>();
  expectTypeOf(parseStkCallback).returns.toEqualTypeOf<StkCallback>();
  expectTypeOf<StkCallback['metadata']>().toEqualTypeOf<StkCallbackMetadata | undefined>();
  expectTypeOf(parseResult).returns.toEqualTypeOf<DarajaResult>();
  expectTypeOf(parseBalances).returns.toEqualTypeOf<AccountBalanceEntry[]>();
  expectTypeOf(parseC2BNotification).returns.toEqualTypeOf<C2BNotification>();
  expectTypeOf(c2bValidationResponse.reject).parameters.toEqualTypeOf<[C2BRejectionCode]>();
  expectTypeOf(c2bValidationResponse.accept).returns.toEqualTypeOf<C2BValidationResponse>();
  expectTypeOf<ValidationIssue>().toEqualTypeOf<{ path: string; message: string }>();
});
