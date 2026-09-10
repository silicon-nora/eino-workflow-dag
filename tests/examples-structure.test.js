import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const examples = resolve(root, "examples");

assert.deepEqual(
  readdirSync(examples).sort(),
  ["README.md", "react", "vanilla", "vue"],
  "examples must contain only public integration sources",
);

for (const directory of ["react", "vanilla", "vue"]) {
  assert.ok(
    readdirSync(resolve(examples, directory)).includes("index.html"),
    `${directory} must remain directly runnable`,
  );
}

const reactConfig = readFileSync(resolve(root, "vite.react-example.config.js"), "utf8");
assert.match(
  reactConfig,
  /\.artifacts\/examples\/react/,
  "React builds must stay outside examples",
);

console.log("OK: examples contain only runnable public integration sources");
