---
'mpesa-api': patch
---

`pullTransactions.register` now reads the `Response Status` and `Response Description` keys (with spaces) that the live sandbox sends, and `pullTransactions.query` falls back to `RequestID` for `responseRefId`.
