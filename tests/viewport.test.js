import assert from "node:assert/strict";
import { createViewportController } from "../src/viewport.js";

let styleRefreshes = 0;
const elements = {
  boundingBox() {
    return { x1: 0, y1: 0, x2: 100, y2: 50 };
  },
  empty() {
    return false;
  },
  updateStyle() {
    styleRefreshes += 1;
  },
};
const cy = {
  elements() {
    return elements;
  },
  forceRender() {
    throw new Error("style refresh support should be preferred");
  },
  height() {
    return 400;
  },
  pan() {
    return { x: 100, y: 100 };
  },
  width() {
    return 800;
  },
  zoom() {
    return 1;
  },
};
const container = {
  addEventListener() {},
  removeEventListener() {},
};
const controller = createViewportController(container, {
  fitPadding: 24,
  getCy: () => cy,
  maxZoom: 2,
  minZoom: 0.25,
  overlay: { sync() {} },
  tooltip: { refresh() {} },
  wheelZoom: false,
  zoomStep: 1.2,
});

controller.refreshRenderQuality();
controller.refreshRenderQuality();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(styleRefreshes, 1, "same-turn quality refreshes are coalesced");

controller.refreshRenderQuality();
controller.destroy();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(styleRefreshes, 1, "destroy cancels a pending quality refresh");

console.log("OK: viewport render-quality tests passed");
