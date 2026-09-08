import assert from "node:assert/strict";
import {
  listThemes,
  normalizeTheme,
  registerTheme,
  stylesheet,
  themeTokens,
} from "../src/theme.js";

assert.deepEqual(listThemes().slice(0, 3), ["classic", "ink", "midnight"]);
assert.equal(normalizeTheme("missing"), "classic");

const unregister = registerTheme("test-brand", {
  canvas: { bg: "#fafafa" },
  colors: { highlighted: "#663399" },
  node: { fontSize: 17 },
});

assert.equal(normalizeTheme("test-brand"), "test-brand");
assert.equal(themeTokens("test-brand").canvas.bg, "#fafafa");
assert.equal(themeTokens("test-brand").colors.highlighted, "#663399");
assert.equal(themeTokens("test-brand").colors.paper, "#ffffff");
assert.equal(themeTokens("test-brand").node.fontSize, 17);

const rules = stylesheet("test-brand");
const nodeRule = rules.find((rule) => rule.selector === "node");
const highlightedRule = rules.find((rule) => rule.selector === "edge[level = 0]");
const degradedRule = rules.find(
  (rule) => rule.selector === 'node[status = "degraded"]',
);
assert.equal(nodeRule.style["font-size"], 17);
assert.equal(highlightedRule.style["line-color"], "#663399");
assert.equal(degradedRule.style["border-color"], "#9a6700");
assert.equal(degradedRule.style["background-color"], "#fff8c5");

assert.throws(() => registerTheme("classic", {}), /cannot be replaced/);
assert.throws(() => registerTheme("", {}), /non-empty string/);
assert.throws(() => registerTheme("invalid", null), /must be an object/);

unregister();
assert.equal(normalizeTheme("test-brand"), "classic");

const unregisterPrototype = registerTheme("__proto__", {
  colors: { highlighted: "#010203" },
});
assert.equal(normalizeTheme("__proto__"), "__proto__");
assert.equal(themeTokens("__proto__").colors.highlighted, "#010203");
unregisterPrototype();
assert.equal(normalizeTheme("__proto__"), "classic");

console.log("OK: theme registry tests passed");
