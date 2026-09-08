import assert from "node:assert/strict";
import { resolveInteractionPolicy } from "../src/interaction.js";

const defaults = resolveInteractionPolicy();
assert.deepEqual(defaults, {
  expandOnNodeClick: true,
  tooltipOnHover: true,
  pinTooltipOnNodeClick: true,
  highlightEdgeOnClick: true,
  clearHighlightOnCanvasClick: true,
  keyboardNavigation: true,
  panOnDrag: true,
  zoomOnCtrlWheel: true,
});

const custom = resolveInteractionPolicy({
  interaction: {
    expandOnNodeClick: false,
    pinTooltipOnNodeClick: false,
    zoomOnCtrlWheel: false,
  },
});
assert.equal(custom.expandOnNodeClick, false);
assert.equal(custom.pinTooltipOnNodeClick, false);
assert.equal(custom.zoomOnCtrlWheel, false);
assert.equal(custom.highlightEdgeOnClick, true);

assert.equal(
  resolveInteractionPolicy({ pinNodeTip: false }).pinTooltipOnNodeClick,
  false,
);
assert.equal(
  resolveInteractionPolicy({
    pinNodeTip: false,
    interaction: { pinTooltipOnNodeClick: true },
  }).pinTooltipOnNodeClick,
  true,
);
assert.equal(
  resolveInteractionPolicy({ keyboardNavigation: false }).keyboardNavigation,
  false,
);

assert.throws(
  () => resolveInteractionPolicy({ interaction: { tapNodes: true } }),
  /interaction\.tapNodes is not supported/,
);
assert.throws(
  () => resolveInteractionPolicy({ interaction: { panOnDrag: "yes" } }),
  /interaction\.panOnDrag must be a boolean/,
);
assert.throws(
  () => resolveInteractionPolicy({ interaction: [] }),
  /interaction must be an object/,
);
assert.throws(
  () => resolveInteractionPolicy({ interaction: JSON.parse('{"toString":true}') }),
  /interaction\.toString is not supported/,
);

console.log("OK: interaction policy tests passed");
