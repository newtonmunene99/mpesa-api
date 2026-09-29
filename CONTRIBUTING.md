# Contributing to mpesa-api

Thanks for helping. This guide covers local setup, the checks every change must pass, and how releases work.

## Prerequisites

- **Node.js 22.12+** and **pnpm**. The exact pnpm version is pinned in `package.json` (`packageManager`).
- Recommended: [Vite+](https://viteplus.dev), which provides the `vp` command and can manage Node and pnpm for you:

  ```sh
  curl -fsSL https://vite.plus | bash
  vp env doctor
  ```

  If you don't install Vite+ globally, run the same commands as `pnpm exec vp …`. `vite-plus` is a dev dependency.

## Setup

```sh
git clone https://github.com/newtonmunene99/mpesa-api.git
cd mpesa-api
pnpm install
```

Branch from `dev`. Pull requests target `dev`; `master` holds released code.

## Everyday commands

| Command              | What it does                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `vp test`            | Runs the Vitest suite. It is fully offline and never calls Safaricom.                      |
| `vp check`           | Checks formatting (Oxfmt), lint (type-aware Oxlint) and types. `vp check --fix` autofixes. |
| `vp pack`            | Builds the package into `dist/`.                                                           |
| `pnpm run test:dist` | Smoke test: imports the built package and checks the bundled certificates load.            |
| `pnpm run lint:pkg`  | Validates the package with publint and arethetypeswrong.                                   |

Before you push, run:

```sh
vp check && vp test && vp pack && pnpm run test:dist
```

CI runs the same checks on Node 22, 24 and 26.

## Tests

- Tests live in `__tests__/src/` and import from `vite-plus/test`.
- Fake the `HttpService` boundary (see `index.spec.ts`), or use a local `node:http` server (see `http.service.spec.ts`). **Tests must never call the Daraja API.**
- Assert literal expected values: the exact route, headers and request body.
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

Fixes for 3.x are made on the `v3.x` branch and published under the `v3` dist-tag.

## Reporting bugs and security issues

- Bugs and feature requests: open an issue using the templates.
- Questions: use [Discussions](https://github.com/newtonmunene99/mpesa-api/discussions).
- Security vulnerabilities: report privately, as described in [SECURITY.md](./SECURITY.md).

By participating you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
