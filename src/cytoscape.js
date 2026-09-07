import { mountRenderer } from "./runtime.js";
import { readCytoscapeAccess } from "./cytoscape-access.js";

/** Create a renderer with Cytoscape-specific style overrides. */
export function createCytoscapeWorkflowDAG(container, options) {
  return mountRenderer(container, options);
}

/** Advanced, implementation-specific access. Returns null after destroy(). */
export function getCytoscape(instance) {
  return readCytoscapeAccess(instance);
}
