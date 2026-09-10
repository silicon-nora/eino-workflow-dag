import { resolve } from "node:path";
import { assertNoSensitiveContent } from "./sensitive-content.js";

const projectRoot = resolve(import.meta.dirname, "..");
const excludedDirectories = new Set([
  ".git",
  "dist",
  "node_modules",
  "test-results",
  ".artifacts",
]);
assertNoSensitiveContent(projectRoot, { excludedDirectories });
console.log("OK: no known credential signatures found in public source files");
