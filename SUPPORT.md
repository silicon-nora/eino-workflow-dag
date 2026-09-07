# Support

## Questions and usage help

Search the README, contract, and existing issues first. If the
answer is not covered, open a GitHub discussion after discussions are enabled,
or a narrowly scoped issue with a minimal, non-sensitive reproduction.

## Bugs

Use the bug report template and include the package version, browser or Node.js
version, integration entry point, and the smallest workflow snapshot that reproduces
the problem. Avoid application-specific source code or workflow data.

Only supported environments documented in `BROWSER_SUPPORT.md` are treated as
compatibility defects. Host-application business logic, backend execution,
permissions, and data fetching are outside this project's support scope.

## Go Eino integration

The reference Go projection supports Eino `>=0.9.0 <0.10.0` and Go 1.18 or
newer. CI tests both Eino `v0.9.0` and the stable version pinned by the Go
module. A future Eino minor line is unsupported until the same compiled
topology and execution fixtures pass against it.

The Go integration projects public `compose.GraphInfo` and callback address
data only. Values held by component instances, callback payload bodies, static
workflow inputs, and application secrets are never serialized by the
reference implementation.

## Security

Do not report vulnerabilities in a public issue. Follow `SECURITY.md` and use a
private repository security advisory.
