import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertTypeSurface,
  collectTypeSurface,
  readTypeSurfaceInputs,
} from "./type-surface.js";

const projectRoot = resolve(import.meta.dirname, "..");
const { packageManifest, expected } = readTypeSurfaceInputs(projectRoot);
const actual = collectTypeSurface(projectRoot, packageManifest);

if (process.argv.includes("--write")) {
  writeFileSync(
    resolve(projectRoot, "TYPE_SURFACE.json"),
    `${JSON.stringify(actual, null, 2)}\n`,
  );
  console.log(
    `Updated TYPE_SURFACE.json for ${Object.keys(actual).length} typed subpaths`,
  );
  process.exit(0);
}

try {
  assertTypeSurface(projectRoot, packageManifest, expected);
} catch (error) {
  throw new Error(
    `${error.message}\nReview the declaration diff, run npm run types:surface, and record the change in CHANGELOG.md.`,
  );
}

console.log(
  `OK: public TypeScript surface matches ${Object.keys(actual).length} typed subpaths`,
);
