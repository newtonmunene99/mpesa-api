---
applyTo: '__tests__/**'
---

# Tests

- Import test APIs from `vite-plus/test`, not `vitest`.
- Unit tests never call Daraja. Pass the fake `fetch` from `__tests__/helpers/fake-fetch.ts` to `createMpesa` or `createContext`; it records each request and replays canned responses, starting with the token response.
- Assert literal values: the exact URL, headers and request body, and the mapped response including `raw`. Validation tests assert the exact `issues` list and that no request was sent.
- Write the failing test first, then the code. Check that a test fails when the behaviour it covers is removed.
- Crypto tests decrypt with the throwaway private key in `__tests__/fixtures/certs/` through `node:crypto`; Node built-ins are fine in tests, but never in `src/`.
- Callback parser tests use Safaricom's documented samples in `__tests__/fixtures/daraja/`, and redacted live captures in `__tests__/fixtures/sandbox/`. Don't commit unredacted captures: `__tests__/fixtures/sandbox/callbacks/raw/` is gitignored for that reason.
- `__tests__/sandbox/` holds the opt-in live suite. Every spec there must stay skipped unless `MPESA_SANDBOX=1` is set on the command line.
- `__tests__/docs-examples.ts` mirrors every `ts` code block in `docs/` and the README so they type-check. It is never run; `__tests__/docs-examples.spec.ts` fails when a code line is missing from it, so update both together.
