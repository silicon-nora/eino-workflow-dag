# Registry host fixture

This is an independent consumer of the exact published npm package. It imports
`eino-workflow-dag@1.0.0` from its own dependency tree and never resolves
the repository's `src` or `dist` directories.

The checked-in snapshot matches the output of the compiled and invoked Go Eino
fixture in `integrations/go`. The controls vary only the execution observations
supplied by a host.

```sh
npm ci --prefix tests/host/fixture
npm run dev --prefix tests/host/fixture -- --host 127.0.0.1 --port 4175
```

Verify the four directions, execution-only updates, missing execution state,
nested expansion, container resize, visual presets, interaction policies,
event callbacks, and destroy/remount. Interaction changes remount the renderer
because they are constructor options; visual changes use `setTheme()`. The
coordinate table and verdict are computed from the rendered instance rather
than copied from fixture data.

The root project also automates the published-package observation controls in
Chromium:

```bash
npx playwright test --config=playwright.host.config.js --project=chromium
```

The suite checks paint-only and geometry-changing themes separately, toggles
every interaction policy off and back on, preserves host state across remounts,
and samples direction, appearance, execution, and expansion combinations.
