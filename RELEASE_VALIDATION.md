# Published-release validation

Release validation checks the exact package already served by the npm Registry.
It works for stable and prerelease versions, and is distinct from the release
gate that checks source and a package artifact before publication.

Run it from the checkout whose `package.json` has the same exact version:

```bash
npm ci
npx playwright install firefox webkit
npm run validate:release -- 1.0.0
```

Local Chromium runs reuse the installed Chrome channel. CI installs its locked
Playwright Chromium build; browser runtimes are not part of the npm package.

The version must be exact. Do not use `latest`, `next`, a range, or a workspace
link: those inputs cannot prove which published package was tested. Registry
commands use bounded retries and timeouts, so connectivity failures produce a
failed report instead of leaving an observation run hanging. An alternate
uncredentialed HTTPS mirror can be selected with `--registry` for local
diagnosis, and its URL is recorded in the report. Release evidence should use
the default official Registry.

Maintainers can exercise the harness before publication with
`--local-artifact ./release.tgz`. Such a report is marked `local-artifact` and
is development evidence only; it does not prove the Registry package.

The command performs one continuous validation run:

1. Compile and invoke the representative Go Eino Workflow, then compare its
   projected topology and final execution outcomes with the shared fixture.
2. Install the exact Registry package into clean React 18, React 19, and Vue 3
   consumers; type-check, bundle, and load their package entries.
3. Install the exact Registry package into a clean browser host and render the
   Go-produced snapshot.
4. Exercise execution-only and topology updates, absent execution data,
   application metadata callbacks, all four directions, nested expansion,
   active-node changes, themes, layout-cache reuse, and repeated destruction
   and recreation in Chromium, Firefox, and WebKit.
5. Reject invalid Levels, sibling-node overlaps, non-orthogonal planned routes,
   stale renderer DOM, duplicate overlays, browser exceptions, and console
   errors.

Each browser performs 50 update, interaction, and lifecycle cycles by default.
Set a value from 10 through 200 when a longer soak is useful:

```bash
npm run validate:release -- 1.0.0 --cycles 100
```

JSON and Markdown reports are written to `.artifacts/release-validation/`.
They record the exact version, Git revision, environment, phase outcomes, and
elapsed times without embedding temporary consumer paths. A manual
`Release validation` GitHub Actions run executes the same command and retains
both reports as a workflow artifact for 30 days.

`validate:rc` remains a compatibility alias for existing maintainer automation.
New automation should use `validate:release`.

## README installation path

The README's marked Quick start blocks are executable documentation. Verify the
same steps a new user follows with:

```bash
npm run validate:quickstart
```

The command creates a temporary empty application, runs the unqualified
`npm install eino-workflow-dag` command against the official Registry, and then
uses the README code as both JavaScript and TypeScript. It requires the example
to type-check, bundle, load the packaged stylesheet, render a canvas in
Chromium, expose the documented instance lifecycle, and produce no browser or
console errors. The installed version is printed with the result.

## Host integration observation

The automated run establishes a reproducible baseline. A host application can
also install the same exact version and exercise representative, non-sensitive
snapshots through its normal data and component lifecycle. Observe at least:

- serial, branched, failed, skipped, nested, and missing-execution cases;
- 100- to 500-node snapshots when the host expects that scale;
- expansion and collapse, every enabled direction, active-node updates, and
  mount/unmount behavior under the host framework;
- paint-only and geometry-changing theme updates, plus each enabled or disabled
  built-in interaction policy;
- browser console and unhandled errors, DOM or listener growth after repeated
  navigation, node overlap, branch-side jumps, diagonal routes, and unexpected
  full layout runs for execution-only updates;
- node and edge callback metadata, while keeping metadata irrelevant to core
  layout and routing decisions.

Record the package version, host/framework versions, browsers, representative
case categories, observation period, and result. Use synthetic fixtures in this
repository so reports and regression tests remain safe to publish.

The checked-in exact-Registry host has a repeatable Chromium observation suite:

```bash
npm ci --prefix examples/registry-host --ignore-scripts
npx playwright test --config=playwright.host.config.js --project=chromium
```

It exercises theme layout boundaries, every interaction-policy remount, state
preservation, and representative direction, appearance, execution, and
expansion combinations. CI runs it after the normal cross-browser library suite.

## Release decision

A release is blocked when an accepted schema-v1 snapshot cannot render,
produces incorrect identity/status/Level semantics, overlaps nodes, breaks route
or port invariants, leaks resources across normal lifecycle use, breaks a
documented package entry or supported framework/browser, or exceeds the
published package and performance budgets.

Any release-blocking runtime fix requires a new package version and a fresh
exact-version report. A passing report is never transferred to another version.
