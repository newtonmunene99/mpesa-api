# Security Policy

`mpesa-api` handles Daraja consumer keys, secrets, initiator passwords and security credentials, so security reports are taken seriously.

## Supported versions

| Version | Supported                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------- |
| 4.x     | Yes                                                                                                   |
| 3.x     | Bug and security fixes, on the [`v3.x`](https://github.com/newtonmunene99/mpesa-api/tree/v3.x) branch |
| < 3     | No                                                                                                    |

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub: go to the repository's **Security** tab, then **Report a vulnerability**.

Include the affected version, a description of the issue and its impact, and steps to reproduce. Never include real credentials.

You can expect an acknowledgement within a week. Once a fix is released, the advisory will be published with credit to you, unless you prefer otherwise.

## Scope

In scope: how the package handles and transmits credentials, security-credential generation (certificate loading and encryption), the HTTP client, and the published package contents.

Out of scope: Safaricom's Daraja platform itself. Report those issues to Safaricom.
