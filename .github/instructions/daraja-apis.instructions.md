---
applyTo: 'src/apis/**,src/callbacks/**'
---

# Daraja API modules and callback parsers

- Each API module exports `<Name>Input` and `<Name>Api` types and a factory `(ctx: Context) => <Name>Api`, wired into `createMpesa` in `src/client.ts`.
- Validate every input field with the helpers in `src/core/validate.ts` (`checkLength`, `checkInt`, `checkUrl`, `checkShortCode`, `checkPhone`) and `checkParty` in `src/apis/shared.ts`, collect issues in one `Issues`, and call `issues.throwIfAny('<namespace>.<method>')` before `ctx.post`. Report a missing initiator or passkey as an issue too.
- Map camelCase input to Daraja's exact wire names in one object literal, and map the response back with `str()` and `code()` from `apis/shared.ts`, keeping the body in `raw`. Omit optional fields that are empty rather than sending `""`.
- Initiator APIs get the name and credential from `ctx.securityCredential('<namespace>.<method>')`. Never build or log the credential yourself.
- In production, URLs must be `https`; C2B registration URLs also must not contain blocked keywords (see `checkUrl`). Some APIs are sandbox-only (C2B simulate) and must say so.
- Callback parsers take `unknown` (already-parsed JSON from an untrusted sender). Use the helpers in `src/callbacks/shared.ts`: `flatten` builds prototype-less objects, `setOwn` keeps a `__proto__` key harmless, `readNumber` accepts only plain decimals, and `requireValue` rejects non-primitive values. Throw a single `ValidationError` listing every problem.
- A new endpoint, field or behaviour needs a test per validation rule, a README table update, and a changeset.
