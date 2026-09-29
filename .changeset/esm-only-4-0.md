---
'mpesa-api': major
---

Modernised toolchain and packaging. `mpesa-api` is now an ESM-only package for Node.js 22.12 or later, built into `dist/` and exporting only the package root. `require('mpesa-api')` and deep imports such as `mpesa-api/lib/...` are no longer supported. Releases are no longer published to GitHub Packages. 3.x stays available under the `v3` dist-tag and on the `v3.x` branch.
