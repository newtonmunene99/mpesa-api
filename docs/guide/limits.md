# Limits

| API                  | Rule                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| STK push             | `accountReference` 1–12 characters, `description` 1–13                                             |
| B2C                  | `amount` 10 to 250 000; `remarks` 2–100 characters                                                 |
| Business To Pochi    | `amount` 10 to 250 000; `remarks` 2–100 characters                                                 |
| B2B                  | `amount` at least 1; `remarks` 1–100; `accountReference` 1–13                                      |
| B2B Express CheckOut | `amount` at least 1; `paymentReference` and `partnerName` required                                 |
| Dynamic QR           | `amount` at least 1; `merchantName` and `reference` required; `size` at least 1                    |
| Pull Transactions    | `to` not before `from`; `offset` an integer, at least 0; Daraja keeps 48 hours                     |
| M-Pesa Ratiba        | `amount` at least 1; `accountReference` 1–12; `description` 1–13; `endDate` not before `startDate` |
| Lipa na Bonga        | `points` at least 1; `amount` = points × rate, to the cent                                         |
| Reversal             | `remarks` 2–100 characters                                                                         |
| Phone numbers        | Kenyan Safaricom numbers (`07…`, `01…`); sent as `2547…`/`2541…`                                   |
| Shortcodes           | 5 to 7 digits; `partyA` and `receiverParty` accept 5 to 9                                          |
| URLs in production   | `https` only                                                                                       |
