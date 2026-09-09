import assert from "node:assert/strict";
import {
  classifyRenderChange,
  classifyThemeChange,
  layoutGeometrySignature,
  renderGeometrySignature,
} from "../src/render-change.js";
import { themeTokens } from "../src/theme.js";

const elements = [
  { group: "nodes", data: { id: "a", label: "A", subgraph: false } },
  { group: "nodes", data: { id: "b", label: "B", subgraph: false } },
  { group: "edges", data: { id: "e", source: "a", target: "b", level: 0 } },
];
const themeGeometry = layoutGeometrySignature(themeTokens("classic"));
const signature = renderGeometrySignature({
  direction: "RIGHT",
  elements,
  themeGeometry,
});

assert.equal(
  classifyRenderChange(null, { geometrySignature: signature }),
  "layout",
  "the initial render always lays out",
);
assert.equal(
  classifyRenderChange(
    { geometrySignature: signature },
    { geometrySignature: signature, allowDataPatch: true, patchSafe: true },
  ),
  "data",
  "geometry-stable runtime changes patch data",
);
assert.equal(
  classifyRenderChange(
    { geometrySignature: signature },
    { geometrySignature: `${signature}:changed`, allowDataPatch: true, patchSafe: true },
  ),
  "layout",
  "a geometry signature change relayouts",
);
assert.equal(
  classifyRenderChange(
    { geometrySignature: signature },
    { geometrySignature: signature, allowDataPatch: true, patchSafe: false },
  ),
  "layout",
  "custom selector styles keep the conservative relayout path",
);

assert.equal(
  classifyThemeChange(
    { themeSignature: "a", geometrySignature: "same" },
    { themeSignature: "b", geometrySignature: "same" },
  ),
  "paint",
  "paint-only themes do not relayout",
);
assert.equal(
  classifyThemeChange(
    { themeSignature: "a", geometrySignature: "small" },
    { themeSignature: "b", geometrySignature: "large" },
  ),
  "layout",
  "measurement theme changes relayout",
);

console.log("OK: render change classification tests passed");
