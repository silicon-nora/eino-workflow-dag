import type {
  DAGDirection,
  LayoutPosition,
  LayoutResult,
  VisibleGraph,
  WorkflowDAGLayoutAPI,
} from "./index.js";

export type {
  DAGDirection,
  LayoutPosition,
  LayoutResult,
  VisibleGraph,
  WorkflowDAGLayoutAPI,
} from "./index.js";

export const EinoWorkflowDAGLayout: WorkflowDAGLayoutAPI;
export function layoutVisibleGraph(
  graph: VisibleGraph,
  options?: { direction?: DAGDirection },
): LayoutResult;
