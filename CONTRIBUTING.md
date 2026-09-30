# Contributing to mpesa-api

Thanks for helping. This guide covers local setup, the checks every change must pass, and how releases work.

## Prerequisites

- **Node.js 22.12+** and **pnpm**. The exact pnpm version is pinned in `package.json` (`packageManager`).
- Recommended: [Vite+](https://viteplus.dev), which provides the `vp` command and can manage Node and pnpm for you:

  ```sh
  curl -fsSL https://vite.plus | bash
  vp env doctor
  ```

  Without a global install, the project commands below (`check`, `test`, `pack`) also work as `pnpm exec vp …`, because `vite-plus` is a dev dependency. `vp env` needs the global CLI.

## Setup

```sh
git clone https://github.com/newtonmunene99/mpesa-api.git
cd mpesa-api
pnpm install
```

Branch from `dev`. Pull requests target `dev`; `master` holds released code.

## Everyday commands

| Command              | What it does                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vp test`            | Runs the Vitest suite. It is fully offline and never calls Safaricom.                                               |
| `vp check`           | Checks formatting (Oxfmt), lint (type-aware Oxlint) and types. `vp check --fix` autofixes.                          |
| `vp pack`            | Builds the package into `dist/`.                                                                                    |
| `pnpm run test:dist` | Checks `dist/` uses no Node built-ins, then imports the built package and makes a B2C call against a stubbed fetch. |
| `pnpm run lint:pkg`  | Validates the package with publint and arethetypeswrong.                                                            |

Before you push, run:

```sh
vp check && vp test && vp pack && pnpm run test:dist && pnpm run lint:pkg
```

CI runs the same checks on Node 22, 24 and 26.

## Tests

- Tests live in `__tests__/` (mirroring `src/`) and import from `vite-plus/test`.
- Pass the injected fake `fetch` from `__tests__/helpers/fake-fetch.ts` to `createMpesa` or `createContext`. It records every request and replays canned responses. **Unit tests must never call the Daraja API.**
- Assert literal expected values: the exact URL, headers and request body, and the mapped response.
- Crypto tests use the throwaway key pair in `__tests__/fixtures/certs/`. Callback parser tests use the portal's sample payloads in `__tests__/fixtures/daraja/`.
- `pnpm test:sandbox` runs an opt-in suite against the live Daraja sandbox (see `.env.example`). It only runs with `MPESA_SANDBOX=1`, writes redacted captures to `__tests__/fixtures/sandbox/`, and never runs in CI. Review `git diff` for personal data before committing captures.
- **Never commit real credentials**, tokens or personal phone numbers. Use obvious placeholders.

## Commits and changesets

- Write commit messages as [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, …).
- Every PR that changes what users of the package see needs a **changeset**:

  ```sh
  pnpm changeset
  ```

  Choose patch, minor or major, and write a one-line summary. It becomes the CHANGELOG entry. PRs that only touch docs, tests or CI don't need one.

## Releases

Maintainers release with [Changesets](https://github.com/changesets/changesets):

1. Merging to `master` makes the release workflow open or update a **"chore: version packages"** PR, which bumps the version and writes the CHANGELOG.
2. Merging that PR publishes to npm through trusted publishing, with provenance. No npm tokens are involved.

3.x receives bug and security fixes on the `v3.x` branch. Users install it with `npm i mpesa-api@3`. When a 3.x patch is published, use `npm publish --tag v3` so it doesn't replace `latest`.

## Reporting bugs and security issues

- Bugs and feature requests: open an issue using the templates.
- Questions: use [Discussions](https://github.com/newtonmunene99/mpesa-api/discussions).
- Security vulnerabilities: report privately, as described in [SECURITY.md](./SECURITY.md).

By participating you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
