# Release-candidate validation

RC validation checks the exact package already served by the npm Registry. It
is distinct from the release gate, which checks source and the package artifact
before publication.

Run the validation from the checkout whose `package.json` has the same exact
prerelease version:

```bash
npm ci
npx playwright install firefox webkit
npm run validate:rc -- 1.0.0-rc.2
```

Local Chromium runs reuse the installed Chrome channel. CI installs its locked
Playwright Chromium build; neither browser runtime is part of the npm package.

The version must be exact. Do not use `next`, a range, a workspace link, or a
local tarball: those inputs cannot prove which published candidate was tested.
Registry commands use bounded retries and timeouts, so a connectivity failure
produces a failed report instead of leaving an observation run hanging.
An alternate uncredentialed HTTPS mirror can be selected with `--registry`
when diagnosing local connectivity, and its URL is recorded in the report.
Promotion evidence must use the default official Registry.

Maintainers can exercise the validation harness before publication with
`--local-artifact ./candidate.tgz`. Such a report is marked `local-artifact`
and is development evidence only; it cannot approve npm promotion.

The command performs one continuous validation run:

1. Compile and invoke the repository's representative Go Eino Workflow, then
   compare its projected topology and final execution outcomes with the shared
   snapshot fixture.
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
npm run validate:rc -- 1.0.0-rc.2 --cycles 100
```

JSON and Markdown reports are written to `.artifacts/rc-validation/`. The
reports record the exact version, Git revision, environment, phase outcomes,
and elapsed times without embedding the temporary consumer directory. A manual
`RC validation` GitHub Actions run executes the same command and retains both
reports as a workflow artifact for 30 days.

## Host integration observation

The automated run establishes a reproducible baseline. Before promoting the RC
to `latest`, one host application should also install the same exact version
and exercise representative, non-sensitive snapshots through its normal data
and component lifecycle. Observe at least:

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
case categories, observation period, and result. Do not copy confidential
snapshots into this repository; reduce any discovered failure to the smallest
synthetic fixture before adding a regression test.

The checked-in exact-npm host has a repeatable Chromium observation suite:

```bash
npm ci --prefix examples/rc-host --ignore-scripts
npm run test:rc-host:browser
```

It exercises theme layout boundaries, every interaction-policy remount, state
preservation, and representative direction, appearance, execution, and
expansion combinations. CI runs it after the normal cross-browser library suite.

## Promotion decision

An RC is blocked when an accepted schema-v1 snapshot cannot render, produces
incorrect identity/status/Level semantics, overlaps nodes, breaks route or port
invariants, leaks resources across normal lifecycle use, breaks a documented
package entry or supported framework/browser, or exceeds the published package
and performance budgets.

Cosmetic preferences that do not violate the documented contract may be
scheduled after `1.0.0`. Any release-blocking runtime fix requires a new RC and
a fresh exact-version report; a passing report is never transferred to a
different package version.
