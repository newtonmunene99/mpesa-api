# Callbacks

Daraja posts results to the URLs you give it. The parsers take the already-parsed JSON body, validate it, and return typed objects; they throw a `ValidationError` if required fields are missing.

| Parser                       | For                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `parseStkCallback(body)`     | STK push callbacks                                                                    |
| `parseResult(body)`          | B2C, Business To Pochi, B2B, Transaction Status, Account Balance and Reversal results |
| `parseC2BNotification(body)` | C2B validation and confirmation requests                                              |
| `parseBalances(value)`       | The packed `AccountBalance` or `DebitAccountBalance` value                            |
| `c2bValidationResponse`      | Builds the reply to a C2B validation request                                          |

What each parser returns:

- `parseStkCallback` → `StkCallback`: `merchantRequestId`, `checkoutRequestId`, `resultCode`, `resultDesc`, `ok`, `raw`, and `metadata` (`StkCallbackMetadata`: `amountCents`, `mpesaReceiptNumber`, `balanceCents`, `transactionDate` as a `Date`, `phoneNumber`) on success.
- `parseResult` → `DarajaResult`: `resultType`, `resultCode`, `resultDesc`, `ok`, `originatorConversationId`, `conversationId`, `transactionId`, `parameters` (`ResultParameters` flattened by key, with the documented dates converted to `Date`), `referenceData` and `raw`.
- `parseC2BNotification` → `C2BNotification`: `transactionType`, `transId`, `transTime` (a `Date`), `transAmountCents`, `businessShortCode`, `billRefNumber`, `invoiceNumber`, `orgAccountBalanceCents` (absent on validation requests), `thirdPartyTransId`, `msisdn` (masked by Daraja), `firstName`, `middleName`, `lastName` and `raw`.
- `parseBalances` → `AccountBalanceEntry[]`: `account`, `currency`, `availableCents`, `unclearedCents`, `reservedCents`, `unreservedCents`.
- `c2bValidationResponse.accept(thirdPartyTransId?)` and `.reject(code: C2BRejectionCode)` → `C2BValidationResponse`, the JSON body to send back.

`ok` means `resultCode === 0`. Result codes are numbers, except non-numeric ones such as `"R000002"`, which stay strings.

Amounts the parsers read are integer cents, in fields ending in `Cents`: KES 1,540.50 is `154050`. Integers add up exactly, where floating-point shillings would not (`0.1 + 0.2`). Divide by 100 to display them. Amounts you pass in, such as `stkPush.send`'s `amount`, stay in whole shillings, as Daraja requires. `DarajaResult.parameters` keeps Daraja's own values.

With Express:

```ts
app.post('/payments/stk', (req, res) => {
  const callback = parseStkCallback(req.body);
  if (callback.ok) {
    void savePayment(callback.checkoutRequestId, callback.metadata?.mpesaReceiptNumber);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.post('/payments/c2b/validation', (req, res) => {
  const payment = parseC2BNotification(req.body);
  res.json(
    accountExists(payment.billRefNumber)
      ? c2bValidationResponse.accept()
      : c2bValidationResponse.reject('C2B00012'),
  );
});

app.post('/payments/balance/result', (req, res) => {
  const result = parseResult(req.body);
  const packed = result.parameters.AccountBalance;
  if (result.ok && typeof packed === 'string') console.log(parseBalances(packed));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

With Hono or any fetch-based runtime:

```ts
app.post('/payments/b2c/result', async (c) => {
  const result = parseResult(await c.req.json());
  if (!result.ok) console.warn(result.resultCode, result.resultDesc);
  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

Callbacks are unauthenticated POST requests, so treat their contents as untrusted. Confirm important payments with Transaction Status, and restrict the callback routes to [Safaricom's IPs](/guide/callbacks#ip-whitelisting).

C2B validation rejection codes: `C2B00011` invalid MSISDN, `C2B00012` invalid account number, `C2B00013` invalid amount, `C2B00014` invalid KYC details, `C2B00015` invalid shortcode, `C2B00016` other error.

## IP Whitelisting

You might need to whitelist Mpesa IPs listed below on the server/firewall that receives the callbacks.

<details>
  <summary>View List</summary>

- 196.201.214.200
- 196.201.214.206
- 196.201.213.114
- 196.201.214.207
- 196.201.214.208
- 196.201.213.44
- 196.201.212.127
- 196.201.212.128
- 196.201.212.129
- 196.201.212.132
- 196.201.212.136
- 196.201.212.138

</details>
