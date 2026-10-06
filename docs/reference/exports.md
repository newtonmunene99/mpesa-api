# Reference

## Exports

| Export                                                                                                                                      | Kind     | Description                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `createMpesa`                                                                                                                               | function | Creates a client (`Mpesa`) from an `MpesaConfig`.                      |
| `MemoryTokenStore`                                                                                                                          | class    | The default in-memory `TokenStore`.                                    |
| `parseStkCallback`, `parseResult`, `parseC2BNotification`, `parseBalances`                                                                  | function | [Callback](/guide/callbacks) parsers.                                  |
| `c2bValidationResponse`                                                                                                                     | object   | Builds C2B validation replies.                                         |
| `MpesaError`, `ValidationError`, `AuthError`, `DarajaApiError`, `NetworkError`                                                              | class    | [Errors](/guide/errors).                                               |
| `Mpesa`, `MpesaConfig`, `Environment`, `Initiator`                                                                                          | type     | The client, its [configuration](/guide/configuration) and credentials. |
| `TokenStore`, `CachedToken`                                                                                                                 | type     | The [token store](/guide/token-store) interface and its value.         |
| `StkPushApi`, `StkPushInput`, `StkPushResponse`, `StkQueryInput`, `StkQueryResponse`                                                        | type     | [M-Pesa Express](/apis/stk-push).                                      |
| `C2BApi`, `C2BRegisterInput`, `C2BSimulateInput`, `C2BResponse`                                                                             | type     | [C2B](/apis/c2b).                                                      |
| `B2CApi`, `B2CInput`, `B2CCommand`                                                                                                          | type     | [B2C](/apis/b2c); `B2CCommand` is the `commandId` union.               |
| `TransactionStatusApi`, `TransactionStatusInput`                                                                                            | type     | [Transaction Status](/apis/transaction-status).                        |
| `AccountBalanceApi`, `AccountBalanceInput`                                                                                                  | type     | [Account Balance](/apis/account-balance).                              |
| `ReversalApi`, `ReversalInput`                                                                                                              | type     | [Reversal](/apis/reversal).                                            |
| `InitiatorResponse`                                                                                                                         | type     | The acknowledgement from the four initiator APIs.                      |
| `IdentifierType`                                                                                                                            | type     | `'shortcode' \| 'till' \| 'msisdn'`, for `identifierType`.             |
| `StkCallback`, `StkCallbackMetadata`, `DarajaResult`, `C2BNotification`, `AccountBalanceEntry`, `C2BValidationResponse`, `C2BRejectionCode` | type     | Callback parser results and the validation reply.                      |
| `ValidationIssue`                                                                                                                           | type     | One entry of `ValidationError.issues`: `{ path, message }`.            |

## Responses

Every call returns camelCase fields plus `raw`, Daraja's unmodified response body.

| Call                                                                             | Returns (type)                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `stkPush.send`                                                                   | `StkPushResponse`: `merchantRequestId`, `checkoutRequestId`, `responseCode`, `responseDescription`, `customerMessage`           |
| `stkPush.query`                                                                  | `StkQueryResponse`: `merchantRequestId`, `checkoutRequestId`, `responseCode`, `responseDescription`, `resultCode`, `resultDesc` |
| `c2b.registerUrls`, `c2b.simulate`                                               | `C2BResponse`: `originatorConversationId`, `responseCode`, `responseDescription`                                                |
| `b2c.pay`, `transactionStatus.query`, `accountBalance.query`, `reversal.request` | `InitiatorResponse`: `conversationId`, `originatorConversationId`, `responseCode`, `responseDescription`                        |
