import { layoutVisibleGraph } from "./layout.js";

export const defaultLayoutEngine = Object.freeze({
  id: "builtin-layered",
  layout: layoutVisibleGraph,
});

export function normalizeLayoutEngine(engine) {
  if (engine == null) return defaultLayoutEngine;
  if (
    typeof engine !== "object" ||
    typeof engine.id !== "string" ||
    !engine.id ||
    typeof engine.layout !== "function"
  ) {
    throw new TypeError("layout engine must provide a non-empty id and layout() function");
  }
  return engine;
}
