import {
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const names = [
  "index",
  "validation",
  "cytoscape",
  "vue",
  "react",
];
const checkOnly = process.argv.includes("--check");
const banner =
  "// Generated from the matching .d.ts file by scripts/sync-cjs-types.js.\n";

for (const name of names) {
  const source = resolve(projectRoot, "src", `${name}.d.ts`);
  const destination = resolve(projectRoot, "src", `${name}.d.cts`);
  const expected =
    banner + readFileSync(source, "utf8").replaceAll('"./index.js"', '"./index.cjs"');

  if (checkOnly) {
    const actual = readFileSync(destination, "utf8");
    if (actual !== expected) {
      throw new Error(
        `${name}.d.cts is stale; run npm run types:cjs and commit the result`,
      );
    }
  } else {
    writeFileSync(destination, expected);
  }
}

console.log(
  checkOnly
    ? `OK: ${names.length} CommonJS declarations match their ESM sources`
    : `Updated ${names.length} CommonJS declarations`,
);
