import type {
  DAGData,
  DAGNode,
  DAGEdge,
  SubgraphInfo,
  VisibleEdge,
  VisibleGraph,
  VisibleNode,
  WorkflowDAGModelAPI,
} from "./index.js";

export type {
  DAGData,
  DAGNode,
  DAGEdge,
  SubgraphInfo,
  VisibleEdge,
  VisibleGraph,
  VisibleNode,
  WorkflowDAGModelAPI,
} from "./index.js";

export const EinoWorkflowDAGModel: WorkflowDAGModelAPI;
export function buildVisibleGraph(
  root: DAGData,
  expanded?: Record<string, boolean>,
): VisibleGraph;
export function defaultExpandedMap(root: DAGData): Record<string, boolean>;
export function listSubgraphs(root: DAGData): SubgraphInfo[];
export function isGraphNode(node: DAGNode | null | undefined): boolean;
export function nodeRef(node: DAGNode | null | undefined): string;
