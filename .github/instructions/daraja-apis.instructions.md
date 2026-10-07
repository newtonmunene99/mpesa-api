---
applyTo: 'src/apis/**,src/callbacks/**'
---

# Daraja API modules and callback parsers

- Each API module exports `<Name>Input` and `<Name>Api` types and a factory `(ctx: Context) => <Name>Api`, wired into `createMpesa` in `src/client.ts`.
- Validate every input field with the helpers in `src/core/validate.ts` (`checkLength`, `checkInt`, `checkUrl`, `checkShortCode`, `checkPhone`) and `checkParty` in `src/apis/shared.ts`. Collect every issue in one `Issues` and throw once with `issues.throwIfAny('<namespace>.<method>')` before anything is sent (`initiatorRequest` does this for initiator APIs). Report a missing passkey as an issue too.
- Map camelCase input to Daraja's exact wire names in one object literal, and map the response back with `str()` and `code()` from `core/coerce.ts`, keeping the body in `raw`. Omit optional fields that are empty rather than sending `""`.
- Initiator APIs (B2C, Business To Pochi, B2B, Transaction Status, Account Balance, Reversal and new ones like them) call `initiatorRequest` from `src/apis/initiator.ts` with their `api`, `path`, URLs and a `fields(issues)` callback that validates the API's own input and returns its Daraja fields. `initiatorRequest` checks the initiator and the URLs, gets the credential from `ctx.securityCredential`, and sends the request. Never build or log the credential yourself.
- In production, URLs must be `https`; C2B registration URLs also must not contain blocked keywords (see `checkUrl`). Some APIs are sandbox-only (C2B simulate) and must say so.
- Callback parsers take `unknown` (already-parsed JSON from an untrusted sender). Use the helpers in `src/callbacks/shared.ts`: `flatten` builds prototype-less objects, `setOwn` keeps a `__proto__` key harmless, `readCents` reads money as exact integer cents (at most two decimal places, never `value * 100`), and `requireValue` rejects non-primitive values. Throw a single `ValidationError` listing every problem.
- A new endpoint, field or behaviour needs a test per validation rule, a README table update, and a changeset.
