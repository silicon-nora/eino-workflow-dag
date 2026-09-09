import { layoutCacheKey } from "./layout-cache.js";

export function layoutGeometrySignature(tokens) {
  return JSON.stringify({
    node: [
      tokens.node.width,
      tokens.node.height,
      tokens.node.textMaxWidth,
      tokens.node.borderWidth,
      tokens.node.fontSize,
      tokens.node.fontWeight,
      tokens.node.fontFamily || "",
      tokens.node.textOutlineWidth || 0,
    ],
    spacing: tokens.spacing,
  });
}

export function renderGeometrySignature({
  direction,
  elements,
  themeGeometry,
  geometryData = false,
}) {
  return (
    layoutCacheKey(direction, elements, geometryData) +
    String(themeGeometry || "")
  );
}

/** Internal render policy: all relayout decisions pass through this function. */
export function classifyRenderChange(previous, next) {
  if (!previous || next.forceLayout) return "layout";
  if (previous.geometrySignature !== next.geometrySignature) return "layout";
  if (!next.allowDataPatch || !next.patchSafe) return "layout";
  return "data";
}

export function classifyThemeChange(previous, next) {
  if (previous.themeSignature === next.themeSignature) return "none";
  return previous.geometrySignature === next.geometrySignature ? "paint" : "layout";
}
