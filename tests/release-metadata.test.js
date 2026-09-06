import assert from "node:assert/strict";
import {
  repositorySlug,
  resolveReleaseMetadata,
} from "../scripts/release-metadata.js";

assert.equal(
  repositorySlug("git+https://github.com/example-org/eino-workflow-dag.git"),
  "example-org/eino-workflow-dag",
);
assert.equal(
  repositorySlug({
    type: "git",
    url: "https://github.com/example-org/eino-workflow-dag.git",
  }),
  "example-org/eino-workflow-dag",
);
assert.equal(
  repositorySlug("git@github.com:example-org/eino-workflow-dag.git"),
  "example-org/eino-workflow-dag",
);

const prerelease = resolveReleaseMetadata(
  {
    name: "eino-workflow-dag",
    version: "0.4.0-alpha.0",
    repository: "git+https://github.com/example-org/eino-workflow-dag.git",
  },
  {
    tag: "v0.4.0-alpha.0",
    githubRepository: "example-org/eino-workflow-dag",
    releaseIsPrerelease: "true",
    changelog: "## [0.4.0-alpha.0] - 2026-09-06\n",
  },
);
assert.deepEqual(prerelease, {
  packageName: "eino-workflow-dag",
  version: "0.4.0-alpha.0",
  distTag: "next",
});

const stable = resolveReleaseMetadata(
  {
    name: "eino-workflow-dag",
    version: "1.0.0",
    repository: "https://github.com/example-org/eino-workflow-dag.git",
  },
  {
    tag: "v1.0.0",
    githubRepository: "example-org/eino-workflow-dag",
    releaseIsPrerelease: "false",
    changelog: "## [1.0.0] - 2026-09-06\n",
  },
);
assert.equal(stable.distTag, "latest");

assert.throws(
  () =>
    resolveReleaseMetadata(
      {
        name: "eino-workflow-dag",
        version: "0.4.0-alpha.0",
        repository: "https://github.com/example-org/eino-workflow-dag.git",
      },
      { tag: "v0.4.0", githubRepository: "example-org/eino-workflow-dag" },
    ),
  /release tag must be v0\.4\.0-alpha\.0/,
);
assert.throws(
  () =>
    resolveReleaseMetadata(
      {
        name: "eino-workflow-dag",
        version: "0.4.0-alpha.0",
        repository: "https://github.com/other/eino-workflow-dag.git",
      },
      {
        tag: "v0.4.0-alpha.0",
        githubRepository: "example-org/eino-workflow-dag",
      },
    ),
  /package repository must match/,
);
assert.throws(
  () =>
    resolveReleaseMetadata(
      {
        name: "eino-workflow-dag",
        version: "0.4.0-alpha.0",
        repository: "https://github.com/example-org/eino-workflow-dag.git",
      },
      {
        tag: "v0.4.0-alpha.0",
        githubRepository: "example-org/eino-workflow-dag",
        releaseIsPrerelease: false,
      },
    ),
  /requires GitHub prerelease=true/,
);
assert.throws(
  () =>
    resolveReleaseMetadata(
      {
        name: "eino-workflow-dag",
        version: "0.4.0-alpha.0",
        repository: "https://github.com/example-org/eino-workflow-dag.git",
      },
      {
        tag: "v0.4.0-alpha.0",
        githubRepository: "example-org/eino-workflow-dag",
        releaseIsPrerelease: true,
        changelog: "## [0.4.0-alpha.0] - Unreleased\n",
      },
    ),
  /still marks 0\.4\.0-alpha\.0 as Unreleased/,
);
assert.throws(
  () =>
    resolveReleaseMetadata(
      {
        name: "eino-workflow-dag",
        version: "1.0.0",
        repository: "https://github.com/example-org/eino-workflow-dag.git",
      },
      {
        tag: "v1.0.0",
        githubRepository: "example-org/eino-workflow-dag",
        releaseIsPrerelease: false,
        changelog: "## [1.0.0] - 2026-02-30\n",
      },
    ),
  /invalid release date/,
);

console.log("OK: release metadata tests passed");
