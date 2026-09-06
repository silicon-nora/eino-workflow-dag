// Generated from the matching .d.ts file by scripts/sync-cjs-types.js.
import type {
  DAGData,
  DAGNode,
  DAGEdge,
  SubgraphInfo,
  VisibleEdge,
  VisibleGraph,
  VisibleNode,
  WorkflowDAGModelAPI,
} from "./index.cjs";

export type {
  DAGData,
  DAGNode,
  DAGEdge,
  SubgraphInfo,
  VisibleEdge,
  VisibleGraph,
  VisibleNode,
  WorkflowDAGModelAPI,
} from "./index.cjs";

export const EinoWorkflowDAGModel: WorkflowDAGModelAPI;
export function buildVisibleGraph(
  root: DAGData,
  expanded?: Record<string, boolean>,
): VisibleGraph;
export function defaultExpandedMap(root: DAGData): Record<string, boolean>;
export function listSubgraphs(root: DAGData): SubgraphInfo[];
export function isGraphNode(node: DAGNode | null | undefined): boolean;
export function nodeRef(node: DAGNode | null | undefined): string;
