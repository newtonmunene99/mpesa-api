# Account Balance

```ts
await mpesa.accountBalance.query({
  partyA: 600999,
  resultUrl: 'https://example.com/payments/balance/result',
  queueTimeoutUrl: 'https://example.com/payments/balance/timeout',
});
```

Takes `partyA` (`PartyA`), an optional `identifierType` (`IdentifierType`), `resultUrl` (`ResultURL`), `queueTimeoutUrl` (`QueueTimeOutURL`) and optional `remarks` (`Remarks`, up to 100 characters, defaults to "Account balance"). The balances arrive at `resultUrl` as one packed string; split it with [`parseBalances`](/guide/callbacks).
