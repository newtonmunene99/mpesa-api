# Configuration

| Field            | Type                        | Description                                                                                                                                                                      |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment`    | `'sandbox' \| 'production'` | Required. Selects `sandbox.safaricom.co.ke` or `api.safaricom.co.ke`.                                                                                                            |
| `consumerKey`    | `string`                    | Required. From your Daraja app.                                                                                                                                                  |
| `consumerSecret` | `string`                    | Required. From your Daraja app.                                                                                                                                                  |
| `passkey`        | `string`                    | The Lipa na M-Pesa Online passkey. Required for `stkPush`.                                                                                                                       |
| `initiator`      | `Initiator`                 | The API operator. Required for B2C, B2B (except Express CheckOut), Business To Pochi, Transaction Status, Account Balance and Reversal. See [Certificates](/guide/certificates). |
| `tokenStore`     | `TokenStore`                | Where access tokens are cached. Defaults to memory. See [Token store](/guide/token-store).                                                                                       |
| `timeoutMs`      | `number`                    | Per-request timeout. Defaults to 30 000.                                                                                                                                         |
| `fetch`          | `typeof fetch`              | The fetch implementation. Defaults to the global `fetch`.                                                                                                                        |
| `onWarning`      | `(message: string) => void` | Receives non-fatal warnings, such as an expired certificate.                                                                                                                     |
| `billManager`    | `{ appKey: string }`        | Optional. The key `billManager.optIn` returns, sent as the `appKey` header on every other Bill Manager call. See [Bill Manager](/apis/bill-manager#the-app-key).                 |

`createMpesa` validates the configuration and throws a `ValidationError` listing every problem.
