import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from "react";
import type {
  CreateWorkflowDAGOptions,
  EinoWorkflowSnapshot,
  NodePath,
  WorkflowDAGInstance,
} from "./index.js";

export interface EinoWorkflowDAGReactProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError">,
    Omit<CreateWorkflowDAGOptions, "snapshot" | "onError"> {
  snapshot: EinoWorkflowSnapshot;
  preserveExpanded?: boolean;
  fitOnUpdate?: boolean;
  onReady?: (instance: WorkflowDAGInstance) => void;
  onError?: CreateWorkflowDAGOptions["onError"];
}

export interface EinoWorkflowDAGReactRef {
  getInstance(): WorkflowDAGInstance | null;
  update: WorkflowDAGInstance["update"];
  expandAll: WorkflowDAGInstance["expandAll"];
  collapseAll: WorkflowDAGInstance["collapseAll"];
  toggle: WorkflowDAGInstance["toggle"];
  getExpanded: WorkflowDAGInstance["getExpanded"];
  setExpanded: WorkflowDAGInstance["setExpanded"];
  getActiveNodePath: WorkflowDAGInstance["getActiveNodePath"];
  setActiveNodePath: WorkflowDAGInstance["setActiveNodePath"];
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

export type { NodePath };
export const EinoWorkflowDAGReact: ForwardRefExoticComponent<
  EinoWorkflowDAGReactProps & RefAttributes<EinoWorkflowDAGReactRef>
>;
export default EinoWorkflowDAGReact;
