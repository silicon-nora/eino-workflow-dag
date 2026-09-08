import assert from "node:assert/strict";
import {
  listThemes,
  normalizeTheme,
  normalizeThemeInput,
  registerTheme,
  stylesheet,
  themeTokens,
} from "../src/theme.js";

assert.deepEqual(listThemes().slice(0, 3), ["classic", "ink", "midnight"]);
assert.equal(normalizeTheme("missing"), "classic");

const instanceTheme = normalizeThemeInput({
  base: "ink",
  tokens: {
    node: { width: 248, height: 72, textMaxWidth: 220 },
    spacing: { betweenLayers: 62 },
    tooltip: { bg: "#111827", color: "#f9fafb" },
  },
});
assert.equal(instanceTheme.base, "ink");
assert.equal(themeTokens(instanceTheme).node.width, 248);
assert.equal(themeTokens(instanceTheme).node.height, 72);
assert.equal(themeTokens(instanceTheme).spacing.betweenLayers, 62);
assert.equal(themeTokens(instanceTheme).spacing.nodeNode, 56);
assert.equal(themeTokens(instanceTheme).tooltip.bg, "#111827");
assert.equal(stylesheet(instanceTheme)[0].style.width, 248);

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
assert.equal(nodeRule.style["font-size"], 17);
assert.equal(highlightedRule.style["line-color"], "#663399");
assert.equal(
  rules.some((rule) => rule.selector === 'node[status = "degraded"]'),
  false,
);

assert.throws(() => registerTheme("classic", {}), /cannot be replaced/);
assert.throws(() => registerTheme("", {}), /non-empty string/);
assert.throws(() => registerTheme("invalid", null), /must be an object/);
assert.throws(
  () => normalizeThemeInput({ tokens: { node: { widht: 200 } } }),
  /node\.widht is not supported/,
);
assert.throws(
  () => normalizeThemeInput({ tokens: { node: { width: 20 } } }),
  /node\.width must be between 80 and 600/,
);
assert.throws(
  () => normalizeThemeInput({ tokens: { edge: { highlightedUnderlay: "yes" } } }),
  /highlightedUnderlay must be a boolean/,
);
assert.throws(
  () => normalizeThemeInput({ tokens: {}, appearance: {} }),
  /theme\.appearance is not supported/,
);
assert.throws(
  () => normalizeThemeInput({ tokens: JSON.parse('{"toString":{"x":1}}') }),
  /toString is not supported/,
);

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
