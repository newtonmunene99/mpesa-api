import { expectTypeOf, test } from 'vite-plus/test';
import {
  c2bValidationResponse,
  parseBalances,
  parseC2BNotification,
  parseResult,
  parseStkCallback,
} from '../src/index';
import type {
  AccountBalanceApi,
  AccountBalanceEntry,
  AccountBalanceInput,
  B2BApi,
  B2BBuyGoodsInput,
  B2BPayBillInput,
  B2BTaxInput,
  B2BTopUpInput,
  B2CApi,
  B2CCommand,
  B2CInput,
  B2CPochiInput,
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
  IdentifierType,
  Initiator,
  InitiatorResponse,
  Mpesa,
  MpesaConfig,
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
