// Generated from the matching .d.ts file by scripts/sync-cjs-types.js.
import type {
  DAGDirection,
  LayoutPosition,
  LayoutResult,
  VisibleGraph,
  WorkflowDAGLayoutAPI,
} from "./index.cjs";

export type {
  DAGDirection,
  LayoutPosition,
  LayoutResult,
  VisibleGraph,
  WorkflowDAGLayoutAPI,
} from "./index.cjs";

export const EinoWorkflowDAGLayout: WorkflowDAGLayoutAPI;
export function layoutVisibleGraph(
  graph: VisibleGraph,
  options?: { direction?: DAGDirection },
): LayoutResult;
