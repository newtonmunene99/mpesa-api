# Changesets

Every pull request that changes what users of `mpesa-api` see needs a changeset:

```bash
pnpm changeset
```

Pick the bump (patch, minor or major) and write a one-line summary for the CHANGELOG. When changes merge to `master`, the release workflow opens a "Version Packages" pull request. Merging that pull request publishes to npm.
