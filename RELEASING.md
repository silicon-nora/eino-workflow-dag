# Releasing

Publishing is intentionally deferred until repository ownership and package
authority are confirmed. The approved order is to publish the alpha first,
migrate both consumers to that exact registry version second, and promote to
beta only after those migrations are proven in their own CI.

## Pre-release checklist

1. Confirm that all code, documentation, and visual assets present in this
   repository are authorized for an Apache-2.0 release, then complete the
   checklist and approval record in `PROVENANCE.md`.
2. Recheck that `eino-workflow-dag` is available on the official npm registry
   and confirm that `repository`, `homepage`, and `bugs` still point to
   `https://github.com/silicon-nora/eino-workflow-dag`.
3. Run `npm run release:check`; it must pass before preparing a release tag.
4. Run `npm ci` from a clean checkout.
5. Run `npm run prepublishOnly` and `npm run test:browser`. The publish gate
   includes unit, type, documentation, benchmark, distribution, and packed
   tarball contract checks, plus publint and modern ESM/CommonJS resolution
   audits. It also rejects unreviewed production dependency licenses or stale
   third-party notices, rejects undeclared binary or visual assets, and compares
   all runtime exports with `API_SURFACE.json`. Reviewed assets are pinned by
   SHA-256 with source and license metadata in `PUBLIC_ASSETS.json`. Every typed
   package subpath is likewise pinned to its reviewed declaration content in
   `TYPE_SURFACE.json`. A repeated build must reproduce every `dist` file by
   SHA-256. The packed tarball is
   unpacked and scanned for credential signatures, local absolute paths, and
   undeclared assets. Generated source maps and stale `sourceMappingURL`
   comments are rejected, and the exact tarball must not exceed 350 KiB. The browser suite also
   packs without lifecycle scripts, extracts that exact artifact, and executes
   its UMD and stylesheet in a static host. `check-packed-consumers.js`
   independently installs the exact tarball into a temporary application,
   type-checks and bundles its core, Vue, React, data-only, and CSS imports, and
   loads all JavaScript subpaths through CommonJS.
   CI additionally repeats the type and Chromium suites with the minimum
   declared React, React DOM, and Vue peer versions.
6. Run `npm audit --omit=dev --audit-level=high` against the official npm
   registry and review any unresolved advisory.
7. Confirm the automated exact-tarball consumer build passed; repeat manually
   only when validating a new framework or bundler not covered by that fixture.
8. Review the recorded disposable `suggest-platform` and `cloud-focus`
   rehearsals. Repeat `check-consumer-types.js` or an isolated tarball exercise
   if either consumer contract changed after that evidence was recorded.
9. Replace the `0.4.0-alpha.2` candidate's `Unreleased` changelog date with the
   release date and confirm that exact version throughout the artifact.
10. Run `npm run release:dry-run:next`, create a matching `v<version>` tag, and
    publish a GitHub Release. `.github/workflows/publish.yml` re-runs all gates
    and publishes prereleases under `next`; stable versions use `latest`. The
    tagged commit must belong to the repository's default branch.
11. Confirm npm serves the expected integrity and package metadata, then migrate
    both real consumers with `npm install --save-exact
    eino-workflow-dag@0.4.0-alpha.2` or the equivalent versioned static assets.
    Do not commit a local tarball or cross-repository `file:` dependency.
12. Require both consumer branches to pass CI and visual parity review before
    preparing `0.4.0-beta.1`. Keep the alpha on `next`; do not assign `latest`
    during this phase.

The release workflow rejects a missing or invalid changelog date and requires
the GitHub prerelease checkbox to match whether the package version contains a
semver prerelease component.

The asset inventory is mechanical evidence, not release authorization. The
approver must still review source examples and any data embedded in text files,
then complete the separate provenance checklist item.

It also refuses to publish while any provenance checkbox is open, the approving
party/date is pending, or `repository`, `homepage`, and `bugs` do not point to
the final public GitHub repository.

After every gate passes, the workflow creates one script-free tarball, records
its SHA-1, npm integrity, and size in the job summary, and passes that exact
immutable file to `npm publish`. Publication cannot silently rebuild a
different artifact. Artifact creation independently recomputes those hashes and
the byte size, rejects unsafe archive paths and differences between npm's file
report and the unpacked contents, and reruns the package-level documentation,
source-map exclusion, sensitive-content, asset, and type-surface checks on that exact
file.

## npm authentication bootstrap

The publish job uses the protected GitHub environment `npm-release`. Configure
required reviewers for that environment before the first release.

npm requires a package to exist before a Trusted Publisher can be attached,
so the first release needs a one-time bootstrap credential. Two-factor
authentication is not a project prerequisite. For the first release only,
create a short-lived granular publish token with the minimum package
permissions and publish-time 2FA bypass enabled, add it as the protected
environment secret `NPM_TOKEN`, publish the GitHub Release, and remove that
secret immediately after the job succeeds. The workflow requests GitHub OIDC
and adds npm provenance to this first artifact.

After the package exists, configure its npm Trusted Publisher with GitHub user
`silicon-nora`, repository `eino-workflow-dag`, workflow filename
`publish.yml`, environment `npm-release`, and direct-publish permission.
Future jobs authenticate with short-lived OIDC credentials and do not need
`NPM_TOKEN`. The public `repository` field in `package.json` must match the
GitHub repository exactly. Keep prereleases away from the `latest` dist-tag.

The `prepack` lifecycle rebuilds and checks `dist`, so a tarball cannot silently
reuse an older local build. `npm run pack:check` also uses an isolated temporary
npm cache, validates the tarball allowlist, export targets, hashes, and size,
then removes the temporary artifact. Release CI should still run the complete
checklist before invoking `npm publish`.

## Upgrade policy

- `0.x` minor releases may contain breaking public API or contract changes;
  every such change requires a migration section and changelog entry.
- `0.x` patch releases are backward compatible bug fixes.
- After `1.0.0`, public API and DAG contract compatibility follow semantic
  versioning. A new incompatible DAG contract requires both a new contract
  version and a semver-major package release.
- Internal Cytoscape access through `instance.cy()` is never covered by the
  compatibility guarantee.
