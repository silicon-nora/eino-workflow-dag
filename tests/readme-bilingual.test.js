import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const english = readFileSync(resolve(root, "README.md"), "utf8");
const chinese = readFileSync(resolve(root, "README.zh-CN.md"), "utf8");

assert.match(english, /\*\*English\*\* \| \[简体中文\]\(\.\/README\.zh-CN\.md\)/);
assert.match(chinese, /\[English\]\(\.\/README\.md\) \| \*\*简体中文\*\*/);

const englishSections = [...english.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
const chineseSections = [...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
assert.equal(
  chineseSections.length,
  englishSections.length,
  "English and Chinese READMEs must have the same number of top-level sections",
);

function codeBlocks(markdown) {
  return [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```$/gm)].map(
    (match) => match[1],
  );
}

assert.deepEqual(
  codeBlocks(chinese),
  codeBlocks(english),
  "English and Chinese README code examples must remain identical",
);

console.log("OK: bilingual README structure and code examples match");
