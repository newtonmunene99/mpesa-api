---
'mpesa-api': major
---

Modernised toolchain and packaging. `mpesa-api` is now an ESM-only package for Node.js 22.12 or later, built into `dist/` and exporting only the package root. `require('mpesa-api')` works only through Node's `require(esm)` support and is not officially supported. Deep imports such as `mpesa-api/lib/...` no longer resolve. Releases are no longer published to GitHub Packages. To stay on 3.x, install `mpesa-api@3`; fixes are maintained on the `v3.x` branch.
