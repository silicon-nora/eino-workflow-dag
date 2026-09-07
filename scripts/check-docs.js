import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrokenLocalDocumentationLinks } from "./document-links.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const markdownFiles = readdirSync(projectRoot).filter((name) => name.endsWith(".md"));
const failures = findBrokenLocalDocumentationLinks(projectRoot, markdownFiles);

if (failures.length) {
  throw new Error(`Broken local documentation links:\n${failures.join("\n")}`);
}

console.log(`OK: ${markdownFiles.length} documentation files have valid local links`);
