# Runtimes

The package uses only web-standard APIs (`fetch`, `AbortSignal.timeout`, `crypto.subtle`, `crypto.getRandomValues`, `crypto.randomUUID`, `TextEncoder`, `btoa`/`atob` and `BigInt`), with no Node built-ins, so it runs on Node.js 22.12+, Bun, Deno and edge runtimes. Only reading a certificate file needs a file system; pass the PEM text instead on edge runtimes.
