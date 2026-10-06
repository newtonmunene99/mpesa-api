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

## Releasing

Releases use [Changesets](https://github.com/changesets/changesets). Every pull request that changes what users of the package see adds a changeset (`pnpm changeset`).

### Stable releases

1. Merging to `master` makes the release workflow open or update a **"chore: version packages"** pull request, which bumps the version and writes `CHANGELOG.md`.
2. GitHub doesn't run CI on that pull request, because the workflow opens it with its own token. It only changes the version and changelog, and CI already ran on the pull requests that brought in the code, so a maintainer merges it using the admin bypass on `master`.
3. Merging it publishes to npm through trusted publishing, with provenance (no npm tokens), tags `v<version>` and creates the GitHub release.

`scripts/release-tag.ts` picks the npm dist-tag: `latest` on `master`, and `v<N>-latest` on a `v<N>.x` maintenance branch.

### Prereleases

1. Run `pnpm changeset pre enter <tag>`, where `<tag>` is `alpha`, `beta` or `rc`, and commit `.changeset/pre.json`.
2. While in pre mode, versions are `x.y.z-<tag>.N` and publish under the `<tag>` dist-tag; `latest` doesn't move.
3. To move up a stage, run `pnpm changeset pre exit`, then `pnpm changeset pre enter <next tag>`.
4. For the stable release, run `pnpm changeset pre exit` and commit; the next version PR produces `x.y.z` on `latest`.

Prereleases normally come from `master`. If stable releases must keep shipping during a prerelease, use a `next` branch instead. Outside pre mode, every push to `next` fails the release workflow on purpose, so it can never publish to `latest`.

### Maintenance lines

When a new major starts, cut `v<N>.x` from `master` just before the breaking changes land, and on that branch set `"baseBranch": "v<N>.x"` in `.changeset/config.json`. The release workflow runs there too, and publishes to `v<N>-latest`. A fix that applies to two lines is two pull requests, one per branch, each with its own changeset.

### 3.x

3.x fixes go to the `v3.x` branch, which predates Changesets. Bump the version in its `package.json`, merge, then push a matching tag (`git tag v3.0.3 && git push origin v3.0.3`). Its release workflow checks that the tag matches the version and publishes to the `v3-latest` dist-tag, never `latest`. Users install 3.x with `npm i mpesa-api@3`.

## Reporting bugs and security issues

- Bugs and feature requests: open an issue using the templates.
- Questions: use [Discussions](https://github.com/newtonmunene99/mpesa-api/discussions).
- Security vulnerabilities: report privately, as described in [SECURITY.md](./SECURITY.md).

By participating you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
