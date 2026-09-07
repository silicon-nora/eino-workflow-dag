// Generated from the matching .d.ts file by scripts/sync-cjs-types.js.
import type {
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from "react";
import type {
  DAGData,
  DAGDirection,
  DAGLocale,
  DAGStyleRule,
  DAGTheme,
  MountOptions,
  RenderedEdgeData,
  RenderedNodeData,
  WorkflowDAGInstance,
} from "./index.cjs";

export interface EinoWorkflowDAGReactProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError"> {
  root: DAGData;
  direction?: DAGDirection;
  theme?: DAGTheme;
  expanded?: Record<string, boolean>;
  activeNodeId?: string | null;
  pinNodeTip?: boolean;
  autoResize?: boolean;
  debug?: boolean;
  additionalStyles?: DAGStyleRule[];
  ariaLabel?: string;
  accessibilityLabelFormatter?: MountOptions["accessibilityLabelFormatter"];
  keyboardNavigation?: boolean;
  tooltipFormatter?: MountOptions["tooltipFormatter"];
  nodeLabelFormatter?: MountOptions["nodeLabelFormatter"];
  layoutCacheSize?: number;
  preserveExpanded?: boolean;
  fitOnUpdate?: boolean;
  locale?: DAGLocale;
  onReady?: (instance: WorkflowDAGInstance) => void;
  onExpandedChange?: (expanded: Record<string, boolean>) => void;
  onNodeClick?: (node: RenderedNodeData) => void;
  onEdgeClick?: (edge: RenderedEdgeData) => void;
  onError?: (error: Error) => void;
}

export interface EinoWorkflowDAGReactRef {
  getInstance(): WorkflowDAGInstance | null;
  render: WorkflowDAGInstance["render"];
  setData: WorkflowDAGInstance["setData"];
  expandAll: WorkflowDAGInstance["expandAll"];
  collapseAll: WorkflowDAGInstance["collapseAll"];
  togglePath: WorkflowDAGInstance["togglePath"];
  getExpanded: WorkflowDAGInstance["getExpanded"];
  setExpanded: WorkflowDAGInstance["setExpanded"];
  getActiveNodeId: WorkflowDAGInstance["getActiveNodeId"];
  setActiveNodeId: WorkflowDAGInstance["setActiveNodeId"];
  getDirection: WorkflowDAGInstance["getDirection"];
  setDirection: WorkflowDAGInstance["setDirection"];
  getTheme: WorkflowDAGInstance["getTheme"];
  setTheme: WorkflowDAGInstance["setTheme"];
  getLocale: WorkflowDAGInstance["getLocale"];
  setLocale: WorkflowDAGInstance["setLocale"];
  zoomIn: WorkflowDAGInstance["zoomIn"];
  zoomOut: WorkflowDAGInstance["zoomOut"];
  resetView: WorkflowDAGInstance["resetView"];
  listSubgraphs: WorkflowDAGInstance["listSubgraphs"];
  resize: WorkflowDAGInstance["resize"];
  exportImage: WorkflowDAGInstance["exportImage"];
  getDiagnostics: WorkflowDAGInstance["getDiagnostics"];
}

export const EinoWorkflowDAGReact: ForwardRefExoticComponent<
  EinoWorkflowDAGReactProps & RefAttributes<EinoWorkflowDAGReactRef>
>;
export default EinoWorkflowDAGReact;
