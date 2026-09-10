import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertPublicAssetInventory } from "./public-assets.js";

const projectRoot = resolve(import.meta.dirname, "..");
const inventory = JSON.parse(
  readFileSync(resolve(projectRoot, "PUBLIC_ASSETS.json"), "utf8"),
);
const excludedDirectories = new Set([
  ".git",
  ".artifacts",
  "dist",
  "node_modules",
  "playwright-report",
  "react-dist",
  "test-results",
]);

assertPublicAssetInventory(projectRoot, inventory, { excludedDirectories });
console.log(
  `OK: public asset inventory passed (${inventory.assets.length} reviewed asset${inventory.assets.length === 1 ? "" : "s"})`,
);
