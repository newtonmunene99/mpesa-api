# mpesa-api

A TypeScript client for Safaricom's M-Pesa Daraja 3.0 API, published to npm as `mpesa-api`. Version 4 is ESM only, has no runtime dependencies, and must run on Node.js 22.12+, Bun, Deno and edge runtimes. The 3.x line lives on the `v3.x` branch; `dev` is the integration branch and `master` holds releases.

## Commands

Tooling is Vite+ (`vp`) with pnpm. In some editors, run `export NODE_OPTIONS=` first so a debugger bootloader doesn't break `vp`.

```sh
pnpm install
vp check            # format, lint and type-check; `vp check --fix` autofixes
vp test             # unit tests (offline); `CI=true vp test` in scripts
vp pack             # build dist/
pnpm run test:dist  # dist uses no Node built-ins, and a smoke test of the built package
pnpm run lint:pkg   # publint and are-the-types-wrong
pnpm changeset      # add a changeset for any user-facing change
```

All five must pass before a change is done. `pnpm test:sandbox` calls the live Daraja sandbox; it only runs with `MPESA_SANDBOX=1` and a `.env`, and never in CI.

## Layout

- `src/index.ts`: public exports only. Adding or removing an export also updates `__tests__/exports.spec.ts`, `__tests__/exports-types.spec.ts` and the README's Exports table.
- `src/client.ts`: `createMpesa`, config validation and the shared `Context` (`post`, `securityCredential`, `now`).
- `src/core/`: `http` (the only place that calls `fetch`), `auth` (tokens, `TokenStore`), `certificate` (PEM/DER parsing), `credential` (RSA PKCS#1 v1.5), `validate`, `time` (EAT timestamps), `coerce` (`str`, `code`), `errors`.
- `src/apis/`: one module per Daraja API, each exporting a factory that takes the `Context`; `initiator.ts` holds the shared initiator request.
- `src/callbacks/`: parsers for the bodies Daraja posts back.
- `__tests__/`: mirrors `src/`. Fixtures are in `__tests__/fixtures/`.

## Rules

- **Runtime-neutral code.** Use only web-standard APIs (`fetch`, `crypto.subtle`, `crypto.getRandomValues`, `TextEncoder`, `btoa`). Never import `node:*` or use `Buffer` or `process` in `src/`; `scripts/check-dist-neutral.mjs` fails the build if you do. Don't add runtime dependencies.
- **camelCase public types.** Every input field's JSDoc names its Daraja wire field in backticks, for example ``/** 2 to 100 characters (`Remarks`). */``. Every response keeps Daraja's body in `raw`. Keep Daraja's own misspellings on the wire (`Occassion`, `RecieverIdentifierType`, `OriginatorCoversationID`) and note them.
- **Validate before sending.** Collect every problem with `Issues` from `core/validate.ts` and throw one `ValidationError` before any request is made. Error classes live in `core/errors.ts`; don't throw plain `Error`.
- **TypeScript.** Strict mode with `isolatedDeclarations`: exported functions and constants need explicit types. Use `import type` for type-only imports, no default exports, no `any`, single quotes. Use `#private` class fields.
- **Security.** Never log or embed credentials, tokens, passkeys or security credentials. Tests use the throwaway key pair in `__tests__/fixtures/certs/` and placeholder values; never real phone numbers, and never real Daraja credentials. Callback bodies are untrusted input.
- **Docs.** The README is the user manual: a change to public behaviour updates its section and table, and README code blocks are mirrored in `__tests__/readme-examples.ts`, which `vp check` type-checks.
- **Breaking changes** need a `major` changeset and a line in the README's "Migrating from 3.x" section when they affect 3.x users.

## Design

Aim for deep modules: a lot of behaviour behind a small interface.

- **Keep interfaces small and hide the work.** `createMpesa` takes one config object; token caching, retries, credential encryption and error mapping sit behind it. Put new complexity behind an existing interface before adding to it.
- **One place per concern.** `core/http.ts` is the only module that calls `fetch`. `apis/initiator.ts` (`initiatorRequest`) is the only place that validates URLs, signs, sends and maps an initiator request; a new initiator API supplies just its `fields(issues)` callback. If the same sequence appears in two API modules, move it into a shared module.
- **Add a seam only when something varies across it.** `fetch` (global or a test fake) and `TokenStore` (memory or the user's store) are real seams, each with two implementations. Don't add interfaces, options or injection points for a single implementation.
- **Test through the interface callers use.** Tests go through `createMpesa`, or an API factory with a real `Context` and the fake `fetch`, not past them into private helpers.
- **Accept dependencies, return results.** Pass things in (`fetch`, the clock, the token store) rather than creating them inside, and return values rather than mutating arguments.

## Daraja facts that are easy to get wrong

- Timestamps are East Africa Time (UTC+3), `YYYYMMDDHHmmss`; use `core/time.ts`, not `toISOString()`.
- Each new access token invalidates the previous one, so tokens are shared through the `TokenStore`.
- Success is `ResponseCode` "0", but C2B URL registration answers "00000000".
- Result codes arrive as numbers or strings, and some are non-numeric ("R000002"); use `code()` from `core/coerce.ts`.
