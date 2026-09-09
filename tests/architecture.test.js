import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "src");
const files = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => join(sourceDir, name));
const sourceByFile = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
const imports = new Map();
const importPattern = /from\s+["'](\.\.?\/[^"']+)["']/g;

for (const [file, source] of sourceByFile) {
  const dependencies = [];
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolve(dirname(file), match[1]);
    if (dependency.startsWith(sourceDir) && sourceByFile.has(dependency)) {
      dependencies.push(dependency);
    }
  }
  imports.set(file, dependencies);
}

const visiting = new Set();
const visited = new Set();
function visit(file, path = []) {
  if (visiting.has(file)) {
    assert.fail(`source import cycle: ${path.concat(file).map(basename).join(" -> ")}`);
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of imports.get(file) || []) visit(dependency, path.concat(file));
  visiting.delete(file);
  visited.add(file);
}
files.forEach((file) => visit(file));

const forbiddenCoreImports = [
  "cytoscape",
  "./runtime.js",
  "./renderer.js",
  "./interaction.js",
  "./overlay.js",
  "./tooltip.js",
  "./viewport.js",
  "./react.js",
  "./vue.js",
];
for (const name of ["model.js", "snapshot.js", "validation.js", "layout.js"]) {
  const source = sourceByFile.get(join(sourceDir, name));
  forbiddenCoreImports.forEach((dependency) => {
    assert(
      !source.includes(`from "${dependency}"`) && !source.includes(`from '${dependency}'`),
      `${name} must stay independent from ${dependency}`,
    );
  });
}

assert(
  !sourceByFile.get(join(sourceDir, "theme.js")).includes("./routing.js"),
  "theme must depend on shared geometry configuration, not the routing pipeline",
);
assert(
  !sourceByFile.get(join(sourceDir, "routing.js")).includes("_cyEle"),
  "the routing pipeline must receive portable context through its adapter boundary",
);
assert(
  sourceByFile.get(join(sourceDir, "runtime.js")).split("\n").length <= 800,
  "runtime orchestration must not absorb extracted host and public-data responsibilities",
);
assert(
  sourceByFile.get(join(sourceDir, "routing.js")).split("\n").length <= 3100,
  "routing orchestration must not absorb extracted pure geometry and A* responsibilities",
);

console.log("OK: source architecture boundaries passed");
