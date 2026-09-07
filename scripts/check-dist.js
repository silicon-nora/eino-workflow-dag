import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const dist = resolve(projectRoot, "dist");
const files = readdirSync(dist);
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const expectedAPISurface = JSON.parse(
  readFileSync(resolve(projectRoot, "API_SURFACE.json"), "utf8"),
);

function requireFile(name) {
  if (!files.includes(name)) throw new Error(`Missing dist/${name}`);
  return statSync(resolve(dist, name)).size;
}

const umdBytes = requireFile("eino-workflow-dag.umd.cjs");
const cssBytes = requireFile("eino-workflow-dag.css");
requireFile("eino-workflow-dag.js");
requireFile("eino-workflow-dag.cjs");
requireFile("validation.js");
requireFile("validation.cjs");
requireFile("cytoscape.js");
requireFile("cytoscape.cjs");
requireFile("vue.js");
requireFile("vue.cjs");
requireFile("react.js");
requireFile("react.cjs");

function verifyExportTargets(subpath, target, conditions = []) {
  if (typeof target === "string") {
    if (target.startsWith("./") && !existsSync(resolve(projectRoot, target))) {
      throw new Error(
        `Missing ${subpath} ${conditions.join(".") || "default"} export target: ${target}`,
      );
    }
    return;
  }
  for (const [condition, nested] of Object.entries(target || {})) {
    verifyExportTargets(subpath, nested, [...conditions, condition]);
  }
}

for (const [subpath, target] of Object.entries(manifest.exports || {})) {
  verifyExportTargets(subpath, target);
}

const rendererChunks = files.filter((name) => /^renderer-[\w-]+\.js$/.test(name));
if (rendererChunks.length !== 1) {
  throw new Error(`Expected one shared renderer chunk, found ${rendererChunks.length}`);
}
if (files.some((name) => name.endsWith(".map"))) {
  throw new Error("Generated source maps must not be published");
}
if (umdBytes > 700 * 1024) {
  throw new Error(`UMD bundle exceeds 700 KiB: ${umdBytes} bytes`);
}
if (cssBytes > 20 * 1024) {
  throw new Error(`CSS bundle exceeds 20 KiB: ${cssBytes} bytes`);
}

const require = createRequire(import.meta.url);
const umd = require(resolve(dist, "eino-workflow-dag.umd.cjs"));
if (typeof umd.createWorkflowDAG !== "function" || umd.CURRENT_SCHEMA_VERSION !== 1) {
  throw new Error("CommonJS/UMD entry does not expose the expected public API");
}
const commonjs = require(manifest.name);
const cjsValidation = require(`${manifest.name}/validation`);
const cjsCytoscape = require(`${manifest.name}/cytoscape`);
const cjsVue = require(`${manifest.name}/vue`);
const cjsReact = require(`${manifest.name}/react`);
if (
  typeof commonjs.createWorkflowDAG !== "function" ||
  typeof cjsValidation.validateWorkflowSnapshot !== "function" ||
  typeof cjsCytoscape.getCytoscape !== "function" ||
  !cjsVue.EinoWorkflowDAGVue ||
  !cjsReact.EinoWorkflowDAGReact
) {
  throw new Error("One or more CommonJS entry points are missing their public API");
}

const esm = await import(manifest.name);
const validation = await import(`${manifest.name}/validation`);
const cytoscapeEntry = await import(`${manifest.name}/cytoscape`);
const vue = await import(`${manifest.name}/vue`);
const react = await import(`${manifest.name}/react`);
if (
  typeof esm.createWorkflowDAG !== "function" ||
  typeof validation.validateWorkflowSnapshot !== "function" ||
  typeof cytoscapeEntry.getCytoscape !== "function" ||
  !vue.EinoWorkflowDAGVue ||
  !react.EinoWorkflowDAGReact
) {
  throw new Error("One or more ESM entry points are missing their public API");
}

function exportNames(value) {
  return Object.keys(value).sort();
}

function assertExportParity(label, left, right) {
  const leftNames = exportNames(left);
  const rightNames = exportNames(right);
  if (JSON.stringify(leftNames) !== JSON.stringify(rightNames)) {
    throw new Error(
      `${label} export mismatch:\nCommonJS: ${leftNames.join(", ")}\nESM: ${rightNames.join(", ")}`,
    );
  }
}

for (const [label, cjsEntry, esmEntry] of [
  ["root", commonjs, esm],
  ["validation", cjsValidation, validation],
  ["cytoscape", cjsCytoscape, cytoscapeEntry],
  ["vue", cjsVue, vue],
  ["react", cjsReact, react],
]) {
  assertExportParity(label, cjsEntry, esmEntry);
}
assertExportParity("root UMD", umd, esm);

const runtimeEntries = new Map([
  [".", esm],
  ["./validation", validation],
  ["./cytoscape", cytoscapeEntry],
  ["./vue", vue],
  ["./react", react],
]);
for (const [subpath, expectedNames] of Object.entries(expectedAPISurface)) {
  const entry = runtimeEntries.get(subpath);
  if (!entry) throw new Error(`API surface references unknown subpath: ${subpath}`);
  const actualNames = exportNames(entry);
  const normalizedExpected = [...expectedNames].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${subpath} differs from API_SURFACE.json:\nExpected: ${normalizedExpected.join(", ")}\nActual: ${actualNames.join(", ")}`,
    );
  }
}
if (runtimeEntries.size !== Object.keys(expectedAPISurface).length) {
  throw new Error("API_SURFACE.json does not cover every JavaScript entry point");
}

console.log(
  `OK: dist contract passed (UMD ${(umdBytes / 1024).toFixed(1)} KiB, CSS ${(cssBytes / 1024).toFixed(1)} KiB)`,
);
