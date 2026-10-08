# Errors

Every error extends `MpesaError`. `ValidationError.issues` is a list of `ValidationIssue`.

| Class             | When                                                                                                                                                                                                                                                   | Useful fields                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `ValidationError` | Invalid input or config. Nothing was sent.                                                                                                                                                                                                             | `issues: { path, message }[]`                              |
| `AuthError`       | The token request failed, usually a wrong consumer key or secret.                                                                                                                                                                                      | `status`, `errorCode`                                      |
| `DarajaApiError`  | Daraja rejected the request, or accepted it with a failure code (a non-zero `ResponseCode`, or Express CheckOut `code`; for Pull Transactions anything but `1000`/`1001`; for M-Pesa Ratiba and Lipa na Bonga a header `responseCode` other than 200). | `status`, `errorCode`, `errorMessage`, `requestId`, `body` |
| `NetworkError`    | No usable response: a network failure, a timeout, or a success response that isn't JSON.                                                                                                                                                               | `cause` (for network failures and timeouts)                |

```ts
try {
  await mpesa.accountBalance.query({
    partyA: 600999,
    resultUrl: 'https://example.com/payments/balance/result',
    queueTimeoutUrl: 'https://example.com/payments/balance/timeout',
  });
} catch (error) {
  if (error instanceof ValidationError) console.error(error.issues);
  else if (error instanceof DarajaApiError) console.error(error.errorCode, error.errorMessage);
  else if (error instanceof AuthError) console.error('Check the consumer key and secret');
  else if (error instanceof NetworkError) console.error('Retry later', error.cause);
  else throw error;
}
```

A rejected token (HTTP 401 or Daraja's invalid-token codes) is refreshed and the request retried once automatically.
