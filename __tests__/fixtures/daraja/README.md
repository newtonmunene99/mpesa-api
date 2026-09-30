# Daraja sample payloads

Callback bodies copied from the sample payloads in the signed-in Daraja portal docs (transcribed on 2026-09-29). They are Safaricom's published examples, not captured traffic.

| File                         | Portal page                | Section                                                                                                                                              |
| ---------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| stk-callback-success.json    | M-Pesa Express Simulate    | Sample Successful Callback Payload                                                                                                                   |
| stk-callback-cancelled.json  | M-Pesa Express Simulate    | Sample Unsuccessful Callback Payload                                                                                                                 |
| b2c-result-success.json      | Business To Customer (B2C) | Callback payload                                                                                                                                     |
| b2c-result-failure.json      | Business To Customer (B2C) | Sample Unsuccessful Callback Payload                                                                                                                 |
| status-result-partial.json   | Transaction Status         | Callback payload. **Partial:** ResultCode, ResultDesc, ReferenceData and the first ResultParameter entries were not captured; tests add a ResultCode |
| balance-result.json          | Account Balance            | Callback Result Payload (QueueTimeoutURL is a placeholder)                                                                                           |
| reversal-result-success.json | Reversal                   | Successful Callback (QueueTimeoutURL is a placeholder)                                                                                               |
| reversal-result-failure.json | Reversal                   | Unsuccessful Callback (QueueTimeoutURL is a placeholder)                                                                                             |
| c2b-v2-notification.json     | Customer To Business (C2B) | Callback Payload (masked version)                                                                                                                    |
